package games

import (
	"math/rand"
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
	Players    []string               `json:"players"`    // userIDs [player1, player2]
	Turn       string                 `json:"turn"`       // current userID
	Status     string                 `json:"status"`     // "in_progress", "won", "draw"
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

var darkQuestions = []map[string]string{
	{
		"category": "🔥 Dark Truths",
		"question": "What is a secret you will take to the grave if nobody ever forces you to speak?",
		"tag":      "Unfiltered Secret",
	},
	{
		"category": "🧠 Moral Dilemma",
		"question": "If you received $20 Million tax-free, but a random stranger somewhere dies, would you press the button?",
		"tag":      "High Stakes",
	},
	{
		"category": "💔 Secrets & Regrets",
		"question": "Have you ever secretly felt satisfied or happy about someone else's downfall or failure?",
		"tag":      "Guilty Confession",
	},
	{
		"category": "👁️ Existential",
		"question": "Would you rather know the exact date and time of your death, or the exact cause?",
		"tag":      "Fate & Destiny",
	},
	{
		"category": "🔥 Dark Truths",
		"question": "What is the most manipulative thing you have ever done to get what you wanted?",
		"tag":      "Unfiltered Truth",
	},
	{
		"category": "🧠 Moral Dilemma",
		"question": "If you could erase one person from your past as if they never existed with zero consequences, would you do it?",
		"tag":      "Erase the Past",
	},
	{
		"category": "💀 Psychology",
		"question": "What is a toxic personality trait you know you have, but secretly kind of enjoy?",
		"tag":      "Shadow Self",
	},
	{
		"category": "💔 Secrets & Regrets",
		"question": "Have you ever stayed with someone or pretended to care just because you were terrified of being alone?",
		"tag":      "Raw Honesty",
	},
	{
		"category": "👁️ Existential",
		"question": "Would you rather live a 100% happy life inside a fake simulation, or endure painful truths in reality?",
		"tag":      "Simulation vs Reality",
	},
	{
		"category": "🔥 Dark Truths",
		"question": "If everyone in your life could hear your raw, uncensored inner thoughts for 2 minutes, who would leave first?",
		"tag":      "Mind Unlocked",
	},
	{
		"category": "🧠 Moral Dilemma",
		"question": "Would you rather betray your best friend to save your career, or ruin your career to keep their secret safe?",
		"tag":      "Loyalty Test",
	},
	{
		"category": "💀 Psychology",
		"question": "What is something you did in your past that still occasionally haunts you when you try to sleep at night?",
		"tag":      "Midnight Thoughts",
	},
	{
		"category": "🔥 Dark Truths",
		"question": "Have you ever ghosted someone who genuinely loved or cared for you, knowing it would break them?",
		"tag":      "Hard Truth",
	},
	{
		"category": "👁️ Existential",
		"question": "If you died tonight, what is the single file, item, or chat on your phone you would pray nobody ever discovers?",
		"tag":      "Digital Graveyard",
	},
	{
		"category": "🧠 Moral Dilemma",
		"question": "If you had 24 hours where absolutely nothing you did had legal or social consequences, what would you honestly do?",
		"tag":      "The Purge Rule",
	},
	{
		"category": "💔 Secrets & Regrets",
		"question": "What was the exact moment in your life where you realized you had lost your childhood innocence?",
		"tag":      "Turning Point",
	},
	{
		"category": "💀 Psychology",
		"question": "Do you believe humans are fundamentally selfish and good only when watched, or inherently compassionate?",
		"tag":      "Human Nature",
	},
	{
		"category": "🔥 Dark Truths",
		"question": "What is a lie you told that spiraled so out of control that you had to create a completely fake backstory?",
		"tag":      "Deep Web of Lies",
	},
	{
		"category": "🧠 Moral Dilemma",
		"question": "Would you rather be universally loved for a fake persona, or hated by everyone for who you truly are?",
		"tag":      "Authenticity vs Acceptance",
	},
	{
		"category": "👁️ Existential",
		"question": "If you found out tomorrow that your entire life up to this second was an elaborate psychological experiment, what is your next move?",
		"tag":      "The Truman Effect",
	},
}

var wyrCards = []map[string]string{
	{"optionA": "Always know when someone is lying to you", "optionB": "Always get away with any lie you tell with 100% belief"},
	{"optionA": "Know the exact date and time of your death", "optionB": "Know the exact cause of your death with no timestamp"},
	{"optionA": "Travel 100 years into the future", "optionB": "Travel 100 years into the past with full modern knowledge"},
	{"optionA": "Never have to sleep again with full energy", "optionB": "Never have to work again with unlimited funds"},
	{"optionA": "Erase your worst mistake from everyone's memory", "optionB": "Receive $5 Million but keep the memory intact"},
	{"optionA": "Have all your private search history leaked to your contacts", "optionB": "Never be able to use the internet again for life"},
	{"optionA": "Be able to read everyone's mind without turning it off", "optionB": "Have everyone hear your thoughts whenever they look at you"},
	{"optionA": "Speak all human languages fluently", "optionB": "Speak and understand all animal languages"},
}

// StartGame initializes a new synchronized multiplayer game in a call room
func (gm *GameManager) StartGame(roomName string, gType GameType, player1, player2 string) *GameSession {
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
	case GameDarkQuestions:
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		q := darkQuestions[r.Intn(len(darkQuestions))]
		session.CustomData["question"] = q
		session.CustomData["reactions"] = make(map[string]string)
	case GameWouldYouRather:
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		card := wyrCards[r.Intn(len(wyrCards))]
		session.CustomData["card"] = card
		session.CustomData["votes"] = make(map[string]string)
	case GameTwentyQuestions:
		session.CustomData["questionsLeft"] = 20
		session.CustomData["history"] = []map[string]string{}
	}

	gm.sessions[roomName] = session
	return session
}

