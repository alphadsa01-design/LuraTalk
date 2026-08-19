package matchmaking

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type MatchMode string

const (
	ModeVoice   MatchMode = "voice"
	ModeText    MatchMode = "text"
	ModeMystery MatchMode = "mystery"
)

type UserPreferences struct {
	NativeLanguage            string   `json:"nativeLanguage"`
	TargetLanguages           []string `json:"targetLanguages"`
	Interests                 []string `json:"interests"`
	Mood                      string   `json:"mood"`
	Intention                 string   `json:"intention"`
	CountryPreference         string   `json:"countryPreference"` // worldwide, same_country, specific_country
	PreferredCountry          string   `json:"preferredCountry,omitempty"`
	OneQuestionAnswer         string   `json:"oneQuestionAnswer,omitempty"`
	EnableAiAssistant         bool     `json:"enableAiAssistant"`
	EnableLiveTranslation     bool     `json:"enableLiveTranslation"`
	TargetTranslationLanguage string   `json:"targetTranslationLanguage,omitempty"`
}

type MatchTicket struct {
	TicketID    string          `json:"ticketId"`
	UserID      string          `json:"userId"`
	Username    string          `json:"username"`
	AvatarID    string          `json:"avatarId"`
	CountryCode string          `json:"countryCode"`
	Mode        MatchMode       `json:"mode"`
	Preferences UserPreferences `json:"preferences"`
	TrustScore  int             `json:"trustScore"`
	QueuedAt    int64           `json:"queuedAt"` // Unix timestamp in ms
	BlockList   map[string]bool `json:"blockList,omitempty"`
	RecentList  map[string]bool `json:"recentList,omitempty"`
}

type MatchedPair struct {
	MatchID         string       `json:"matchId"`
	RoomName        string       `json:"roomName"`
	TicketA         *MatchTicket `json:"ticketA"`
	TicketB         *MatchTicket `json:"ticketB"`
	Score           float64      `json:"score"`
	SharedInterests []string     `json:"sharedInterests"`
	MatchedAt       time.Time    `json:"matchedAt"`
}

type MatchmakingEngine struct {
	redisClient    *redis.Client
	useRedis       bool
	inMemoryQueue  map[string]*MatchTicket // key: ticketId
	activeMatches  map[string]string       // userId -> matchId
	recentMatches  map[string]map[string]time.Time // userId -> peerId -> matchedAt
	userBlocks     map[string]map[string]bool      // userId -> blockedUserId -> true
	mu             sync.RWMutex
	matchCallback  func(pair *MatchedPair)
	stopChan       chan struct{}
}

func NewEngine(redisURL string, matchCallback func(pair *MatchedPair)) *MatchmakingEngine {
	var rdb *redis.Client
	useRedis := false

	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			rdb = redis.NewClient(opt)
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := rdb.Ping(ctx).Err(); err == nil {
				useRedis = true
				log.Println("MatchmakingEngine: connected to Redis for distributed atomic matchmaking queues.")
			} else {
				log.Println("MatchmakingEngine: Redis not reachable, operating in ultra-fast in-memory queue mode.")
			}
		}
	}

	engine := &MatchmakingEngine{
		redisClient:   rdb,
		useRedis:      useRedis,
		inMemoryQueue: make(map[string]*MatchTicket),
		activeMatches: make(map[string]string),
		recentMatches: make(map[string]map[string]time.Time),
		userBlocks:    make(map[string]map[string]bool),
		matchCallback: matchCallback,
		stopChan:      make(chan struct{}),
	}

	go engine.matchLoop()

	return engine
}

func (e *MatchmakingEngine) Stop() {
	close(e.stopChan)
}

// JoinQueue submits a matchmaking ticket. Target execution time: < 50ms
func (e *MatchmakingEngine) JoinQueue(ticket *MatchTicket) error {
	if ticket.TicketID == "" {
		ticket.TicketID = uuid.New().String()
	}
	if ticket.QueuedAt == 0 {
		ticket.QueuedAt = time.Now().UnixMilli()
	}
	if ticket.TrustScore == 0 {
		ticket.TrustScore = 100
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	// Check if already in active match or remove prior ticket
	for tid, t := range e.inMemoryQueue {
		if t.UserID == ticket.UserID {
			delete(e.inMemoryQueue, tid)
		}
	}

	e.inMemoryQueue[ticket.TicketID] = ticket

	if e.useRedis && e.redisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		data, _ := json.Marshal(ticket)
		queueKey := fmt.Sprintf("queue:%s", ticket.Mode)
		e.redisClient.ZAdd(ctx, queueKey, redis.Z{
			Score:  float64(ticket.QueuedAt),
			Member: ticket.TicketID,
		})
		e.redisClient.Set(ctx, fmt.Sprintf("ticket:%s", ticket.TicketID), data, 10*time.Minute)
	}

	return nil
}

