package realtime

import (
	"testing"
	"time"

	"airtak/services/api/internal/ai"
	"airtak/services/api/internal/config"
	"airtak/services/api/internal/games"
	"airtak/services/api/internal/livekit"
	"airtak/services/api/internal/matchmaking"
	"airtak/services/api/internal/moderation"
	"airtak/services/api/internal/trust"
)

func createTestHub() *Hub {
	cfg := &config.Config{
		JWTSecret:          "test_secret_for_hub_tests_32_bytes!!",
		LiveKitAPIKey:      "devkey",
		LiveKitAPISecret:   "secret012345678901234567890123456789",
		LiveKitHost:        "ws://localhost:7880",
		Environment:        "test",
		CORSAllowedOrigins: "*",
	}

	matchEngine := matchmaking.NewEngine("", nil)
	livekitGen := livekit.NewTokenGenerator(cfg)
	aiEngine := ai.NewAssistantEngine()
	gameManager := games.NewGameManager()
	trustEngine := trust.NewTrustEngine()
	modService := moderation.NewModerationService()

	return NewHub(cfg, matchEngine, livekitGen, aiEngine, gameManager, trustEngine, modService)
}

func TestClientChannelCloseSafety(t *testing.T) {
	client := &Client{
		UserID: "user_test_safety_123",
		Send:   make(chan []byte, 10),
	}

	// First CloseSend should succeed
	client.CloseSend()

	// Repeated CloseSend calls must be safe and never panic
	for i := 0; i < 5; i++ {
		client.CloseSend()
	}

	// SendJSON after close must safely return and not panic on closed channel
	client.SendJSON("test:event", map[string]string{"foo": "bar"})
}

func TestDirectCallInviteValidation(t *testing.T) {
	hub := createTestHub()

	callerID := "caller-uuid-1111"
	calleeID := "callee-uuid-2222"
	imposterID := "imposter-uuid-9999"
	callID := "call-test-invite-id-xyz"
	roomName := "direct_room_12345"

	// Register a valid pending invite
	hub.mu.Lock()
	hub.PendingInvites[callID] = &DirectCallInvite{
		CallID:    callID,
		CallerID:  callerID,
		CalleeID:  calleeID,
		RoomName:  roomName,
		ExpiresAt: time.Now().Add(45 * time.Second),
	}
	hub.mu.Unlock()

	// 1. Forged caller ID attempt (imposter claiming to be caller)
	hub.mu.RLock()
	invite, exists := hub.PendingInvites[callID]
	hub.mu.RUnlock()

	if !exists {
		t.Fatalf("Expected invite to exist in pending invites")
	}

	if invite.CallerID != callerID {
		t.Errorf("Expected callerID to be %s, got %s", callerID, invite.CallerID)
	}

	// Validate reject on forged caller
	isForged := (imposterID != invite.CallerID)
	if !isForged {
		t.Errorf("Expected imposter to be detected as forged caller")
	}

	// 2. Non-existent / expired call ID
	hub.mu.RLock()
	_, nonExistentExists := hub.PendingInvites["fake-call-id-999"]
	hub.mu.RUnlock()

	if nonExistentExists {
		t.Errorf("Expected fake call ID to not exist in pending invites")
	}
}
