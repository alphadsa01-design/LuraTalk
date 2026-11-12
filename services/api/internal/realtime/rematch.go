package realtime

import (
	"encoding/json"
	"time"

	"airtak/services/api/internal/auth"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// "Talk again?" mutual match.
//
// After a random call ends, each participant privately votes whether they would like
// to talk to that person again. Votes are never revealed to the other side: only when
// BOTH vote yes does the server create an accepted friendship and notify both users.
// A one-sided "yes" is silently discarded once it expires.

// rematchWindow is how long after a match the pair may still vote.
const rematchWindow = 30 * time.Minute

// pairKey returns an order-independent key for two user IDs.
func pairKey(a, b string) string {
	if a < b {
		return a + "|" + b
	}
	return b + "|" + a
}

// recordRematchPairLocked remembers that two users were matched. Caller must hold h.mu.
func (h *Hub) recordRematchPairLocked(userA, userB string, at time.Time) {
	key := pairKey(userA, userB)
	h.RematchPairs[key] = at
	delete(h.RematchVotes, key) // a fresh match starts a fresh vote
}

// pruneRematchesLocked drops pairs and votes older than rematchWindow. Caller must hold h.mu.
func (h *Hub) pruneRematchesLocked(now time.Time) {
	for key, matchedAt := range h.RematchPairs {
		if now.Sub(matchedAt) > rematchWindow {
			delete(h.RematchPairs, key)
			delete(h.RematchVotes, key)
		}
	}
}

type rematchProfile struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	AvatarID string `json:"avatarId"`
}

// profileFor returns a minimal public profile, preferring the live connection.
func (h *Hub) profileFor(userID string) rematchProfile {
	h.mu.RLock()
	c, ok := h.Clients[userID]
	h.mu.RUnlock()
	if ok && c != nil {
		return rematchProfile{ID: userID, Username: c.Username, AvatarID: c.AvatarID}
	}
	p := rematchProfile{ID: userID, Username: "Your match"}
	if uid, err := uuid.Parse(userID); err == nil {
		if u, err := auth.GetUserByID(uid); err == nil && u != nil {
			p.Username = u.Username
			p.AvatarID = u.AvatarID
		}
	}
	return p
}

// makeMutualFriends upserts accepted friendship rows in both directions.
func makeMutualFriends(a, b uuid.UUID) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		for _, pair := range [][2]uuid.UUID{{a, b}, {b, a}} {
			var f models.Friendship
			err := tx.Where("user_id = ? AND friend_id = ?", pair[0], pair[1]).First(&f).Error
			if err == nil {
				if f.Status != "accepted" {
					if err := tx.Model(&f).Update("status", "accepted").Error; err != nil {
						return err
					}
				}
				continue
			}
			if err := tx.Create(&models.Friendship{
				ID:        uuid.New(),
				UserID:    pair[0],
				FriendID:  pair[1],
				Status:    "accepted",
				CreatedAt: time.Now().UTC(),
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// handleRematchVote processes a "rematch:vote" message: {"peerId": "...", "liked": true}.
func (h *Hub) handleRematchVote(client *Client, raw json.RawMessage) {
	var payload struct {
		PeerID string `json:"peerId"`
		Liked  bool   `json:"liked"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload.PeerID == "" {
		return
	}
	selfUUID, err1 := uuid.Parse(client.UserID)
	peerUUID, err2 := uuid.Parse(payload.PeerID)
	if err1 != nil || err2 != nil || selfUUID == peerUUID {
		return
	}
	peerID := peerUUID.String()
	key := pairKey(client.UserID, peerID)
	now := time.Now()

	h.mu.Lock()
	h.pruneRematchesLocked(now)
	if _, matched := h.RematchPairs[key]; !matched {
		// Only people who were actually matched together may vote on each other
		h.mu.Unlock()
		return
	}
	votes := h.RematchVotes[key]
	if !payload.Liked {
		// Changing your mind (or skipping) simply withdraws your vote; the peer is never told
		if votes != nil {
			delete(votes, client.UserID)
		}
		h.mu.Unlock()
		return
	}
	if votes == nil {
		votes = make(map[string]bool)
		h.RematchVotes[key] = votes
	}
	votes[client.UserID] = true
	mutual := votes[peerID]
	if mutual {
		// Consume the vote so the match is only celebrated once
		delete(h.RematchVotes, key)
		delete(h.RematchPairs, key)
	}
	h.mu.Unlock()

	if !mutual {
		client.SendJSON("rematch:waiting", map[string]string{"peerId": peerID})
		return
	}

	if h.ModService.IsBlocked(selfUUID, peerUUID) {
		return
	}
	if err := makeMutualFriends(selfUUID, peerUUID); err != nil {
		client.SendJSON("safety:alert", map[string]string{
			"message": "We couldn't save your new friend. Please try again from your history.",
		})
		return
	}

	selfProfile := h.profileFor(client.UserID)
	peerProfile := h.profileFor(peerID)

	client.SendJSON("rematch:mutual", map[string]interface{}{"peer": peerProfile})
	client.SendJSON("friend:update", map[string]interface{}{"status": "accepted", "friendId": peerID})

	h.mu.RLock()
	peerClient, online := h.Clients[peerID]
	h.mu.RUnlock()
	if online && peerClient != nil {
		peerClient.SendJSON("rematch:mutual", map[string]interface{}{"peer": selfProfile})
		peerClient.SendJSON("friend:update", map[string]interface{}{"status": "accepted", "friendId": client.UserID})
	}
}
