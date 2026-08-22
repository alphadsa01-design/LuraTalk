package realtime

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 64 * 1024 // 64 KB strict maximum payload to prevent buffer attacks
)

type Client struct {
	Hub          *Hub
	Conn         *websocket.Conn
	Send         chan []byte
	UserID       string
	Username     string
	AvatarID     string
	ActiveRoom   string
	MysteryLevel int // 1: anonymous, 2: shared interests, 3: full profile
	mu           sync.Mutex
	isClosed     bool

	// Inbound message flood protection
	msgCount    int
	windowStart time.Time
}

func (c *Client) CloseSend() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.isClosed {
		c.isClosed = true
		close(c.Send)
	}
}

type WSMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	c.windowStart = time.Now()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS client error %s: %v", c.UserID, err)
			}
			break
		}

		// Inbound flood rate check: max 40 messages per second per client
		now := time.Now()
		if now.Sub(c.windowStart) > time.Second {
			c.msgCount = 1
			c.windowStart = now
		} else {
			c.msgCount++
			if c.msgCount > 40 {
				log.Printf("WS rate limit exceeded for user %s, terminating connection", c.UserID)
				c.SendJSON("safety:alert", map[string]string{
					"message": "Connection closed due to rate limit violation.",
				})
				break
			}
		}

		var wsMsg WSMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			continue
		}

		// Message validation & authorization
		if wsMsg.Type == "" {
			continue
		}

		c.Hub.HandleClientMessage(c, wsMsg)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) SendJSON(msgType string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	wsMsg := WSMessage{
		Type:    msgType,
		Payload: data,
	}
	msgBytes, err := json.Marshal(wsMsg)
	if err != nil {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.isClosed {
		return
	}

	select {
	case c.Send <- msgBytes:
	default:
		log.Printf("WS buffer full for user %s, dropped message", c.UserID)
	}
}
