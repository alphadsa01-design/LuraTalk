package topics

import (
	"testing"
	"time"
)

func TestTodayRotatesDailyAndIsStableWithinADay(t *testing.T) {
	morning := time.Date(2026, 11, 11, 0, 5, 0, 0, time.UTC)
	evening := time.Date(2026, 11, 11, 23, 55, 0, 0, time.UTC)
	tomorrow := morning.Add(24 * time.Hour)

	if Today(morning).ID != Today(evening).ID {
		t.Fatal("topic must stay the same for the whole UTC day")
	}
	if Today(morning).ID == Today(tomorrow).ID {
		t.Fatal("topic must change the next day")
	}
	if !IsToday(Today(morning).ID, evening) || IsToday(Today(tomorrow).ID, evening) || IsToday("", evening) {
		t.Fatal("IsToday mismatch")
	}
}

func TestTopicIDsAreUnique(t *testing.T) {
	seen := map[string]bool{}
	for _, tp := range all {
		if seen[tp.ID] {
			t.Fatalf("duplicate topic id %q", tp.ID)
		}
		seen[tp.ID] = true
		if _, ok := ByID(tp.ID); !ok {
			t.Fatalf("ByID(%q) not found", tp.ID)
		}
	}
}
