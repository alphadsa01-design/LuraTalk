package realtime

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"airtak/services/api/internal/config"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
)

func setupTestDB(t *testing.T) {
	t.Helper()
	prev := database.DB
	if _, err := database.InitDB(&config.Config{DatabaseURL: filepath.Join(t.TempDir(), "test.db")}); err != nil {
		t.Fatalf("init db: %v", err)
	}
	t.Cleanup(func() { database.DB = prev })
}

func vote(h *Hub, c *Client, peerID string, liked bool) {
	payload, _ := json.Marshal(map[string]interface{}{"peerId": peerID, "liked": liked})
	h.HandleClientMessage(c, WSMessage{Type: "rematch:vote", Payload: payload})
}

func friendshipCount(t *testing.T, a, b string) int64 {
	var n int64
	database.DB.Model(&models.Friendship{}).
		Where("user_id = ? AND friend_id = ? AND status = 'accepted'", uuid.MustParse(a), uuid.MustParse(b)).
		Count(&n)
	return n
}

func TestRematchMutualLikeCreatesFriendship(t *testing.T) {
	setupTestDB(t)
	h := createTestHub()
	idA, idB := uuid.NewString(), uuid.NewString()
	a, b := newTestClient(h, idA), newTestClient(h, idB)
	h.Clients = map[string]*Client{idA: a, idB: b}
	h.mu.Lock()
	h.recordRematchPairLocked(idA, idB, time.Now())
	h.mu.Unlock()

	vote(h, a, idB, true)
	if msgs := drain(a); !hasType(msgs, "rematch:waiting") {
		t.Fatalf("first liker should get rematch:waiting, got %+v", msgs)
	}
	if msgs := drain(b); len(msgs) != 0 {
		t.Fatalf("one-sided like must stay private, peer got %+v", msgs)
	}
	if friendshipCount(t, idA, idB) != 0 {
		t.Fatal("no friendship before both vote")
	}

	vote(h, b, idA, true)
	if !hasType(drain(a), "rematch:mutual") || !hasType(drain(b), "rematch:mutual") {
		t.Fatal("both users should be told about the mutual match")
	}
	if friendshipCount(t, idA, idB) != 1 || friendshipCount(t, idB, idA) != 1 {
		t.Fatal("mutual like should create accepted friendships in both directions")
	}

	// The vote is consumed: voting again does nothing
	vote(h, a, idB, true)
	if msgs := drain(a); len(msgs) != 0 {
		t.Fatalf("pair should be consumed after a mutual match, got %+v", msgs)
	}
}

func TestRematchRequiresRealMatchAndRespectsSkip(t *testing.T) {
	setupTestDB(t)
	h := createTestHub()
	idA, idB, idC := uuid.NewString(), uuid.NewString(), uuid.NewString()
	a, b, c := newTestClient(h, idA), newTestClient(h, idB), newTestClient(h, idC)
	h.Clients = map[string]*Client{idA: a, idB: b, idC: c}
	h.mu.Lock()
	h.recordRematchPairLocked(idA, idB, time.Now())
	h.mu.Unlock()

	// C was never matched with A, so C cannot vote on A
	vote(h, c, idA, true)
	if msgs := drain(c); len(msgs) != 0 {
		t.Fatalf("unmatched user must not be able to vote, got %+v", msgs)
	}

	// A likes, then changes mind; B's like must then not produce a match
	vote(h, a, idB, true)
	vote(h, a, idB, false)
	drain(a)
	vote(h, b, idA, true)
	if hasType(drain(a), "rematch:mutual") || friendshipCount(t, idA, idB) != 0 {
		t.Fatal("withdrawn vote must not create a match")
	}

	// Expired pairs cannot vote
	h.mu.Lock()
	h.RematchPairs[pairKey(idA, idB)] = time.Now().Add(-2 * rematchWindow)
	h.mu.Unlock()
	vote(h, a, idB, true)
	if msgs := drain(a); len(msgs) != 0 {
		t.Fatalf("expired pair must not be votable, got %+v", msgs)
	}
}
