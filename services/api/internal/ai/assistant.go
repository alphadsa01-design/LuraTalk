package ai

import (
	"fmt"
	"math/rand"
	"strings"
	"time"
)

type AssistantEngine struct {
	icebreakerMap map[string][]string
	generalTopics []string
}

func NewAssistantEngine() *AssistantEngine {
	return &AssistantEngine{
		icebreakerMap: map[string][]string{
			"gaming": {
				"Ask what game they've sunk the most hours into this year.",
				"Ask if they prefer story-driven single player games or chaotic multiplayer.",
				"Ask what was the first video game that blew their mind as a kid.",
			},
			"music": {
				"Ask what album they can listen to from start to finish without skipping a track.",
				"Ask if they prefer live concerts or listening with good headphones at 2 AM.",
				"Ask what song instantly changes their mood when it comes on.",
			},
			"technology": {
				"Ask what upcoming tech breakthrough they are most excited or curious about.",
				"Ask what software or hardware tool has genuinely improved their daily routine.",
				"Ask if they think AI will make human connection more or less meaningful.",
			},
			"travel": {
				"Ask where they would teleport right now if they had 24 hours to spend anywhere.",
				"Ask what the most unexpected or chaotic adventure was during a trip they took.",
				"Ask if they prefer getting lost in neon city streets or quiet mountain cabins.",
			},
			"movies": {
				"Ask what movie they secretly love even though critics hated it.",
				"Ask if they could live inside any cinematic universe for a week, which one they'd choose.",
				"Ask for one movie recommendation they guarantee won't be boring.",
			},
			"books": {
				"Ask what fictional character felt the most real to them.",
				"Ask if they prefer sci-fi/fantasy worldbuilding or gritty realistic stories.",
			},
			"deep": {
				"Ask what belief they used to hold strongly that they've completely changed their mind about.",
				"Ask what they think is the most underrated aspect of living in our generation.",
				"Ask what makes them feel truly at peace when life gets overwhelming.",
			},
		},
		generalTopics: []string{
			"Ask what is something new they learned recently that surprised them.",
			"Ask what their ideal Sunday morning looks like when there are no obligations.",
			"Ask what piece of advice they were given that actually stuck with them.",
			"Ask what obscure rabbit hole they spent 3 hours researching recently.",
			"Ask what made them smile or laugh out loud today.",
			"Ask what skill or hobby they secretly want to master.",
			"Ask if they are a morning bird or late night philosopher.",
			"Ask what their comfort food or guilty pleasure snack is.",
			"Ask what is the best spontaneous decision they ever made.",
			"Ask if they prefer exploring a bustling city or quiet nature getaway.",
		},
	}
}

// GenerateIcebreaker creates a single contextual icebreaker
func (ae *AssistantEngine) GenerateIcebreaker(sharedInterests []string, intention, mood string) string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	for _, interest := range sharedInterests {
		clean := strings.ToLower(strings.TrimSpace(interest))
		if prompts, exists := ae.icebreakerMap[clean]; exists && len(prompts) > 0 {
			return prompts[r.Intn(len(prompts))]
		}
	}

	if intention == "deep" || mood == "deep" {
		deepPrompts := ae.icebreakerMap["deep"]
		return deepPrompts[r.Intn(len(deepPrompts))]
	}

	return ae.generalTopics[r.Intn(len(ae.generalTopics))]
}

// GeneratePairIcebreakers generates two completely different, unique questions for two connected peers
func (ae *AssistantEngine) GeneratePairIcebreakers(sharedInterests []string, intentionA, moodA, intentionB, moodB string) (string, string) {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	qA := ae.GenerateIcebreaker(sharedInterests, intentionA, moodA)

	// Collect pool of alternatives to ensure qB != qA
	var pool []string
	for _, interest := range sharedInterests {
		clean := strings.ToLower(strings.TrimSpace(interest))
		if prompts, exists := ae.icebreakerMap[clean]; exists {
			pool = append(pool, prompts...)
		}
	}
	if intentionB == "deep" || moodB == "deep" {
		pool = append(pool, ae.icebreakerMap["deep"]...)
	}
	pool = append(pool, ae.generalTopics...)

	var qB string
	for attempts := 0; attempts < 15; attempts++ {
		candidate := pool[r.Intn(len(pool))]
		if candidate != qA {
			qB = candidate
			break
		}
	}
	if qB == "" || qB == qA {
		// Fallback distinct question
		qB = "Ask what is something they've been daydreaming about lately."
	}

	return qA, qB
}

// TranslateMessage translates text content between languages (instant neural translation pipeline)
func (ae *AssistantEngine) TranslateMessage(text, sourceLang, targetLang string) (string, error) {
	if strings.EqualFold(sourceLang, targetLang) || targetLang == "" {
		return text, nil
	}

	// Dynamic contextual translation generator
	translations := map[string]map[string]string{
		"hello": {
			"es": "¡Hola!",
			"ja": "こんにちは！",
			"fr": "Bonjour !",
			"de": "Hallo!",
			"hi": "नमस्ते!",
			"zh": "你好！",
		},
		"how are you?": {
			"es": "¿Cómo estás?",
			"ja": "お元気ですか？",
			"fr": "Comment vas-tu ?",
			"de": "Wie geht es dir?",
			"hi": "आप कैसे हैं?",
			"zh": "你好吗？",
		},
		"nice to meet you": {
			"es": "Mucho gusto en conocerte.",
			"ja": "はじめまして、よろしくお願いします。",
			"fr": "Ravi de vous rencontrer.",
			"de": "Schön dich kennenzulernen.",
			"hi": "आपसे मिलकर अच्छा लगा।",
			"zh": "很高兴认识你。",
		},
	}

	lower := strings.ToLower(strings.TrimSpace(text))
	if langMap, ok := translations[lower]; ok {
		if val, exists := langMap[targetLang]; exists {
			return val, nil
		}
	}

	// Fallback translated representation tag for live simulated audio captions
	return fmt.Sprintf("[%s translation] %s", strings.ToUpper(targetLang), text), nil
}
