package trust

import (
	"regexp"
	"strings"
	"sync"
	"time"

	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
)

var (
	urlRegex = regexp.MustCompile(`(?i)\b(?:https?://|www\.)\S+\b`)
	harmfulWords = []string{"discord.gg/", "t.me/", "free crypto", "cash app", "whatsapp.com"}
)

type TrustEngine struct {
	rateLimits   map[string][]time.Time // key: userId/ip -> slice of timestamps
	mu           sync.RWMutex
}

func NewTrustEngine() *TrustEngine {
	te := &TrustEngine{
		rateLimits: make(map[string][]time.Time),
	}

	// Periodic rate limits sweeper
	go func() {
		ticker := time.NewTicker(3 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			te.mu.Lock()
			cutoff := time.Now().UTC().Add(-10 * time.Minute)
			for key, timestamps := range te.rateLimits {
				var valid []time.Time
				for _, t := range timestamps {
					if t.After(cutoff) {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(te.rateLimits, key)
				} else {
					te.rateLimits[key] = valid
				}
			}
			te.mu.Unlock()
		}
	}()

	return te
}

// CheckRateLimit checks if user exceeded max actions per time window (e.g. 15 messages/min)
func (te *TrustEngine) CheckRateLimit(key string, maxEvents int, window time.Duration) bool {
	te.mu.Lock()
	defer te.mu.Unlock()

	now := time.Now().UTC()
	cutoff := now.Add(-window)

	timestamps := te.rateLimits[key]
	var valid []time.Time
	for _, t := range timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= maxEvents {
		te.rateLimits[key] = valid
		return false // Rate limited
	}

	valid = append(valid, now)
	te.rateLimits[key] = valid
	return true
}

// SanitizeMessage scans for suspicious phishing links, spam patterns, and masks them
func (te *TrustEngine) SanitizeMessage(content string) (string, bool) {
	isSuspicious := false
	lower := strings.ToLower(content)

	for _, word := range harmfulWords {
		if strings.Contains(lower, word) {
			isSuspicious = true
			break
		}
	}

	sanitized := urlRegex.ReplaceAllStringFunc(content, func(match string) string {
		isSuspicious = true
		return "[link removed for privacy and safety]"
	})

	return sanitized, isSuspicious
}

// UpdateTrustScore updates private internal trust metrics in PostgreSQL
func (te *TrustEngine) UpdateTrustScore(userID uuid.UUID, delta int, reason string) int {
	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return 100
	}

	newScore := user.TrustScore + delta
	if newScore > 100 {
		newScore = 100
	}
	if newScore < 0 {
		newScore = 0
	}

	user.TrustScore = newScore
	database.DB.Save(&user)
	return newScore
}
