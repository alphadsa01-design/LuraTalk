package matchmaking

import (
	"fmt"
	"testing"
	"time"
)

func BenchmarkMatchmakingThroughput(b *testing.B) {
	engine := NewEngine("", nil)
	defer engine.Stop()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ticket := &MatchTicket{
			TicketID: fmt.Sprintf("bench-ticket-%d", i),
			UserID:   fmt.Sprintf("user-%d", i),
			Mode:     ModeVoice,
			Preferences: UserPreferences{
				NativeLanguage:  "en",
				TargetLanguages: []string{"es"},
				Interests:       []string{"gaming", "technology"},
				Mood:            "chill",
				Intention:       "casual",
			},
			TrustScore: 100,
			QueuedAt:   time.Now().UnixMilli(),
		}
		_ = engine.JoinQueue(ticket)
	}
}

func BenchmarkMatchScoringAlgorithm(b *testing.B) {
	engine := NewEngine("", nil)
	defer engine.Stop()

	tA := &MatchTicket{
		TicketID: "t-1",
		UserID:   "user-1",
		Mode:     ModeVoice,
		Preferences: UserPreferences{
			NativeLanguage:  "en",
			TargetLanguages: []string{"es"},
			Interests:       []string{"gaming", "technology", "music"},
			Mood:            "chill",
			Intention:       "casual",
		},
		TrustScore: 100,
		QueuedAt:   time.Now().UnixMilli(),
	}

	tB := &MatchTicket{
		TicketID: "t-2",
		UserID:   "user-2",
		Mode:     ModeVoice,
		Preferences: UserPreferences{
			NativeLanguage:  "en",
			TargetLanguages: []string{"ja"},
			Interests:       []string{"gaming", "anime", "technology"},
			Mood:            "chill",
			Intention:       "casual",
		},
		TrustScore: 100,
		QueuedAt:   time.Now().UnixMilli(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.calculateMatchScore(tA, tB)
	}
}