// LeaveQueue cancels matchmaking immediately
func (e *MatchmakingEngine) LeaveQueue(userID string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for tid, t := range e.inMemoryQueue {
		if t.UserID == userID {
			delete(e.inMemoryQueue, tid)
			if e.useRedis && e.redisClient != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
				e.redisClient.ZRem(ctx, fmt.Sprintf("queue:%s", t.Mode), tid)
				e.redisClient.Del(ctx, fmt.Sprintf("ticket:%s", tid))
				cancel()
			}
			break
		}
	}
}

// AddBlock registers a block in memory to ensure zero future matchmaking
func (e *MatchmakingEngine) AddBlock(blockerID, blockedID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.userBlocks[blockerID] == nil {
		e.userBlocks[blockerID] = make(map[string]bool)
	}
	e.userBlocks[blockerID][blockedID] = true
}

func (e *MatchmakingEngine) matchLoop() {
	ticker := time.NewTicker(200 * time.Millisecond) // Match tick every 200ms
	defer ticker.Stop()

	for {
		select {
		case <-e.stopChan:
			return
		case <-ticker.C:
			e.runMatchTick()
		}
	}
}

func (e *MatchmakingEngine) runMatchTick() {
	e.mu.Lock()
	defer e.mu.Unlock()

	modes := []MatchMode{ModeVoice, ModeText, ModeMystery}

	for _, mode := range modes {
		// Collect tickets for this mode
		var candidates []*MatchTicket
		for _, ticket := range e.inMemoryQueue {
			if ticket.Mode == mode {
				candidates = append(candidates, ticket)
			}
		}

		if len(candidates) < 2 {
			continue
		}

		// Perform greedy pairing with multi-dimensional score matrix
		matchedIDs := make(map[string]bool)

		for i := 0; i < len(candidates); i++ {
			tA := candidates[i]
			if matchedIDs[tA.TicketID] {
				continue
			}

			bestScore := -1000.0
			bestIdx := -1

			for j := i + 1; j < len(candidates); j++ {
				tB := candidates[j]
				if matchedIDs[tB.TicketID] {
					continue
				}

				score, shared := e.calculateMatchScore(tA, tB)
				if score > bestScore && score > 0 { // Minimum compatibility threshold
					bestScore = score
					bestIdx = j
					_ = shared
				}
			}

			// If best match found or if waiting > 4 seconds, lower threshold
			timeWaitingA := time.Now().UnixMilli() - tA.QueuedAt
			if bestIdx == -1 && len(candidates) > 1 && timeWaitingA > 4000 {
				for j := 0; j < len(candidates); j++ {
					if j != i && !matchedIDs[candidates[j].TicketID] {
						score, _ := e.calculateMatchScore(tA, candidates[j])
						if score > -500 { // fallback if not explicitly blocked
							bestIdx = j
							bestScore = score
							break
						}
					}
				}
			}

			if bestIdx != -1 {
				tB := candidates[bestIdx]
				matchedIDs[tA.TicketID] = true
				matchedIDs[tB.TicketID] = true

				delete(e.inMemoryQueue, tA.TicketID)
				delete(e.inMemoryQueue, tB.TicketID)

				_, shared := e.calculateMatchScore(tA, tB)
				roomName := fmt.Sprintf("aura_room_%s", uuid.New().String()[:12])
				matchID := uuid.New().String()

				pair := &MatchedPair{
					MatchID:         matchID,
					RoomName:        roomName,
					TicketA:         tA,
					TicketB:         tB,
					Score:           bestScore,
					SharedInterests: shared,
					MatchedAt:       time.Now().UTC(),
				}

				// Record recent match
				if e.recentMatches[tA.UserID] == nil {
					e.recentMatches[tA.UserID] = make(map[string]time.Time)
				}
				if e.recentMatches[tB.UserID] == nil {
					e.recentMatches[tB.UserID] = make(map[string]time.Time)
				}
				e.recentMatches[tA.UserID][tB.UserID] = time.Now().UTC()
				e.recentMatches[tB.UserID][tA.UserID] = time.Now().UTC()

				if e.matchCallback != nil {
					go e.matchCallback(pair)
				}
			}
		}
	}
}

