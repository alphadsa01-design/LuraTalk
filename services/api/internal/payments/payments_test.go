package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"
)

func TestPaymentWebhookHMACVerification(t *testing.T) {
	secret := "whsec_test_secret_key_12345"
	svc := NewPaymentService(secret)

	payload := []byte(`{"id":"evt_123","type":"checkout.session.completed","data":{"customer":"cus_test"}}`)
	now := time.Now().Unix()

	// Generate valid signature
	signedPayload := fmt.Sprintf("%d.%s", now, string(payload))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	validSig := hex.EncodeToString(mac.Sum(nil))
	validHeader := fmt.Sprintf("t=%d,v1=%s", now, validSig)

	// 1. Test Valid Signature
	ok, err := svc.VerifyWebhookSignature(payload, validHeader, 5*time.Minute)
	if !ok || err != nil {
		t.Fatalf("Expected valid signature to pass, but got error: %v", err)
	}

	// 2. Test Forged Signature
	forgedHeader := fmt.Sprintf("t=%d,v1=bad_signature_abcdef123456", now)
	ok, err = svc.VerifyWebhookSignature(payload, forgedHeader, 5*time.Minute)
	if ok || err == nil {
		t.Fatalf("Expected forged signature to fail, but it passed!")
	}

	// 3. Test Replay Attack (Timestamp 1 hour old)
	staleTime := time.Now().Add(-1 * time.Hour).Unix()
	staleSigned := fmt.Sprintf("%d.%s", staleTime, string(payload))
	macStale := hmac.New(sha256.New, []byte(secret))
	macStale.Write([]byte(staleSigned))
	staleSig := hex.EncodeToString(macStale.Sum(nil))
	staleHeader := fmt.Sprintf("t=%d,v1=%s", staleTime, staleSig)

	ok, err = svc.VerifyWebhookSignature(payload, staleHeader, 5*time.Minute)
	if ok || err == nil {
		t.Fatalf("Expected replayed webhook to be rejected, but it passed!")
	}

	// 4. Test Server-Authoritative Price Catalog
	if PlanCatalog["aura_plus_monthly"] != 499 {
		t.Fatalf("Expected server monthly price to be 499 cents, got %d", PlanCatalog["aura_plus_monthly"])
	}
}
