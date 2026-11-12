package games

import (
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type GameType string

const (
	GameTicTacToe       GameType = "tictactoe"
	GameDarkQuestions   GameType = "dark_questions"
	GameWouldYouRather  GameType = "would_you_rather"
	GameTwoTruths       GameType = "two_truths"
	GameTwentyQuestions GameType = "twenty_questions"
)

type GameSession struct {
	GameID     string                 `json:"gameId"`
	RoomName   string                 `json:"roomName"`
	GameType   GameType               `json:"gameType"`
	Players    []string               `json:"players"` // userIDs [player1, player2]
	Turn       string                 `json:"turn"`    // current userID
	Status     string                 `json:"status"`  // "in_progress", "won", "draw"
	Winner     string                 `json:"winner,omitempty"`
	Board      [9]string              `json:"board"` // For Tic-Tac-Toe
	Scores     map[string]int         `json:"scores"`
	CustomData map[string]interface{} `json:"customData"`
	UpdatedAt  time.Time              `json:"updatedAt"`
}

type GameManager struct {
	sessions map[string]*GameSession // key: roomName
	mu       sync.RWMutex
}

func NewGameManager() *GameManager {
	return &GameManager{
		sessions: make(map[string]*GameSession),
	}
}

// Fallback decks (keep in sync with apps/web/src/lib/gameDecks.ts). Players are anonymous
// strangers of unknown age: bold and fun, never sexual or harmful.
var darkQuestions = []map[string]string{
	{"category": "Deep Talk", "tag": "Turning Point", "question": "What is a moment that quietly changed the direction of your life?"},
	{"category": "Deep Talk", "tag": "Inner Voice", "question": "What is something you believe now that you would have argued against five years ago?"},
	{"category": "Deep Talk", "tag": "Comfort", "question": "What makes you feel most at home, even when you are far from home?"},
	{"category": "Deep Talk", "tag": "Proud Of", "question": "What are you secretly proud of that nobody ever compliments you on?"},
	{"category": "Deep Talk", "tag": "Lessons", "question": "What is a lesson you had to learn twice before it finally stuck?"},
	{"category": "Deep Talk", "tag": "Fear", "question": "What is a fear you have that you wish you could just switch off?"},
	{"category": "Deep Talk", "tag": "Younger You", "question": "What would your 10-year-old self think of who you are today?"},
	{"category": "Deep Talk", "tag": "Energy", "question": "What drains your energy faster than anything else, and what refills it?"},
	{"category": "Deep Talk", "tag": "Misunderstood", "question": "What is something people often get wrong about you on first impression?"},
	{"category": "Deep Talk", "tag": "Gratitude", "question": "Who is someone who helped you more than they will ever know?"},
	{"category": "Deep Talk", "tag": "Meaning", "question": "What does a \"good life\" actually look like to you?"},
	{"category": "Deep Talk", "tag": "Letting Go", "question": "What is something you finally stopped caring about, and how did it feel?"},
	{"category": "Hot Takes", "tag": "Unpopular Opinion", "question": "What is an opinion you hold that would start an argument at a family dinner?"},
	{"category": "Hot Takes", "tag": "Overrated", "question": "What is something everyone loves that you honestly think is overrated?"},
	{"category": "Hot Takes", "tag": "Underrated", "question": "What is something totally underrated that more people should try?"},
	{"category": "Hot Takes", "tag": "Hill to Die On", "question": "What is a tiny, silly thing you will defend until the end?"},
	{"category": "Hot Takes", "tag": "Pet Peeve", "question": "What small habit in other people instantly annoys you?"},
	{"category": "Hot Takes", "tag": "Internet", "question": "What is a trend you hope disappears forever?"},
	{"category": "Hot Takes", "tag": "Food Fight", "question": "What food combination do you love that most people find weird?"},
	{"category": "Hot Takes", "tag": "Movie Take", "question": "Which famous movie or show do you think nobody actually enjoys?"},
	{"category": "Confessions", "tag": "Guilty Pleasure", "question": "What is your most embarrassing guilty-pleasure song, show or snack?"},
	{"category": "Confessions", "tag": "Little Lie", "question": "What is a harmless lie you have told so often it basically became true?"},
	{"category": "Confessions", "tag": "Cringe", "question": "What is a past phase of yours that makes you cringe now?"},
	{"category": "Confessions", "tag": "Bad Habit", "question": "What is a bad habit you have totally made peace with?"},
	{"category": "Confessions", "tag": "Close Call", "question": "What is the closest you have come to getting into serious trouble as a kid?"},
	{"category": "Confessions", "tag": "Secret Skill", "question": "What is a weirdly specific skill you have that nobody would guess?"},
	{"category": "Confessions", "tag": "Pretending", "question": "What is something you pretend to understand but secretly do not?"},
	{"category": "Confessions", "tag": "Petty", "question": "What is the pettiest thing you have ever done that you are still a little proud of?"},
	{"category": "Confessions", "tag": "Never Told", "question": "What is a funny story you have never told anyone because no one asked?"},
	{"category": "What If", "tag": "Superpower", "question": "If you could have one useless superpower, what would it be?"},
	{"category": "What If", "tag": "Time Machine", "question": "If you could relive one ordinary day of your life, which would you pick?"},
	{"category": "What If", "tag": "Fresh Start", "question": "If you could restart somewhere new tomorrow with zero consequences, where would you go?"},
	{"category": "What If", "tag": "Billboard", "question": "If you could put one sentence on a billboard seen by millions, what would it say?"},
	{"category": "What If", "tag": "Swap", "question": "If you could swap lives with anyone for one week, who would it be and why?"},
	{"category": "What If", "tag": "Skill Download", "question": "If you could instantly master one skill, what would you choose?"},
	{"category": "What If", "tag": "Last Meal", "question": "If you could only eat one cuisine for the rest of your life, which one?"},
	{"category": "What If", "tag": "Famous", "question": "If you became famous tomorrow, what would you most likely be famous for?"},
	{"category": "What If", "tag": "Rulebook", "question": "If you made one law everyone had to follow, what would it be?"},
	{"category": "Dilemmas", "tag": "Honesty Test", "question": "You find a wallet with cash and an ID. Would you return the money too, honestly?"},
	{"category": "Dilemmas", "tag": "Loyalty", "question": "Would you tell a close friend a painful truth if it might end the friendship?"},
	{"category": "Dilemmas", "tag": "Fame vs Peace", "question": "Would you take huge success if it meant losing most of your privacy?"},
	{"category": "Dilemmas", "tag": "Knowledge", "question": "Would you want to know what people really think of you, even the harsh parts?"},
	{"category": "Dilemmas", "tag": "Second Chances", "question": "Is there anything that is truly unforgivable to you?"},
	{"category": "Dilemmas", "tag": "Fairness", "question": "Is it ever okay to break a rule if nobody gets hurt?"},
	{"category": "Dilemmas", "tag": "Memory", "question": "Would you erase your most embarrassing memory if it also erased what it taught you?"},
	{"category": "Dreams", "tag": "Bucket List", "question": "What is one thing you really want to do before you are old?"},
	{"category": "Dreams", "tag": "Dream Job", "question": "If money did not matter, what would you do all day?"},
	{"category": "Dreams", "tag": "Someday", "question": "What is a place you have always dreamed of visiting, and what is stopping you?"},
	{"category": "Dreams", "tag": "Legacy", "question": "What would you like people to say about you when you are not in the room?"},
	{"category": "Dreams", "tag": "Next Year", "question": "What is one thing you hope is different in your life a year from now?"},
}

var wyrCards = []map[string]string{
	{"optionA": "Always know when someone is lying to you", "optionB": "Always get away with any lie you tell"},
	{"optionA": "Travel 100 years into the future", "optionB": "Travel 100 years into the past"},
	{"optionA": "Never need to sleep again", "optionB": "Never need to eat again"},
	{"optionA": "Speak every human language fluently", "optionB": "Understand what animals are saying"},
	{"optionA": "Have your search history made public", "optionB": "Have your camera roll made public"},
	{"optionA": "Be able to pause time", "optionB": "Be able to rewind time by 10 seconds"},
	{"optionA": "Live in a big city forever", "optionB": "Live in a quiet village forever"},
	{"optionA": "Be famous but misunderstood", "optionB": "Be unknown but truly understood"},
	{"optionA": "Lose all your old photos", "optionB": "Lose all your old messages"},
	{"optionA": "Have a rewind button for your life", "optionB": "Have a pause button for your life"},
	{"optionA": "Always say exactly what you think", "optionB": "Never be able to speak your mind"},
	{"optionA": "Know how every movie ends before watching", "optionB": "Never be able to rewatch anything"},
	{"optionA": "Have unlimited free flights", "optionB": "Have unlimited free food"},
	{"optionA": "Be the funniest person in the room", "optionB": "Be the smartest person in the room"},
	{"optionA": "Be stuck in an elevator with your ex", "optionB": "Be stuck in an elevator with your boss"},
	{"optionA": "Give up music forever", "optionB": "Give up movies and shows forever"},
	{"optionA": "Read minds but never turn it off", "optionB": "Be invisible but only when nobody is looking"},
	{"optionA": "Win the lottery once", "optionB": "Live twice as long"},
	{"optionA": "Have a personal chef", "optionB": "Have a personal driver"},
	{"optionA": "Only whisper for a year", "optionB": "Only shout for a year"},
	{"optionA": "Know the truth about one historical mystery", "optionB": "See one event 50 years in the future"},
	{"optionA": "Be a master of every instrument", "optionB": "Be a master of every sport"},
	{"optionA": "Live without the internet", "optionB": "Live without air conditioning and heating"},
	{"optionA": "Restart your life at 10 with your memories", "optionB": "Skip ahead 10 years right now"},
	{"optionA": "Have a dragon", "optionB": "Be a dragon"},
	{"optionA": "Always be 10 minutes late", "optionB": "Always be 30 minutes early"},
	{"optionA": "Only eat sweet food forever", "optionB": "Only eat salty food forever"},
	{"optionA": "Explore the deep ocean", "optionB": "Explore outer space"},
	{"optionA": "Have your life narrated out loud", "optionB": "Have a soundtrack only you can hear"},
	{"optionA": "Forget who you are for a day", "optionB": "Everyone else forgets who you are for a day"},
}

// maxCustomTextLen bounds client-supplied question / card text.
const maxCustomTextLen = 300

// Allowed reactions for the questions game.
var allowedReactions = map[string]bool{"🔥": true, "😂": true, "😱": true, "🤔": true, "🤯": true, "❤️": true}

func cleanText(v interface{}) (string, bool) {
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	s = strings.TrimSpace(strings.ReplaceAll(s, "\x00", ""))
	if s == "" {
		return "", false
	}
	if r := []rune(s); len(r) > maxCustomTextLen {
		s = string(r[:maxCustomTextLen])
	}
	return s, true
}

// sanitizeQuestion accepts a client-picked question only if it has the expected shape.
func sanitizeQuestion(raw interface{}) (map[string]string, bool) {
	m, ok := raw.(map[string]interface{})
	if !ok {
		return nil, false
	}
	q, ok := cleanText(m["question"])
	if !ok {
		return nil, false
	}
	out := map[string]string{"question": q, "category": "Deep Talk", "tag": ""}
	if c, ok := cleanText(m["category"]); ok {
		out["category"] = c
	}
	if t, ok := cleanText(m["tag"]); ok {
		out["tag"] = t
	}
	return out, true
}

// sanitizeCard accepts a client-picked Would You Rather card only if both options are present.
func sanitizeCard(raw interface{}) (map[string]string, bool) {
	m, ok := raw.(map[string]interface{})
	if !ok {
		return nil, false
	}
	a, okA := cleanText(m["optionA"])
	b, okB := cleanText(m["optionB"])
	if !okA || !okB {
		return nil, false
	}
	return map[string]string{"optionA": a, "optionB": b}, true
}

func randomQuestion() map[string]string {
	q := darkQuestions[rand.Intn(len(darkQuestions))]
	return map[string]string{"category": q["category"], "question": q["question"], "tag": q["tag"]}
}

func randomCard() map[string]string {
	c := wyrCards[rand.Intn(len(wyrCards))]
	return map[string]string{"optionA": c["optionA"], "optionB": c["optionB"]}
}

func isSupported(t GameType) bool {
	switch t {
	case GameTicTacToe, GameDarkQuestions, GameWouldYouRather:
		return true
	}
	return false
}

// StartGame initializes a new synchronized game in a call room and returns a snapshot.
// The starter plays X and moves first in Tic-Tac-Toe. data may carry a client-picked
// "question" / "card" (validated). Returns nil for unsupported game types.
func (gm *GameManager) StartGame(roomName string, gType GameType, player1, player2 string, data map[string]interface{}) *GameSession {
	if !isSupported(gType) {
		return nil
	}
	gm.mu.Lock()
	defer gm.mu.Unlock()

	session := &GameSession{
		GameID:     uuid.New().String(),
		RoomName:   roomName,
		GameType:   gType,
		Players:    []string{player1, player2},
		Turn:       player1,
		Status:     "in_progress",
		Scores:     map[string]int{player1: 0, player2: 0},
		CustomData: make(map[string]interface{}),
		UpdatedAt:  time.Now().UTC(),
	}

	switch gType {
	case GameTicTacToe:
		session.Board = [9]string{}
		session.CustomData["symbols"] = map[string]string{player1: "X", player2: "O"}
	case GameDarkQuestions:
		q, ok := sanitizeQuestion(data["question"])
		if !ok {
			q = randomQuestion()
		}
		session.CustomData["question"] = q
		session.CustomData["reactions"] = map[string]string{}
	case GameWouldYouRather:
		c, ok := sanitizeCard(data["card"])
		if !ok {
			c = randomCard()
		}
		session.CustomData["card"] = c
		session.CustomData["votes"] = map[string]string{}
	}

	gm.sessions[roomName] = session
	return session.snapshot()
}

func (s *GameSession) isPlayer(userID string) bool {
	for _, p := range s.Players {
		if p == userID {
			return true
		}
	}
	return false
}

func (s *GameSession) otherPlayer(userID string) string {
	for _, p := range s.Players {
		if p != userID {
			return p
		}
	}
	return userID
}

// snapshot returns a deep copy safe to serialize after the lock is released.
func (s *GameSession) snapshot() *GameSession {
	cp := *s
	cp.Players = append([]string(nil), s.Players...)
	cp.Scores = make(map[string]int, len(s.Scores))
	for k, v := range s.Scores {
		cp.Scores[k] = v
	}
	cp.CustomData = make(map[string]interface{}, len(s.CustomData))
	for k, v := range s.CustomData {
		if m, ok := v.(map[string]string); ok {
			mc := make(map[string]string, len(m))
			for mk, mv := range m {
				mc[mk] = mv
			}
			cp.CustomData[k] = mc
		} else {
			cp.CustomData[k] = v
		}
	}
	return &cp
}

// HandleAction processes a move / vote / reaction from a player. The server is
// authoritative: client-sent boards, winners or statuses are never trusted.
// It returns a snapshot of the (possibly unchanged) session so clients resync even
// when an action is rejected, or nil when no game is running in the room.
func (gm *GameManager) HandleAction(roomName, userID string, actionType string, payload map[string]interface{}) (*GameSession, error) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	session, exists := gm.sessions[roomName]
	if !exists {
		return nil, nil
	}
	if !session.isPlayer(userID) {
		return session.snapshot(), nil
	}
	if payload == nil {
		payload = map[string]interface{}{}
	}

	session.UpdatedAt = time.Now().UTC()

	switch session.GameType {
	case GameTicTacToe:
		symbols, _ := session.CustomData["symbols"].(map[string]string)
		switch actionType {
		case "move":
			cell := -1
			if cf, ok := payload["cell"].(float64); ok && cf == float64(int(cf)) {
				cell = int(cf)
			}
			symbol := symbols[userID]
			if session.Status != "in_progress" || session.Turn != userID || symbol == "" ||
				cell < 0 || cell > 8 || session.Board[cell] != "" {
				break // invalid: snapshot below resyncs the client
			}
			session.Board[cell] = symbol
			if checkTicTacToeWinner(session.Board, symbol) {
				session.Status = "won"
				session.Winner = userID
				session.Scores[userID]++
			} else if isBoardFull(session.Board) {
				session.Status = "draw"
			} else {
				session.Turn = session.otherPlayer(userID)
			}
		case "reset":
			// Swap symbols each round so both players get to go first; X always starts
			for uid, sym := range symbols {
				if sym == "X" {
					symbols[uid] = "O"
				} else {
					symbols[uid] = "X"
				}
			}
			for uid, sym := range symbols {
				if sym == "X" {
					session.Turn = uid
				}
			}
			session.Board = [9]string{}
			session.Status = "in_progress"
			session.Winner = ""
		}

	case GameDarkQuestions:
		switch actionType {
		case "next":
			q, ok := sanitizeQuestion(payload["question"])
			if !ok {
				q = randomQuestion()
			}
			session.CustomData["question"] = q
			session.CustomData["reactions"] = map[string]string{}
			session.Status = "in_progress"
		case "react":
			reaction, _ := payload["reaction"].(string)
			if !allowedReactions[reaction] {
				break
			}
			reactions, ok := session.CustomData["reactions"].(map[string]string)
			if !ok {
				reactions = map[string]string{}
				session.CustomData["reactions"] = reactions
			}
			reactions[userID] = reaction
		}

	case GameWouldYouRather:
		switch actionType {
		case "vote":
			vote, _ := payload["option"].(string)
			if (vote != "optionA" && vote != "optionB") || session.Status == "completed" {
				break
			}
			votes, ok := session.CustomData["votes"].(map[string]string)
			if !ok {
				votes = map[string]string{}
				session.CustomData["votes"] = votes
			}
			votes[userID] = vote
			// Reveal once every real player has voted
			if len(votes) >= len(session.Players) {
				session.Status = "completed"
			}
		case "next":
			c, ok := sanitizeCard(payload["card"])
			if !ok {
				c = randomCard()
			}
			session.CustomData["card"] = c
			session.CustomData["votes"] = map[string]string{}
			session.Status = "in_progress"
		}
	}

	return session.snapshot(), nil
}

// EndGame discards the game of a room (called when the call ends).
func (gm *GameManager) EndGame(roomName string) {
	gm.mu.Lock()
	defer gm.mu.Unlock()
	delete(gm.sessions, roomName)
}

func (gm *GameManager) GetSession(roomName string) *GameSession {
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	if s := gm.sessions[roomName]; s != nil {
		return s.snapshot()
	}
	return nil
}

func checkTicTacToeWinner(board [9]string, s string) bool {
	lines := [][]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // Rows
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // Cols
		{0, 4, 8}, {2, 4, 6}, // Diagonals
	}
	for _, l := range lines {
		if board[l[0]] == s && board[l[1]] == s && board[l[2]] == s {
			return true
		}
	}
	return false
}

func isBoardFull(board [9]string) bool {
	for _, c := range board {
		if c == "" {
			return false
		}
	}
	return true
}
