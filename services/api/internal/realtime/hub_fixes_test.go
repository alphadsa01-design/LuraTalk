package realtime

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func newTestClient(h *Hub, id string) *Client {
	return &Client{Hub: h, UserID: id, Username: id, Send: make(chan []byte, 32), MysteryLevel: 1}
}

func drain(c *Client) []WSMessage {
	var out []WSMessage
	for {
		select {
		case raw := <-c.Send:
			var m WSMessage
			_ = json.Unmarshal(raw, &m)
			out = append(out, m)
		default:
			return out
		}
	}
}

func hasType(msgs []WSMessage, typ string) bool {
	for _, m := range msgs {
		if m.Type == typ {
			return true
		}
	}
	return false
}

func addInvite(h *Hub, callID, caller, callee string) {
	h.mu.Lock()
	h.PendingInvites[callID] = &DirectCallInvite{
		CallID: callID, CallerID: caller, CalleeID: callee,
		RoomName: "direct_x", ExpiresAt: time.Now().Add(time.Minute),
	}
	h.mu.Unlock()
}

func TestRejectAndCancelRequireInviteOwnership(t *testing.T) {
	h := createTestHub()
	caller := newTestClient(h, "caller")
	callee := newTestClient(h, "callee")
	imposter := newTestClient(h, "imposter")
	h.Clients = map[string]*Client{"caller": caller, "callee": callee, "imposter": imposter}
	addInvite(h, "call-1", "caller", "callee")

	// Imposter tries to reject and cancel someone else's call
	h.HandleClientMessage(imposter, WSMessage{Type: "direct:call_reject", Payload: json.RawMessage(`{"callId":"call-1","callerId":"caller"}`)})
	h.HandleClientMessage(imposter, WSMessage{Type: "direct:call_cancel", Payload: json.RawMessage(`{"callId":"call-1","targetUserId":"callee"}`)})

	if _, ok := h.PendingInvites["call-1"]; !ok {
		t.Fatal("imposter must not be able to remove another user's invite")
	}
	if hasType(drain(caller), "direct:call_rejected") || hasType(drain(callee), "direct:call_cancelled") {
		t.Fatal("imposter must not be able to send reject/cancel notifications")
	}

	// Real callee rejects using the legacy callerId-only payload
	h.HandleClientMessage(callee, WSMessage{Type: "direct:call_reject", Payload: json.RawMessage(`{"callerId":"caller"}`)})
	if _, ok := h.PendingInvites["call-1"]; ok {
		t.Fatal("callee reject should remove the pending invite")
	}
	if !hasType(drain(caller), "direct:call_rejected") {
		t.Fatal("caller should be notified of the rejection")
	}

	// Caller cancels (legacy targetUserId-only payload) => callee is notified, invite gone
	addInvite(h, "call-2", "caller", "callee")
	h.HandleClientMessage(caller, WSMessage{Type: "direct:call_cancel", Payload: json.RawMessage(`{"targetUserId":"callee"}`)})
	if _, ok := h.PendingInvites["call-2"]; ok {
		t.Fatal("caller cancel should remove the pending invite")
	}
	if !hasType(drain(callee), "direct:call_cancelled") {
		t.Fatal("callee should be notified of the cancellation")
	}
}

func TestChatTruncationKeepsValidUTF8(t *testing.T) {
	h := createTestHub()
	a := newTestClient(h, "a")
	b := newTestClient(h, "b")
	a.ActiveRoom, b.ActiveRoom = "room", "room"
	h.Rooms["room"] = map[string]*Client{"a": a, "b": b}

	content := strings.Repeat("é", 1500) // 2 bytes per rune
	payload, _ := json.Marshal(map[string]string{"content": content})
	h.HandleClientMessage(a, WSMessage{Type: "chat:send", Payload: payload})

	msgs := drain(b)
	if len(msgs) != 1 || msgs[0].Type != "chat:message" {
		t.Fatalf("expected one chat message, got %+v", msgs)
	}
	var chat struct{ Content string }
	_ = json.Unmarshal(msgs[0].Payload, &chat)
	if !utf8.ValidString(chat.Content) || utf8.RuneCountInString(chat.Content) != 1000 {
		t.Fatalf("expected 1000 valid runes, got %d (valid=%v)", utf8.RuneCountInString(chat.Content), utf8.ValidString(chat.Content))
	}
}

func TestMysteryLevelIsCapped(t *testing.T) {
	h := createTestHub()
	a := newTestClient(h, "a")
	a.ActiveRoom = "room"
	h.Rooms["room"] = map[string]*Client{"a": a}
	for i := 0; i < 10; i++ {
		h.HandleClientMessage(a, WSMessage{Type: "mystery:reveal_request"})
	}
	if a.MysteryLevel != 3 {
		t.Fatalf("mystery level should cap at 3, got %d", a.MysteryLevel)
	}
}