// HandleAction processes a move / guess / vote from a player
func (gm *GameManager) HandleAction(roomName, userID string, actionType string, payload map[string]interface{}) (*GameSession, error) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	session, exists := gm.sessions[roomName]
	if !exists {
		return nil, nil
	}

	session.UpdatedAt = time.Now().UTC()

	switch session.GameType {
	case GameTicTacToe:
		if actionType == "move" {
			// If client provided full verified board state, adopt it directly
			if bRaw, ok := payload["board"].([]interface{}); ok && len(bRaw) == 9 {
				for i, v := range bRaw {
					if s, ok := v.(string); ok {
						session.Board[i] = s
					}
				}
				if st, ok := payload["status"].(string); ok && st != "" {
					session.Status = st
				}
				if wn, ok := payload["winner"].(string); ok {
					session.Winner = wn
					if wn != "" {
						session.Scores[userID]++
					}
				}
				// Switch turn to opposing player
				if len(session.Players) > 1 {
					if session.Turn == session.Players[0] {
						session.Turn = session.Players[1]
					} else {
						session.Turn = session.Players[0]
					}
				}
				return session, nil
			}

			var cell int = -1
			if cf, ok := payload["cell"].(float64); ok {
				cell = int(cf)
			} else if ci, ok := payload["cell"].(int); ok {
				cell = ci
			}

			if cell >= 0 && cell <= 8 && session.Board[cell] == "" && session.Status == "in_progress" {
				symbol := "X"
				if sym, ok := payload["symbol"].(string); ok && (sym == "X" || sym == "O") {
					symbol = sym
				} else if len(session.Players) > 1 && userID == session.Players[1] {
					symbol = "O"
				}

				session.Board[cell] = symbol

				// Check winner across 3 rows, 3 columns, and 2 diagonals
				if checkTicTacToeWinner(session.Board, symbol) {
					session.Status = "won"
					session.Winner = userID
					session.Scores[userID]++
				} else if isBoardFull(session.Board) {
					session.Status = "draw"
				} else {
					// Switch turn to opposing player
					if len(session.Players) > 1 {
						if session.Turn == session.Players[0] {
							session.Turn = session.Players[1]
						} else {
							session.Turn = session.Players[0]
						}
					}
				}
			}
		} else if actionType == "reset" {
			session.Board = [9]string{}
			session.Status = "in_progress"
			session.Winner = ""
			if len(session.Players) > 1 {
				session.Turn = session.Players[0]
			}
		}

	case GameDarkQuestions:
		if actionType == "next" {
			// If client provided a specific question in payload, adopt it directly to maintain exact sync
			if qRaw, ok := payload["question"].(map[string]interface{}); ok && qRaw["question"] != nil {
				session.CustomData["question"] = qRaw
			} else {
				r := rand.New(rand.NewSource(time.Now().UnixNano()))
				q := darkQuestions[r.Intn(len(darkQuestions))]
				session.CustomData["question"] = q
			}
			session.CustomData["reactions"] = make(map[string]string)
			session.Status = "in_progress"
		} else if actionType == "react" {
			reaction, _ := payload["reaction"].(string)
			reactions, ok := session.CustomData["reactions"].(map[string]string)
			if !ok {
				reactions = make(map[string]string)
			}
			reactions[userID] = reaction
			session.CustomData["reactions"] = reactions
		}

	case GameWouldYouRather:
		if actionType == "vote" {
			vote, _ := payload["option"].(string)
			votes, ok := session.CustomData["votes"].(map[string]string)
			if !ok {
				votes = make(map[string]string)
			}
			votes[userID] = vote
			session.CustomData["votes"] = votes

			// Reveal if 2 players or solo test
			if len(votes) >= 2 || len(votes) >= len(session.Players) {
				session.Status = "completed"
			}
		} else if actionType == "next" {
			// If client provided a specific card in payload, adopt it directly to maintain exact sync
			if cRaw, ok := payload["card"].(map[string]interface{}); ok && cRaw["optionA"] != nil {
				session.CustomData["card"] = cRaw
			} else {
				r := rand.New(rand.NewSource(time.Now().UnixNano()))
				card := wyrCards[r.Intn(len(wyrCards))]
				session.CustomData["card"] = card
			}
			session.CustomData["votes"] = make(map[string]string)
			session.Status = "in_progress"
		}
	}

	return session, nil
}

func (gm *GameManager) GetSession(roomName string) *GameSession {
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	return gm.sessions[roomName]
}

func checkTicTacToeWinner(board [9]string, s string) bool {
	lines := [][]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // Rows
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // Cols
		{0, 4, 8}, {2, 4, 6},             // Diagonals
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
