package matchmaking

import (
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"airtak/services/api/internal/models"

	"github.com/google/uuid"
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
	modeQueues    map[MatchMode]map[string]*MatchTicket // mode -> ticketId -> *MatchTicket
	userToTicket  map[string]string                    // userId -> ticketId
	ticketToMode  map[string]MatchMode                 // ticketId -> mode
	activeMatches map[string]string                    // userId -> matchId
	recentMatches map[string]map[string]time.Time      // userId -> peerId -> matchedAt
	userBlocks    map[string]map[string]bool           // userId -> blockedUserId -> true
	mu            sync.RWMutex
	matchCallback func(pair *MatchedPair)
	stopChan      chan struct{}
}

func NewEngine(_ string, matchCallback func(pair *MatchedPair)) *MatchmakingEngine {
	engine := &MatchmakingEngine{
		modeQueues: map[MatchMode]map[string]*MatchTicket{
			ModeVoice:   make(map[string]*MatchTicket),
			ModeText:    make(map[string]*MatchTicket),
			ModeMystery: make(map[string]*MatchTicket),
		},
		userToTicket:  make(map[string]string),
		ticketToMode:  make(map[string]MatchMode),
		activeMatches: make(map[string]string),
		recentMatches: make(map[string]map[string]time.Time),
		userBlocks:    make(map[string]map[string]bool),
		matchCallback: matchCallback,
		stopChan:      make(chan struct{}),
	}

	go engine.matchLoop()
	go engine.cleanupLoop()

	return engine
}

// HydrateBlocks loads persistent database blocks into memory on server boot
func (e *MatchmakingEngine) HydrateBlocks(blocks []models.Block) {
	e.mu.Lock()
	defer e.mu.Unlock()

	count := 0
	for _, b := range blocks {
		u1 := b.BlockerID.String()
		u2 := b.BlockedID.String()
		if e.userBlocks[u1] == nil {
			e.userBlocks[u1] = make(map[string]bool)
		}
		e.userBlocks[u1][u2] = true
		if e.userBlocks[u2] == nil {
			e.userBlocks[u2] = make(map[string]bool)
		}
		e.userBlocks[u2][u1] = true
		count++
	}
	log.Printf("MatchmakingEngine: Hydrated %d persistent blocks into matchmaking memory", count)
}

// cleanupLoop periodically sweeps stale in-memory matches to prevent memory leaks
func (e *MatchmakingEngine) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-e.stopChan:
			return
		case <-ticker.C:
			e.mu.Lock()
			cutoff := time.Now().Add(-30 * time.Minute)
			for uID, peers := range e.recentMatches {
				for pID, t := range peers {
					if t.Before(cutoff) {
						delete(peers, pID)
					}
				}
				if len(peers) == 0 {
					delete(e.recentMatches, uID)
				}
			}
			e.mu.Unlock()
		}
	}
}

func (e *MatchmakingEngine) Stop() {
	close(e.stopChan)
}

// JoinQueue submits a matchmaking ticket in O(1) time
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
	if ticket.Mode == "" {
		ticket.Mode = ModeVoice
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	// O(1) removal of any prior ticket for this user
	if oldTid, exists := e.userToTicket[ticket.UserID]; exists {
		if oldMode, modeExists := e.ticketToMode[oldTid]; modeExists {
			if q, ok := e.modeQueues[oldMode]; ok {
				delete(q, oldTid)
			}
		}
		delete(e.userToTicket, ticket.UserID)
		delete(e.ticketToMode, oldTid)
	}

	if e.modeQueues[ticket.Mode] == nil {
		e.modeQueues[ticket.Mode] = make(map[string]*MatchTicket)
	}

	e.modeQueues[ticket.Mode][ticket.TicketID] = ticket
	e.userToTicket[ticket.UserID] = ticket.TicketID
	e.ticketToMode[ticket.TicketID] = ticket.Mode

	return nil
}

