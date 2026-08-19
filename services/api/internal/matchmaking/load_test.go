package matchmaking

import (
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestMatchmakingLoadSimulation(t *testing.T) {
	userCounts := []int{10, 100, 1000, 5000, 10000}

	for _, count := range userCounts {
		t.Run(fmt.Sprintf("%d_ConcurrentUsers", count), func(t *testing.T) {
			var matchedCount int64
			engine := NewEngine("", func(pair *MatchedPair) {
				atomic.AddInt64(&matchedCount, 2)
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
						TicketID: fmt.Sprintf("ticket-load-%d", idx),
						UserID:   fmt.Sprintf("user-%d", idx),
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

			// Wait for matchmaking ticks to process pairings
			time.Sleep(1 * time.Second)

			totalMatched := atomic.LoadInt64(&matchedCount)
			t.Logf("[%5d Users] Ingested in %-10v (Avg: %8v/ticket) | Matched: %5d/%5d (%.1f%%)",
				count, queueDuration, queueDuration/time.Duration(count), totalMatched, count,
				(float64(totalMatched)/float64(count))*100)

			if totalMatched == 0 {
				t.Fatalf("Expected simulated users to match, got 0")
			}
		})
	}
}
