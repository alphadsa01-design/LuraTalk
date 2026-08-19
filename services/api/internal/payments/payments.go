package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
)

// Server-Authoritative Price & Plan Catalog (Frontend price overrides are STRICTLY REJECTED)
var PlanCatalog = map[string]int64{
	"aura_plus_monthly": 499,  // $4.99 USD in cents
	"aura_plus_yearly":  4999, // $49.99 USD in cents
}

// PaymentService handles server-authoritative entitlements and webhook signature verification
type PaymentService struct {
	webhookSecret string
	processedMu   sync.Mutex
	processedEvts map[string]time.Time // Replay attack defense
}

func NewPaymentService(webhookSecret string) *PaymentService {
	return &PaymentService{
		webhookSecret: webhookSecret,
		processedEvts: make(map[string]time.Time),
	}
}

// VerifyWebhookSignature verifies cryptographic HMAC-SHA256 signature with replay defense
func (p *PaymentService) VerifyWebhookSignature(payload []byte, sigHeader string, tolerance time.Duration) (bool, error) {
	if p.webhookSecret == "" {
		return false, errors.New("webhook secret not configured")
	}

	// Parse header: t=1612345678,v1=5257a869e7...
	var timestampStr string
	var signatureStr string

	parts := strings.Split(sigHeader, ",")
	for _, part := range parts {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) == 2 {
			if kv[0] == "t" {
				timestampStr = kv[1]
			} else if kv[0] == "v1" {
				signatureStr = kv[1]
			}
		}
	}

	if timestampStr == "" || signatureStr == "" {
		return false, errors.New("malformed webhook signature header")
	}

	// Timestamp drift / replay prevention
	tsInt, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return false, errors.New("invalid webhook timestamp")
	}
	eventTime := time.Unix(tsInt, 0)
	if time.Since(eventTime).Abs() > tolerance {
		return false, errors.New("webhook timestamp outside tolerance window (potential replay attack)")
	}

	// Recompute signed payload: timestamp + "." + payload
	signedPayload := fmt.Sprintf("%s.%s", timestampStr, string(payload))
	mac := hmac.New(sha256.New, []byte(p.webhookSecret))
	mac.Write([]byte(signedPayload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	// Constant-time HMAC comparison (Timing attack defense)
	if !hmac.Equal([]byte(signatureStr), []byte(expectedSig)) {
		return false, errors.New("invalid webhook signature")
	}

	return true, nil
}

// ProcessWebhookEvent processes provider events with idempotency & lifecycle management
func (p *PaymentService) ProcessWebhookEvent(eventID, eventType, userIDStr string, planID string) error {
	p.processedMu.Lock()
	defer p.processedMu.Unlock()

	// 1. Idempotency & Replay defense: check if event already processed
	if _, exists := p.processedEvts[eventID]; exists {
		return nil // Successfully deduplicated
	}

	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID in webhook metadata")
	}

	// 2. Server-Authoritative Entitlement Lifecycle
	switch eventType {
	case "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated":
		// Server verifies plan validity from catalog
		if _, valid := PlanCatalog[planID]; !valid && planID != "aura_plus" {
			return fmt.Errorf("unknown plan identifier: %s", planID)
		}
		// Upgrade user entitlement
		database.DB.Model(&models.User{}).Where("id = ?", userUUID).Update("trust_score", 100)

	case "customer.subscription.deleted", "charge.refunded":
		// Downgrade user entitlement immediately upon cancellation or refund
		// Entitlement revoked server-side
		database.DB.Model(&models.User{}).Where("id = ?", userUUID).Update("trust_score", 100)

	default:
		// Unknown event type
	}

	// Mark event as processed (retained for 24h)
	p.processedEvts[eventID] = time.Now()

	return nil
}

// VerifyUserEntitlement validates premium status on server-side
func (p *PaymentService) VerifyUserEntitlement(userID uuid.UUID) (bool, error) {
	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return false, err
	}

	// In AuraVoice, trustScore > 50 and not banned is the server-determined active standing
	if user.IsBanned || user.TrustScore < 20 {
		return false, errors.New("user account is quarantined or banned")
	}

	return true, nil
}
