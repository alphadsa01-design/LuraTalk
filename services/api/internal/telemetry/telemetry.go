package telemetry

import (
	"log"
	"sync"
	"time"
)

type EventType string

const (
	EventAuthFailure       EventType = "AUTH_FAILURE"
	EventTokenFailure      EventType = "TOKEN_FAILURE"
	EventSuspiciousSession EventType = "SUSPICIOUS_SESSION"
	EventWSConnect         EventType = "WS_CONNECT"
	EventMatchQueue        EventType = "MATCH_QUEUE"
	EventUserReport        EventType = "USER_REPORT"
	EventMediaUpload       EventType = "MEDIA_UPLOAD"
	EventAIUsage           EventType = "AI_USAGE"
	EventServerError       EventType = "SERVER_ERROR"
	EventAccountBan        EventType = "ACCOUNT_BAN"
	EventAdminAction       EventType = "ADMIN_ACTION"
	EventDBAnomaly         EventType = "DB_ANOMALY"
	EventRedisAnomaly      EventType = "REDIS_ANOMALY"
)

// AnomalyThresholds defines limits for alert triggers (events per minute)
var AnomalyThresholds = map[EventType]int64{
	EventAuthFailure:       20,  // >20 auth failures/min
	EventTokenFailure:      30,  // >30 token failures/min
	EventSuspiciousSession: 5,   // >5 suspicious sessions/min
	EventWSConnect:         200, // >200 WS connects/min
	EventMatchQueue:        150, // >150 match requests/min
	EventUserReport:        15,  // >15 abuse reports/min
	EventMediaUpload:       50,  // >50 uploads/min
	EventAIUsage:           100, // >100 AI queries/min
	EventServerError:       10,  // >10 500 errors/min
	EventAccountBan:        10,  // >10 bans/min
	EventAdminAction:       30,  // >30 admin calls/min
	EventDBAnomaly:         5,   // >5 slow queries/min
	EventRedisAnomaly:      5,   // >5 redis connection errors/min
}

// SecurityMonitor provides thread-safe real-time telemetry and anomaly detection
type SecurityMonitor struct {
	mu           sync.RWMutex
	eventWindows map[EventType][]time.Time
	alertHistory []SecurityAlert
}

type SecurityAlert struct {
	Timestamp time.Time `json:"timestamp"`
	EventType EventType `json:"eventType"`
	RateCount int       `json:"rateCount"`
	Threshold int64     `json:"threshold"`
	Severity  string    `json:"severity"` // "WARNING", "CRITICAL"
	Message   string    `json:"message"`
}

var Monitor *SecurityMonitor

func init() {
	Monitor = NewSecurityMonitor()
}

func NewSecurityMonitor() *SecurityMonitor {
	sm := &SecurityMonitor{
		eventWindows: make(map[EventType][]time.Time),
		alertHistory: make([]SecurityAlert, 0),
	}
	// Start periodic cleanup of stale event windows
	go sm.cleanupLoop()
	return sm
}

// RecordEvent logs an occurrence and evaluates if a security anomaly spike is active
func (sm *SecurityMonitor) RecordEvent(eventType EventType, metadata ...string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	msg := ""
	if len(metadata) > 0 {
		msg = metadata[0]
	}

	now := time.Now()
	sm.eventWindows[eventType] = append(sm.eventWindows[eventType], now)

	// Prune timestamps older than 1 minute
	cutoff := now.Add(-1 * time.Minute)
	valid := sm.eventWindows[eventType][:0]
	for _, t := range sm.eventWindows[eventType] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	sm.eventWindows[eventType] = valid

	// Check if rate exceeds anomaly threshold
	count := len(valid)
	threshold, hasThreshold := AnomalyThresholds[eventType]
	if hasThreshold && int64(count) > threshold {
		alert := SecurityAlert{
			Timestamp: now,
			EventType: eventType,
			RateCount: count,
			Threshold: threshold,
			Severity:  "CRITICAL",
			Message:   msg,
		}
		sm.alertHistory = append(sm.alertHistory, alert)
		if len(sm.alertHistory) > 100 {
			sm.alertHistory = sm.alertHistory[len(sm.alertHistory)-100:]
		}

		log.Printf("[SECURITY ALERT: SPIKE_DETECTED] type=%s rate=%d/min threshold=%d/min metadata=%s",
			eventType, count, threshold, metadata)
	}
}

// GetMetrics returns snapshot of current rates and recent alerts
func (sm *SecurityMonitor) GetMetrics() (map[string]int, []SecurityAlert) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	now := time.Now()
	cutoff := now.Add(-1 * time.Minute)
	rates := make(map[string]int)

	for et, times := range sm.eventWindows {
		count := 0
		for _, t := range times {
			if t.After(cutoff) {
				count++
			}
		}
		rates[string(et)] = count
	}

	alertsCopy := make([]SecurityAlert, len(sm.alertHistory))
	copy(alertsCopy, sm.alertHistory)

	return rates, alertsCopy
}

func (sm *SecurityMonitor) cleanupLoop() {
	ticker := time.NewTicker(30 * time.Second)
	for range ticker.C {
		sm.mu.Lock()
		now := time.Now()
		cutoff := now.Add(-1 * time.Minute)
		for et, times := range sm.eventWindows {
			valid := times[:0]
			for _, t := range times {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			sm.eventWindows[et] = valid
		}
		sm.mu.Unlock()
	}
}