// LeaveQueue cancels matchmaking immediately in O(1) time
func (e *MatchmakingEngine) LeaveQueue(userID string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if tid, exists := e.userToTicket[userID]; exists {
		if mode, modeExists := e.ticketToMode[tid]; modeExists {
			if q, ok := e.modeQueues[mode]; ok {
				delete(q, tid)
			}
		}
		delete(e.userToTicket, userID)
		delete(e.ticketToMode, tid)
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

type matchCandidatePair struct {
	ticketA         *MatchTicket
	ticketB         *MatchTicket
	score           float64
	sharedInterests []string
}

func (e *MatchmakingEngine) runMatchTick() {
	modes := []MatchMode{ModeVoice, ModeText, ModeMystery}

	// 1. Snapshot candidate slices under RLock (O(1) read lock)
	e.mu.RLock()
	modeCandidates := make(map[MatchMode][]*MatchTicket)
	for _, mode := range modes {
		q := e.modeQueues[mode]
		if len(q) >= 2 {
			list := make([]*MatchTicket, 0, len(q))
			for _, t := range q {
				list = append(list, t)
			}
			modeCandidates[mode] = list
		}
	}
	e.mu.RUnlock()

	// 2. Score candidates OUTSIDE the write lock (CPU-intensive matching is non-blocking)
	var matchedPairs []*matchCandidatePair

	for _, candidates := range modeCandidates {
		// Cap batch size per tick to guarantee sub-millisecond tick execution under massive concurrency
		if len(candidates) > 400 {
			candidates = candidates[:400]
		}

		matchedIDs := make(map[string]bool)

		for i := 0; i < len(candidates); i++ {
			tA := candidates[i]
			if matchedIDs[tA.TicketID] {
				continue
			}

			bestScore := -1000.0
			bestIdx := -1
			var bestShared []string

			for j := 0; j < len(candidates); j++ {
				if i == j {
					continue
				}
				tB := candidates[j]
				if matchedIDs[tB.TicketID] {
					continue
				}

				score, shared := e.calculateMatchScore(tA, tB)
				if score > -500 && score > bestScore {
					bestScore = score
					bestIdx = j
					bestShared = shared
				}
			}

			if bestIdx != -1 {
				tB := candidates[bestIdx]
				matchedIDs[tA.TicketID] = true
				matchedIDs[tB.TicketID] = true

				matchedPairs = append(matchedPairs, &matchCandidatePair{
					ticketA:         tA,
					ticketB:         tB,
					score:           bestScore,
					sharedInterests: bestShared,
				})
			}
		}
	}

	if len(matchedPairs) == 0 {
		return
	}

	// 3. Commit matched pairs under write Lock (atomic removal & callback dispatch)
	e.mu.Lock()
	var verifiedPairs []*MatchedPair

	for _, p := range matchedPairs {
		tA := p.ticketA
		tB := p.ticketB

		// Verify tickets are still present in queue
		qA := e.modeQueues[tA.Mode]
		qB := e.modeQueues[tB.Mode]
		if qA == nil || qB == nil || qA[tA.TicketID] == nil || qB[tB.TicketID] == nil {
			continue
		}

		// Evict both matched tickets
		delete(qA, tA.TicketID)
		delete(qB, tB.TicketID)
		delete(e.userToTicket, tA.UserID)
		delete(e.userToTicket, tB.UserID)
		delete(e.ticketToMode, tA.TicketID)
		delete(e.ticketToMode, tB.TicketID)

		roomName := fmt.Sprintf("aura_room_%s", uuid.New().String()[:12])
		matchID := uuid.New().String()

		pair := &MatchedPair{
			MatchID:         matchID,
			RoomName:        roomName,
			TicketA:         tA,
			TicketB:         tB,
			Score:           p.score,
			SharedInterests: p.sharedInterests,
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

		verifiedPairs = append(verifiedPairs, pair)
	}
	e.mu.Unlock()

	// 4. Fire callbacks asynchronously outside lock
	if e.matchCallback != nil {
		for _, pair := range verifiedPairs {
			go e.matchCallback(pair)
		}
	}
}

// calculateMatchScore evaluates compatibility based on mathematical specification
func (e *MatchmakingEngine) calculateMatchScore(a, b *MatchTicket) (float64, []string) {
	// Hard constraint 1: Same user cannot match with themselves
	if a.UserID == b.UserID {
		return -9999.0, nil
	}

	// Hard constraint 2: Block list
	e.mu.RLock()
	isBlocked := (e.userBlocks[a.UserID] != nil && e.userBlocks[a.UserID][b.UserID]) ||
		(e.userBlocks[b.UserID] != nil && e.userBlocks[b.UserID][a.UserID])
	recentA := e.recentMatches[a.UserID]
	e.mu.RUnlock()

	if isBlocked {
		return -9999.0, nil
	}

	var score float64 = 0.0

	// 1. Language Compatibility (Max 30 pts)
	langCompat := 0.0
	if strings.EqualFold(a.Preferences.NativeLanguage, b.Preferences.NativeLanguage) {
		langCompat = 30.0
	} else {
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
	if recentA != nil {
		if matchedAt, exists := recentA[b.UserID]; exists {
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
	total := 0
	for _, q := range e.modeQueues {
		total += len(q)
	}
	return total
}

func (e *MatchmakingEngine) GetActiveMatchesCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.activeMatches)
}
