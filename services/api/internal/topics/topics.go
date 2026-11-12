// Package topics provides the "Topic of the day": one shared conversation theme,
// rotating daily (UTC), that users can opt into for matchmaking.
package topics

import "time"

type Topic struct {
	ID     string `json:"id"`
	Emoji  string `json:"emoji"`
	Title  string `json:"title"`
	Prompt string `json:"prompt"`
}

var all = []Topic{
	{"unpopular-opinions", "🔥", "Unpopular opinions", "What's an opinion you hold that most people would disagree with?"},
	{"best-trip", "✈️", "Best trip ever", "Where's the best place you've ever been, and what made it special?"},
	{"comfort-food", "🍜", "Comfort food", "What do you eat when you need cheering up?"},
	{"hidden-talents", "🎭", "Hidden talents", "What's something you're surprisingly good at?"},
	{"childhood-memories", "🧸", "Childhood memories", "What's a small memory from childhood you still think about?"},
	{"dream-job", "🚀", "Dream job", "If money didn't matter, what would you do all day?"},
	{"songs-on-repeat", "🎧", "Songs on repeat", "What song can't you stop listening to right now?"},
	{"life-advice", "🧭", "Best advice", "What's the best piece of advice you've ever received?"},
	{"weird-habits", "🌀", "Weird habits", "What's a harmless habit of yours that others find strange?"},
	{"local-secrets", "📍", "Local secrets", "What should a visitor to your city do that tourists never do?"},
	{"movies-that-stuck", "🎬", "Movies that stuck", "Which movie or show changed how you think about something?"},
	{"small-wins", "🏆", "Small wins", "What's a small win you had this week?"},
	{"future-tech", "🤖", "Future tech", "What technology do you wish existed already?"},
	{"languages", "🗣️", "Learning languages", "What's a word from another language you love?"},
	{"fears", "👻", "Silly fears", "What's a fear you know is irrational but still have?"},
	{"perfect-day", "☀️", "Your perfect day", "Describe a perfect ordinary day, start to finish."},
	{"books", "📚", "Books & stories", "What story would you tell everyone to read or watch?"},
	{"time-travel", "⏳", "Time travel", "Which year would you visit, and why?"},
	{"food-debates", "🍕", "Food debates", "Pineapple on pizza, cereal before milk... what's your hill to die on?"},
	{"gratitude", "💛", "Gratitude", "Who's someone you're grateful for but haven't told?"},
	{"bucket-list", "📝", "Bucket list", "What's one thing you want to do before you're old?"},
}

// Today returns the topic for the given moment (rotates at 00:00 UTC).
func Today(now time.Time) Topic {
	day := now.UTC().Unix() / 86400
	return all[int(day%int64(len(all)))]
}

// IsToday reports whether id is the current topic of the day.
func IsToday(id string, now time.Time) bool {
	return id != "" && Today(now).ID == id
}

// ByID looks a topic up by its ID.
func ByID(id string) (Topic, bool) {
	for _, t := range all {
		if t.ID == id {
			return t, true
		}
	}
	return Topic{}, false
}