// calculateMatchScore evaluates compatibility based on the prompt's mathematical specification
func (e *MatchmakingEngine) calculateMatchScore(a, b *MatchTicket) (float64, []string) {
	// Hard constraint 1: Same user cannot match with themselves
	if a.UserID == b.UserID {
		return -9999.0, nil
	}

	// Hard constraint 2: Block list
	if e.userBlocks[a.UserID] != nil && e.userBlocks[a.UserID][b.UserID] {
		return -9999.0, nil
	}
	if e.userBlocks[b.UserID] != nil && e.userBlocks[b.UserID][a.UserID] {
		return -9999.0, nil
	}

	var score float64 = 0.0

	// 1. Language Compatibility (Max 30 pts)
	langCompat := 0.0
	if strings.EqualFold(a.Preferences.NativeLanguage, b.Preferences.NativeLanguage) {
		langCompat = 30.0
	} else {
		// Check target languages / practice overlap
		for _, targetA := range a.Preferences.TargetLanguages {
			if strings.EqualFold(targetA, b.Preferences.NativeLanguage) {
				langCompat = math.Max(langCompat, 25.0)
			}
			for _, targetB := range b.Preferences.TargetLanguages {
				if strings.EqualFold(targetA, targetB) {
					langCompat = math.Max(langCompat, 20.0)
				}
			}
		}
	}
	score += langCompat

	// 2. Interest Overlap (Max 30 pts via Jaccard index)
	var sharedInterests []string
	interestMap := make(map[string]bool)
	for _, interest := range a.Preferences.Interests {
		interestMap[strings.ToLower(strings.TrimSpace(interest))] = true
	}
	unionCount := len(interestMap)
	for _, interest := range b.Preferences.Interests {
		clean := strings.ToLower(strings.TrimSpace(interest))
		if interestMap[clean] {
			sharedInterests = append(sharedInterests, clean)
		} else {
			unionCount++
		}
	}
	if unionCount > 0 {
		jaccard := float64(len(sharedInterests)) / float64(unionCount)
		score += jaccard * 30.0
	}

	// 3. Intention Compatibility (Max 20 pts)
	if a.Preferences.Intention != "" && a.Preferences.Intention == b.Preferences.Intention {
		score += 20.0
	} else if a.Preferences.Intention == "casual" || b.Preferences.Intention == "casual" {
		score += 10.0
	}

	// 4. Mood Compatibility (Max 15 pts)
	if a.Preferences.Mood != "" && a.Preferences.Mood == b.Preferences.Mood {
		score += 15.0
	} else {
		// Harmonic mood pairs (e.g. Chill <-> Deep, Curious <-> Talkative)
		moodA, moodB := a.Preferences.Mood, b.Preferences.Mood
		if (moodA == "chill" && moodB == "deep") || (moodA == "deep" && moodB == "chill") ||
			(moodA == "curious" && moodB == "talkative") || (moodA == "talkative" && moodB == "curious") {
			score += 12.0
		} else {
			score += 5.0
		}
	}

	// 5. Trust Score Normalization (+5 to +10 pts)
	avgTrust := float64(a.TrustScore+b.TrustScore) / 2.0
	score += (avgTrust / 100.0) * 10.0

	// 6. Recent Match Penalty (-50 pts if matched within last 30 minutes)
	if e.recentMatches[a.UserID] != nil {
		if matchedAt, exists := e.recentMatches[a.UserID][b.UserID]; exists {
			if time.Since(matchedAt) < 30*time.Minute {
				score -= 50.0
			}
		}
	}

	// 7. Country / Region preference
	if a.Preferences.CountryPreference == "same_country" && a.CountryCode != "" && b.CountryCode != "" {
		if a.CountryCode == b.CountryCode {
			score += 15.0
		} else {
			score -= 10.0
		}
	}

	return score, sharedInterests
}

func (e *MatchmakingEngine) GetQueueCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.inMemoryQueue)
}

func (e *MatchmakingEngine) GetActiveMatchesCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.activeMatches)
}
