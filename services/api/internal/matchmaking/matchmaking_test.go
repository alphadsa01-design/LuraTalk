package matchmaking

import (
	"testing"
	"time"
)

func TestMatchmakingScoring(t *testing.T) {
	engine := NewEngine("", nil)
	defer engine.Stop()

	tA := &MatchTicket{
		TicketID: "t-1",
		UserID:   "user-1",
		Username: "CosmicEcho001",
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
		Username: "NeonDrifter002",
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

	score, shared := engine.calculateMatchScore(tA, tB)
	if score <= 0 {
		t.Fatalf("Expected positive compatibility score for compatible users, got %f", score)
	}

	if len(shared) < 2 {
		t.Fatalf("Expected at least 2 shared interests (gaming, technology), got %d", len(shared))
	}
}

func TestBlockPreventsMatching(t *testing.T) {
	engine := NewEngine("", nil)
	defer engine.Stop()

	tA := &MatchTicket{TicketID: "t-1", UserID: "user-1", Mode: ModeVoice}
	tB := &MatchTicket{TicketID: "t-2", UserID: "user-2", Mode: ModeVoice}

	engine.AddBlock("user-1", "user-2")
	score, _ := engine.calculateMatchScore(tA, tB)
	if score > -1000 {
		t.Fatalf("Blocked user must have negative infinity penalty score, got %f", score)
	}
}

func TestSelfMatchPrevented(t *testing.T) {
	engine := NewEngine("", nil)
	defer engine.Stop()

	tA := &MatchTicket{TicketID: "t-1", UserID: "user-1", Mode: ModeVoice}
	tB := &MatchTicket{TicketID: "t-2", UserID: "user-1", Mode: ModeVoice}

	score, _ := engine.calculateMatchScore(tA, tB)
	if score > -1000 {
		t.Fatalf("Self match must be prohibited, got %f", score)
	}
}
