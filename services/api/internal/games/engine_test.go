package games

import (
	"strings"
	"testing"
)

func startTTT(t *testing.T) *GameManager {
	t.Helper()
	gm := NewGameManager()
	if s := gm.StartGame("room", GameTicTacToe, "alice", "bob", nil); s == nil {
		t.Fatal("expected a session")
	}
	return gm
}

func move(gm *GameManager, user string, cell int) *GameSession {
	s, _ := gm.HandleAction("room", user, "move", map[string]interface{}{"cell": float64(cell)})
	return s
}

func TestTicTacToeEnforcesTurnsAndIgnoresClientBoard(t *testing.T) {
	gm := startTTT(t)

	// Bob cannot move first, and nobody can inject a whole board / winner
	s := move(gm, "bob", 0)
	if s.Board[0] != "" || s.Turn != "alice" {
		t.Fatal("out-of-turn move must be rejected")
	}
	s, _ = gm.HandleAction("room", "alice", "move", map[string]interface{}{
		"board": []interface{}{"X", "X", "X", "", "", "", "", "", ""}, "status": "won", "winner": "alice",
	})
	if s.Status != "in_progress" || s.Board[0] != "" {
		t.Fatal("client-supplied board/status must be ignored")
	}

	// Outsiders cannot play
	if s := move(gm, "mallory", 4); s.Board[4] != "" {
		t.Fatal("non-player move must be rejected")
	}

	// Alice (X) wins along the top row
	for _, m := range []struct {
		user string
		cell int
	}{{"alice", 0}, {"bob", 3}, {"alice", 1}, {"bob", 4}, {"alice", 2}} {
		s = move(gm, m.user, m.cell)
	}
	if s.Status != "won" || s.Winner != "alice" || s.Scores["alice"] != 1 {
		t.Fatalf("expected alice to win, got status=%s winner=%s scores=%v", s.Status, s.Winner, s.Scores)
	}
	if s := move(gm, "bob", 8); s.Board[8] != "" {
		t.Fatal("no moves after the game is over")
	}

	// Reset swaps symbols: bob is now X and goes first
	s, _ = gm.HandleAction("room", "alice", "reset", nil)
	symbols := s.CustomData["symbols"].(map[string]string)
	if symbols["bob"] != "X" || s.Turn != "bob" || s.Status != "in_progress" {
		t.Fatalf("reset should swap symbols and let X start, got %v turn=%s", symbols, s.Turn)
	}
}

func TestSnapshotsAreIndependentCopies(t *testing.T) {
	gm := NewGameManager()
	gm.StartGame("room", GameWouldYouRather, "alice", "bob", nil)
	s1, _ := gm.HandleAction("room", "alice", "vote", map[string]interface{}{"option": "optionA"})
	s1.CustomData["votes"].(map[string]string)["alice"] = "tampered"
	s2, _ := gm.HandleAction("room", "bob", "vote", map[string]interface{}{"option": "optionB"})
	votes := s2.CustomData["votes"].(map[string]string)
	if votes["alice"] != "optionA" {
		t.Fatal("mutating a snapshot must not change the live session")
	}
	if s2.Status != "completed" {
		t.Fatal("WYR should reveal once both players voted")
	}
	// Votes are locked after the reveal, and only optionA/optionB are accepted
	s3, _ := gm.HandleAction("room", "alice", "vote", map[string]interface{}{"option": "optionB"})
	if s3.CustomData["votes"].(map[string]string)["alice"] != "optionA" {
		t.Fatal("votes must be locked after reveal")
	}
}

func TestWYRRejectsInvalidVoteAndQuestionsSanitize(t *testing.T) {
	gm := NewGameManager()
	gm.StartGame("room", GameWouldYouRather, "alice", "bob", nil)
	s, _ := gm.HandleAction("room", "alice", "vote", map[string]interface{}{"option": "<script>"})
	if len(s.CustomData["votes"].(map[string]string)) != 0 {
		t.Fatal("invalid vote option must be ignored")
	}

	long := strings.Repeat("a", 1000)
	s = gm.StartGame("room2", GameDarkQuestions, "alice", "bob", map[string]interface{}{
		"question": map[string]interface{}{"question": long, "category": "x"},
	})
	q := s.CustomData["question"].(map[string]string)
	if len([]rune(q["question"])) != maxCustomTextLen {
		t.Fatalf("question text should be capped at %d", maxCustomTextLen)
	}
	s, _ = gm.HandleAction("room2", "bob", "react", map[string]interface{}{"reaction": "not-an-emoji"})
	if len(s.CustomData["reactions"].(map[string]string)) != 0 {
		t.Fatal("unknown reactions must be ignored")
	}
}

func TestUnsupportedGameAndEndGame(t *testing.T) {
	gm := NewGameManager()
	if gm.StartGame("room", GameType("chess"), "a", "b", nil) != nil {
		t.Fatal("unsupported game types must not start")
	}
	gm.StartGame("room", GameTicTacToe, "a", "b", nil)
	gm.EndGame("room")
	if gm.GetSession("room") != nil {
		t.Fatal("EndGame should discard the session")
	}
}

func TestFallbackDecksAreClean(t *testing.T) {
	blocked := []string{"sex", "kink", "fetish", "erotic", "nude", "bedroom", "hook up", "lingerie", "seduc"}
	check := func(s string) {
		l := strings.ToLower(s)
		for _, w := range blocked {
			if strings.Contains(l, w) {
				t.Fatalf("deck contains blocked word %q: %s", w, s)
			}
		}
	}
	for _, q := range darkQuestions {
		check(q["question"])
	}
	for _, c := range wyrCards {
		check(c["optionA"] + " " + c["optionB"])
	}
}
