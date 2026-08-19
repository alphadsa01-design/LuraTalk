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
	GameWouldYouRather  GameType = "would_you_rather"
	GameTrivia          GameType = "trivia"
	GameTwoTruths       GameType = "two_truths"
	GameTwentyQuestions GameType = "twenty_questions"
)

type GameSession struct {
	GameID       string                 `json:"gameId"`
	RoomName     string                 `json:"roomName"`
	GameType     GameType               `json:"gameType"`
	Players      []string               `json:"players"`      // userIDs [player1, player2]
	Turn         string                 `json:"turn"`         // current userID
	Status       string                 `json:"status"`       // "in_progress", "won", "draw"
	Winner       string                 `json:"winner,omitempty"`
	Board        [9]string              `json:"board,omitempty"` // For Tic-Tac-Toe
	Scores       map[string]int         `json:"scores"`
	CustomData   map[string]interface{} `json:"customData"`
	UpdatedAt    time.Time              `json:"updatedAt"`
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

var wyrCards = []map[string]string{
	{"optionA": "Travel 100 years into the future", "optionB": "Travel 100 years into the past"},
	{"optionA": "Never have to sleep again with full energy", "optionB": "Never have to work again with unlimited funds"},
	{"optionA": "Explore the deepest depths of the ocean", "optionB": "Explore uncharted alien planets in deep space"},
	{"optionA": "Speak all human languages fluently", "optionB": "Speak and understand all animal languages"},
	{"optionA": "Always know when someone is lying", "optionB": "Always get away with any harmless lie"},
	{"optionA": "Live in a futuristic cyberpunk metropolis", "optionB": "Live in a tranquil cozy fantasy village with magic"},
}

var triviaQuestions = []map[string]interface{}{
	{
		"question": "Which planet in our solar system spins clockwise (retrograde rotation)?",
		"options":  []string{"Venus", "Mars", "Jupiter", "Neptune"},
		"answer":   0,
	},
	{
		"question": "What is the fastest land animal in the world?",
		"options":  []string{"Cheetah", "Pronghorn Antelope", "Lion", "Peregrine Falcon"},
		"answer":   0,
	},
	{
		"question": "In computer science, what does 'HTTP' stand for?",
		"options":  []string{"HyperText Transfer Protocol", "High Time Transfer Port", "Hyperlink Transit Program", "Host Text Transmission Process"},
		"answer":   0,
	},
	{
		"question": "Which programming language was created by Brendan Eich in 10 days in 1995?",
		"options":  []string{"JavaScript", "Python", "Ruby", "PHP"},
		"answer":   0,
	},
	{
		"question": "What year was the original Nintendo Game Boy released?",
		"options":  []string{"1989", "1985", "1991", "1993"},
		"answer":   0,
	},
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
	case GameWouldYouRather:
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		card := wyrCards[r.Intn(len(wyrCards))]
		session.CustomData["card"] = card
		session.CustomData["votes"] = make(map[string]string)
	case GameTrivia:
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		q := triviaQuestions[r.Intn(len(triviaQuestions))]
		session.CustomData["question"] = q
		session.CustomData["answers"] = make(map[string]int)
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
			var cell int = -1
			if cf, ok := payload["cell"].(float64); ok {
				cell = int(cf)
			} else if ci, ok := payload["cell"].(int); ok {
				cell = ci
			}

			if cell < 0 || cell > 8 || session.Board[cell] != "" || session.Status != "in_progress" {
				return session, nil
			}

			// Strict turn validation according to Tic-Tac-Toe rules
			if session.Turn != "" && session.Turn != userID && len(session.Players) > 1 {
				return session, nil
			}

			symbol := "X"
			if len(session.Players) > 1 && userID == session.Players[1] {
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
		} else if actionType == "reset" {
			session.Board = [9]string{}
			session.Status = "in_progress"
			session.Winner = ""
			// Alternate starting player on rematch
			if len(session.Players) > 1 {
				if session.Turn == session.Players[0] {
					session.Turn = session.Players[1]
				} else {
					session.Turn = session.Players[0]
				}
			}
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
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			card := wyrCards[r.Intn(len(wyrCards))]
			session.CustomData["card"] = card
			session.CustomData["votes"] = make(map[string]string)
			session.Status = "in_progress"
		}

	case GameTrivia:
		if actionType == "answer" {
			var ans int = -1
			if ansFloat, ok := payload["optionIndex"].(float64); ok {
				ans = int(ansFloat)
			} else if ansInt, ok := payload["optionIndex"].(int); ok {
				ans = ansInt
			}
			answers, ok := session.CustomData["answers"].(map[string]int)
			if !ok {
				answers = make(map[string]int)
			}
			answers[userID] = ans
			session.CustomData["answers"] = answers

			if len(answers) >= 2 || len(answers) >= len(session.Players) {
				session.Status = "completed"
			}
		} else if actionType == "next" {
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			q := triviaQuestions[r.Intn(len(triviaQuestions))]
			session.CustomData["question"] = q
			session.CustomData["answers"] = make(map[string]int)
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
