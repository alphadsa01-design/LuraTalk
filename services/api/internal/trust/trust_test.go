package trust

import (
	"testing"
	"time"
)

func TestSanitizeMessage(t *testing.T) {
	te := NewTrustEngine()

	cleanMsg, sus := te.SanitizeMessage("Hey, check out my stream at https://suspicious-phish.xyz/login!")
	if !sus {
		t.Fatalf("Expected suspicious link flag to be true")
	}
	if cleanMsg == "Hey, check out my stream at https://suspicious-phish.xyz/login!" {
		t.Fatalf("Expected URL to be stripped or masked")
	}
}

func TestRateLimiting(t *testing.T) {
	te := NewTrustEngine()

	key := "test-user-123"
	// Allow 5 messages per 500ms
	for i := 0; i < 5; i++ {
		if !te.CheckRateLimit(key, 5, 500*time.Millisecond) {
			t.Fatalf("Message %d should be allowed within rate limit", i)
		}
	}

	// 6th message should be blocked
	if te.CheckRateLimit(key, 5, 500*time.Millisecond) {
		t.Fatalf("6th message should have been rate limited")
	}
}
