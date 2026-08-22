package matchmaking

import (
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestMatchmakingLoadSimulation(t *testing.T) {
	userCounts := []int{10, 100, 1000, 5000}

	for _, count := range userCounts {
		t.Run(fmt.Sprintf("%d_ConcurrentUsers", count), func(t *testing.T) {
			var matchedCount int64
			var latMu sync.Mutex
			var latencies []time.Duration

			engine := NewEngine("", func(pair *MatchedPair) {
				atomic.AddInt64(&matchedCount, 2)
				now := time.Now()
				latA := now.Sub(time.UnixMilli(pair.TicketA.QueuedAt))
				latB := now.Sub(time.UnixMilli(pair.TicketB.QueuedAt))
				latMu.Lock()
				latencies = append(latencies, latA, latB)
				latMu.Unlock()
			})
			defer engine.Stop()

			interestsPool := []string{"gaming", "technology", "music", "movies", "anime", "football", "travel", "books"}
			intentions := []string{"casual", "deep", "language", "gaming", "music"}
			moods := []string{"chill", "energetic", "funny", "curious", "deep"}

			start := time.Now()
			var wg sync.WaitGroup

			// Simulate concurrent queue submissions
			for i := 0; i < count; i++ {
				wg.Add(1)
				go func(idx int) {
					defer wg.Done()
					r := rand.New(rand.NewSource(int64(idx) + time.Now().UnixNano()))

					ticket := &MatchTicket{
						TicketID: fmt.Sprintf("ticket-load-%d-%d", count, idx),
						UserID:   fmt.Sprintf("user-%d-%d", count, idx),
						Username: fmt.Sprintf("SimUser%04d", idx),
						Mode:     ModeVoice,
						Preferences: UserPreferences{
							NativeLanguage:  "en",
							TargetLanguages: []string{"es"},
							Interests: []string{
								interestsPool[r.Intn(len(interestsPool))],
								interestsPool[r.Intn(len(interestsPool))],
							},
							Mood:      moods[r.Intn(len(moods))],
							Intention: intentions[r.Intn(len(intentions))],
						},
						TrustScore: 100,
						QueuedAt:   time.Now().UnixMilli(),
					}
					engine.JoinQueue(ticket)
				}(i)
			}

			wg.Wait()
			queueDuration := time.Since(start)

			// Wait for matchmaking ticks to process pairings based on batch volume
			waitMs := 800 + (count / 200) * 150
			time.Sleep(time.Duration(waitMs) * time.Millisecond)

			totalMatched := atomic.LoadInt64(&matchedCount)
			if totalMatched == 0 {
				t.Fatalf("Expected simulated users to match, got 0")
			}

			latMu.Lock()
			copied := make([]time.Duration, len(latencies))
			copy(copied, latencies)
			latMu.Unlock()

			sort.Slice(copied, func(i, j int) bool {
				return copied[i] < copied[j]
			})

			p50 := copied[len(copied)*50/100]
			p95 := copied[len(copied)*95/100]
			p99 := copied[len(copied)*99/100]

			t.Logf("[%5d Users] Ingested in %-10v (Avg: %8v/ticket) | Matched: %5d/%5d (%.1f%%) | p50: %v | p95: %v | p99: %v",
				count, queueDuration, queueDuration/time.Duration(count), totalMatched, count,
				(float64(totalMatched)/float64(count))*100, p50, p95, p99)

			// Assert p95 pairing latency constraint proportional to batch processing budget
			maxAllowedP95 := time.Duration(waitMs) * time.Millisecond
			if p95 > maxAllowedP95 {
				t.Errorf("p95 pairing latency exceeded threshold: got %v, expected <= %v", p95, maxAllowedP95)
			}
		})
	}
}
