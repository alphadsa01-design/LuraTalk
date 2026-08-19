package realtime

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"airtak/services/api/internal/ai"
	"airtak/services/api/internal/auth"
	"airtak/services/api/internal/config"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/games"
	"airtak/services/api/internal/livekit"
	"airtak/services/api/internal/matchmaking"
	"airtak/services/api/internal/models"
	"airtak/services/api/internal/moderation"
	"airtak/services/api/internal/trust"

	"github.com/google/uuid"
)

type Hub struct {
	Clients        map[string]*Client           // userID -> *Client
	Rooms          map[string]map[string]*Client // roomName -> userID -> *Client
	Register       chan *Client
	Unregister     chan *Client
	Broadcast      chan []byte
	MatchEngine    *matchmaking.MatchmakingEngine
	LiveKitTokenGen *livekit.TokenGenerator
	AIEngine       *ai.AssistantEngine
	GameManager    *games.GameManager
	TrustEngine    *trust.TrustEngine
	ModService     *moderation.ModerationService
	Cfg            *config.Config
	mu             sync.RWMutex
}

func NewHub(
	cfg *config.Config,
	matchEngine *matchmaking.MatchmakingEngine,
	livekitGen *livekit.TokenGenerator,
	aiEngine *ai.AssistantEngine,
	gameManager *games.GameManager,
	trustEngine *trust.TrustEngine,
	modService *moderation.ModerationService,
) *Hub {
	return &Hub{
		Clients:         make(map[string]*Client),
		Rooms:           make(map[string]map[string]*Client),
		Register:        make(chan *Client),
		Unregister:      make(chan *Client),
		Broadcast:       make(chan []byte),
		MatchEngine:     matchEngine,
		LiveKitTokenGen: livekitGen,
		AIEngine:        aiEngine,
		GameManager:     gameManager,
		TrustEngine:     trustEngine,
		ModService:      modService,
		Cfg:             cfg,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			// If existing connection exists for this user, disconnect old
			if old, exists := h.Clients[client.UserID]; exists && old != client {
				old.CloseSend()
				old.Conn.Close()
				delete(h.Clients, client.UserID)
			}
			h.Clients[client.UserID] = client
			h.mu.Unlock()

			client.SendJSON("system:connected", map[string]interface{}{
				"userId":    client.UserID,
				"username":  client.Username,
				"timestamp": time.Now().UnixMilli(),
			})

		case client := <-h.Unregister:
			h.mu.Lock()
			// Only remove from map if it is this exact client instance
			if curr, ok := h.Clients[client.UserID]; ok && curr == client {
				delete(h.Clients, client.UserID)
			}
			client.CloseSend()
			// Remove from matchmaking queue
			h.MatchEngine.LeaveQueue(client.UserID)

			// Clean from active room and notify peer
			if client.ActiveRoom != "" {
				if roomClients, exists := h.Rooms[client.ActiveRoom]; exists {
					delete(roomClients, client.UserID)
					for _, peer := range roomClients {
						peer.SendJSON("match:peer_left", map[string]string{
							"userId": client.UserID,
							"reason": "disconnected",
						})
					}
					if len(roomClients) == 0 {
						delete(h.Rooms, client.ActiveRoom)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

// ServeWS upgrades the HTTP request to WebSocket
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	tokenStr := auth.ExtractTokenFromRequest(r)
	if tokenStr == "" {
		http.Error(w, "Unauthorized: missing token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateJWT(h.Cfg, tokenStr)
	if err != nil {
		http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
		return
	}

	userUUID, err := uuid.Parse(claims.UserID)
	if err != nil {
		http.Error(w, "Unauthorized: invalid user ID", http.StatusUnauthorized)
		return
	}

	user, err := auth.GetUserByID(userUUID)
	if err != nil || user == nil || user.IsBanned {
		http.Error(w, "Forbidden: account is suspended", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:          h,
		Conn:         conn,
		Send:         make(chan []byte, 256),
		UserID:       claims.UserID,
		Username:     claims.Username,
		MysteryLevel: 1,
	}

	h.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

// HandleMatchFound is invoked by the MatchmakingEngine when two users are paired
func (h *Hub) HandleMatchFound(pair *matchmaking.MatchedPair) {
	h.mu.Lock()
	clientA, existsA := h.Clients[pair.TicketA.UserID]
	clientB, existsB := h.Clients[pair.TicketB.UserID]

	if !existsA || !existsB {
		h.mu.Unlock()
		// Re-queue remaining client
		if existsA {
			h.MatchEngine.JoinQueue(pair.TicketA)
		}
		if existsB {
			h.MatchEngine.JoinQueue(pair.TicketB)
		}
		return
	}

	// Evict Client A from any prior room to prevent multi-user audio mixing
	if clientA.ActiveRoom != "" && clientA.ActiveRoom != pair.RoomName {
		if prevRoom, ok := h.Rooms[clientA.ActiveRoom]; ok {
			delete(prevRoom, clientA.UserID)
			for _, peer := range prevRoom {
				peer.SendJSON("match:peer_left", map[string]string{
					"userId": clientA.UserID,
					"reason": "matched_elsewhere",
				})
			}
			if len(prevRoom) == 0 {
				delete(h.Rooms, clientA.ActiveRoom)
			}
		}
	}

	// Evict Client B from any prior room to prevent multi-user audio mixing
	if clientB.ActiveRoom != "" && clientB.ActiveRoom != pair.RoomName {
		if prevRoom, ok := h.Rooms[clientB.ActiveRoom]; ok {
			delete(prevRoom, clientB.UserID)
			for _, peer := range prevRoom {
				peer.SendJSON("match:peer_left", map[string]string{
					"userId": clientB.UserID,
					"reason": "matched_elsewhere",
				})
			}
			if len(prevRoom) == 0 {
				delete(h.Rooms, clientB.ActiveRoom)
			}
		}
	}

	clientA.ActiveRoom = pair.RoomName
	clientB.ActiveRoom = pair.RoomName
	clientA.MysteryLevel = 1
	clientB.MysteryLevel = 1

	// Ensure the 1-on-1 room starts fresh with exactly these two users
	h.Rooms[pair.RoomName] = map[string]*Client{
		clientA.UserID: clientA,
		clientB.UserID: clientB,
	}
	h.mu.Unlock()

	// Mint short-lived LiveKit audio tokens
	tokenA, errA := h.LiveKitTokenGen.GenerateRoomToken(pair.RoomName, clientA.UserID, clientA.Username, true)
	tokenB, errB := h.LiveKitTokenGen.GenerateRoomToken(pair.RoomName, clientB.UserID, clientB.Username, true)
	if errA != nil || errB != nil {
		log.Printf("Error generating LiveKit tokens: %v %v", errA, errB)
	}

	// Record Conversation in DB
	convID := uuid.New()
	now := time.Now().UTC()
	database.DB.Create(&models.Conversation{
		ID:              convID,
		RoomName:        pair.RoomName,
		Type:            "random_voice",
		DurationSeconds: 0,
		CreatedAt:       now,
	})
	uidA, errUA := uuid.Parse(clientA.UserID)
	uidB, errUB := uuid.Parse(clientB.UserID)
	if errUA == nil && errUB == nil {
		database.DB.Create(&models.ConversationParticipant{
			ID:             uuid.New(),
			ConversationID: convID,
			UserID:         uidA,
			JoinedAt:       now,
		})
		database.DB.Create(&models.ConversationParticipant{
			ID:             uuid.New(),
			ConversationID: convID,
			UserID:         uidB,
			JoinedAt:       now,
		})
	}

	// Generate AI icebreaker suggestion
	icebreaker := h.AIEngine.GenerateIcebreaker(pair.SharedInterests, pair.TicketA.Preferences.Intention, pair.TicketA.Preferences.Mood)

	// Notify Client A
	clientA.SendJSON("match:found", map[string]interface{}{
		"matchId":     pair.MatchID,
		"roomName":    pair.RoomName,
		"livekitToken": tokenA,
		"livekitUrl":  h.LiveKitTokenGen.GetLiveKitURL(),
		"isInitiator": true,
		"peer": map[string]interface{}{
			"id":              pair.TicketB.UserID,
			"username":        pair.TicketB.Username,
			"avatarId":        pair.TicketB.AvatarID,
			"countryCode":     pair.TicketB.CountryCode,
			"mood":            pair.TicketB.Preferences.Mood,
			"intention":       pair.TicketB.Preferences.Intention,
			"sharedInterests": pair.SharedInterests,
			"mysteryLevel":    1,
		},
		"icebreakerSuggestion": icebreaker,
	})

	// Notify Client B
	clientB.SendJSON("match:found", map[string]interface{}{
		"matchId":     pair.MatchID,
		"roomName":    pair.RoomName,
		"livekitToken": tokenB,
		"livekitUrl":  h.LiveKitTokenGen.GetLiveKitURL(),
		"isInitiator": false,
		"peer": map[string]interface{}{
			"id":              pair.TicketA.UserID,
			"username":        pair.TicketA.Username,
			"avatarId":        pair.TicketA.AvatarID,
			"countryCode":     pair.TicketA.CountryCode,
			"mood":            pair.TicketA.Preferences.Mood,
			"intention":       pair.TicketA.Preferences.Intention,
			"sharedInterests": pair.SharedInterests,
			"mysteryLevel":    1,
		},
		"icebreakerSuggestion": icebreaker,
	})
}

// HandleClientMessage dispatches client actions
func (h *Hub) HandleClientMessage(client *Client, msg WSMessage) {
	switch msg.Type {
	case "queue:join":
		if !h.TrustEngine.CheckRateLimit(client.UserID+":queue", 12, time.Minute) {
			client.SendJSON("safety:alert", map[string]string{
				"message": "You are joining queues too quickly. Please wait a moment.",
			})
			return
		}

		// Ensure client is completely evicted from any active room before queueing
		h.mu.Lock()
		if prevRoom := client.ActiveRoom; prevRoom != "" {
			if roomClients, exists := h.Rooms[prevRoom]; exists {
				delete(roomClients, client.UserID)
				for _, peer := range roomClients {
					peer.SendJSON("match:peer_left", map[string]string{
						"userId": client.UserID,
						"reason": "requeued",
					})
				}
				if len(roomClients) == 0 {
					delete(h.Rooms, prevRoom)
				}
			}
			client.ActiveRoom = ""
		}
		h.mu.Unlock()

		var ticket matchmaking.MatchTicket
		if err := json.Unmarshal(msg.Payload, &ticket); err == nil {
			ticket.UserID = client.UserID
			ticket.Username = client.Username
			ticket.AvatarID = client.AvatarID
			h.MatchEngine.JoinQueue(&ticket)
			client.SendJSON("queue:status", map[string]interface{}{
				"status":  "queued",
				"mode":    ticket.Mode,
				"message": "Finding someone worth talking to...",
			})
		}

	case "queue:leave":
		h.MatchEngine.LeaveQueue(client.UserID)
		client.SendJSON("queue:status", map[string]string{
			"status": "idle",
		})

	case "call:end":
		h.mu.Lock()
		activeRoom := client.ActiveRoom
		if activeRoom != "" {
			if roomClients, exists := h.Rooms[activeRoom]; exists {
				delete(roomClients, client.UserID)
				for _, peer := range roomClients {
					peer.SendJSON("match:peer_left", map[string]string{
						"userId": client.UserID,
						"reason": "hung_up",
					})
				}
				if len(roomClients) == 0 {
					delete(h.Rooms, activeRoom)
				}
			}
			client.ActiveRoom = ""
		}
		h.mu.Unlock()
		h.finalizeConversation(activeRoom)

	case "direct:call":
		var payload struct {
			TargetUserID string `json:"targetUserId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil || payload.TargetUserID == "" {
			return
		}

		callerUUID, err1 := uuid.Parse(client.UserID)
		targetUUID, err2 := uuid.Parse(payload.TargetUserID)
		if err1 == nil && err2 == nil && h.ModService.IsBlocked(targetUUID, callerUUID) {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "blocked",
				"message": "Cannot call this user.",
			})
			return
		}

		h.mu.RLock()
		targetClient, exists := h.Clients[payload.TargetUserID]
		h.mu.RUnlock()

		if !exists || targetClient == nil {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "offline",
				"message": "User is currently offline.",
			})
			return
		}

		if targetClient.ActiveRoom != "" {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "busy",
				"message": "User is currently in another conversation.",
			})
			return
		}

		callID := uuid.New().String()
		roomName := "direct_" + callID[:8]

		// Notify callee with incoming call bar
		targetClient.SendJSON("direct:incoming_call", map[string]interface{}{
			"callId":         callID,
			"roomName":       roomName,
			"callerId":       client.UserID,
			"callerName":     client.Username,
			"callerAvatarId": client.AvatarID,
		})

		// Notify caller that call is ringing
		client.SendJSON("direct:outgoing_ringing", map[string]interface{}{
			"callId":         callID,
			"roomName":       roomName,
			"targetUserId":   targetClient.UserID,
			"targetUsername": targetClient.Username,
			"targetAvatarId": targetClient.AvatarID,
		})

	case "direct:call_accept":
		var payload struct {
			CallID   string `json:"callId"`
			CallerID string `json:"callerId"`
			RoomName string `json:"roomName"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil || payload.CallerID == "" || payload.RoomName == "" {
			return
		}

		h.mu.RLock()
		callerClient, callerExists := h.Clients[payload.CallerID]
		h.mu.RUnlock()

		if !callerExists || callerClient == nil {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "caller_left",
				"message": "The caller hung up.",
			})
			return
		}

		h.mu.Lock()
		client.ActiveRoom = payload.RoomName
		callerClient.ActiveRoom = payload.RoomName
		if h.Rooms[payload.RoomName] == nil {
			h.Rooms[payload.RoomName] = make(map[string]*Client)
		}
		h.Rooms[payload.RoomName][client.UserID] = client
		h.Rooms[payload.RoomName][callerClient.UserID] = callerClient
		h.mu.Unlock()

		tokenCallee, _ := h.LiveKitTokenGen.GenerateRoomToken(payload.RoomName, client.UserID, client.Username, true)
		tokenCaller, _ := h.LiveKitTokenGen.GenerateRoomToken(payload.RoomName, callerClient.UserID, callerClient.Username, true)

		convID := uuid.New()
		now := time.Now().UTC()
		database.DB.Create(&models.Conversation{
			ID:              convID,
			RoomName:        payload.RoomName,
			Type:            "direct_voice",
			DurationSeconds: 0,
			CreatedAt:       now,
		})
		uidA, errA := uuid.Parse(callerClient.UserID)
		uidB, errB := uuid.Parse(client.UserID)
		if errA == nil && errB == nil {
			database.DB.Create(&models.ConversationParticipant{
				ID:             uuid.New(),
				ConversationID: convID,
				UserID:         uidA,
				JoinedAt:       now,
			})
			database.DB.Create(&models.ConversationParticipant{
				ID:             uuid.New(),
				ConversationID: convID,
				UserID:         uidB,
				JoinedAt:       now,
			})
		}

		callerClient.SendJSON("match:found", map[string]interface{}{
			"matchId":      convID.String(),
			"roomName":     payload.RoomName,
			"livekitToken": tokenCaller,
			"livekitUrl":   h.LiveKitTokenGen.GetLiveKitURL(),
			"isInitiator":  true,
			"peer": map[string]interface{}{
				"id":           client.UserID,
				"username":     client.Username,
				"avatarId":     client.AvatarID,
				"mysteryLevel": 3,
			},
		})

		client.SendJSON("match:found", map[string]interface{}{
			"matchId":      convID.String(),
			"roomName":     payload.RoomName,
			"livekitToken": tokenCallee,
			"livekitUrl":   h.LiveKitTokenGen.GetLiveKitURL(),
			"isInitiator":  false,
			"peer": map[string]interface{}{
				"id":           callerClient.UserID,
				"username":     callerClient.Username,
				"avatarId":     callerClient.AvatarID,
				"mysteryLevel": 3,
			},
		})

	case "direct:call_reject":
		var payload struct {
			CallerID string `json:"callerId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.CallerID != "" {
			h.mu.RLock()
			callerClient, exists := h.Clients[payload.CallerID]
			h.mu.RUnlock()
			if exists && callerClient != nil {
				callerClient.SendJSON("direct:call_rejected", map[string]string{
					"reason":  "declined",
					"message": "Call was declined.",
				})
			}
		}

	case "direct:call_block":
		var payload struct {
			CallerID string `json:"callerId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.CallerID != "" {
			calleeUUID, err1 := uuid.Parse(client.UserID)
			callerUUID, err2 := uuid.Parse(payload.CallerID)
			if err1 == nil && err2 == nil {
				h.ModService.BlockUser(calleeUUID, callerUUID)
			}

			h.mu.RLock()
			callerClient, exists := h.Clients[payload.CallerID]
			h.mu.RUnlock()
			if exists && callerClient != nil {
				callerClient.SendJSON("direct:call_rejected", map[string]string{
					"reason":  "blocked",
					"message": "Call was declined.",
				})
			}

			client.SendJSON("safety:alert", map[string]string{
				"message": "User has been blocked. You will no longer receive calls from them.",
			})
		}

	case "direct:call_cancel":
		var payload struct {
			TargetUserID string `json:"targetUserId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.TargetUserID != "" {
			h.mu.RLock()
			targetClient, exists := h.Clients[payload.TargetUserID]
			h.mu.RUnlock()
			if exists && targetClient != nil {
				targetClient.SendJSON("direct:call_cancelled", map[string]string{
					"callerId": client.UserID,
				})
			}
		}

	case "match:next":
		// Disconnect from current room and jump straight to matchmaking
		h.mu.Lock()
		prevRoom := client.ActiveRoom
		if prevRoom != "" {
			if roomClients, exists := h.Rooms[prevRoom]; exists {
				delete(roomClients, client.UserID)
				for _, peer := range roomClients {
					peer.SendJSON("match:peer_left", map[string]string{
						"userId": client.UserID,
						"reason": "skipped",
					})
				}
			}
			client.ActiveRoom = ""
		}
		h.mu.Unlock()
		h.finalizeConversation(prevRoom)

		var ticket matchmaking.MatchTicket
		if err := json.Unmarshal(msg.Payload, &ticket); err == nil {
			ticket.UserID = client.UserID
			ticket.Username = client.Username
			ticket.AvatarID = client.AvatarID
			h.MatchEngine.JoinQueue(&ticket)
			client.SendJSON("queue:status", map[string]interface{}{
				"status":  "queued",
				"mode":    ticket.Mode,
				"message": "Finding someone worth talking to...",
			})
		}

	case "chat:send":
		if client.ActiveRoom == "" {
			return
		}
		var payload struct {
			ID                string `json:"id"`
			Content           string `json:"content"`
			SourceLang        string `json:"sourceLang"`
			TargetLang        string `json:"targetLang"`
			EnableTranslation bool   `json:"enableTranslation"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		// Enforce max message length and clean null bytes
		cleanContent := strings.ReplaceAll(payload.Content, "\x00", "")
		cleanContent = strings.TrimSpace(cleanContent)
		if cleanContent == "" {
			return
		}
		if len(cleanContent) > 1000 {
			cleanContent = cleanContent[:1000]
		}

		// Rate limiting check
		if !h.TrustEngine.CheckRateLimit(client.UserID, 20, time.Minute) {
			client.SendJSON("safety:alert", map[string]string{
				"message": "You are sending messages too fast. Please slow down.",
			})
			return
		}

		// Sanitize links, phishing, and spam
		sanitizedContent, _ := h.TrustEngine.SanitizeMessage(cleanContent)

		var translatedContent string
		var isTranslated bool
		if payload.EnableTranslation && payload.TargetLang != "" {
			t, _ := h.AIEngine.TranslateMessage(sanitizedContent, payload.SourceLang, payload.TargetLang)
			translatedContent = t
			isTranslated = true
		}

		msgID := payload.ID
		if msgID == "" {
			msgID = uuid.New().String()
		}

		chatMsg := map[string]interface{}{
			"id":                msgID,
			"conversationId":    client.ActiveRoom,
			"senderId":          client.UserID,
			"senderName":        client.Username,
			"content":           sanitizedContent,
			"isTranslated":      isTranslated,
			"translatedContent": translatedContent,
			"timestamp":         time.Now().UnixMilli(),
		}

		h.broadcastToRoomExcept(client.ActiveRoom, client.UserID, "chat:message", chatMsg)

	case "chat:typing":
		if client.ActiveRoom != "" {
			h.broadcastToRoomExcept(client.ActiveRoom, client.UserID, "chat:typing", map[string]interface{}{
				"userId":   client.UserID,
				"isTyping": true,
			})
		}

	case "webrtc:signal":
		if client.ActiveRoom != "" {
			var raw interface{}
			if err := json.Unmarshal(msg.Payload, &raw); err == nil {
				h.broadcastToRoomExcept(client.ActiveRoom, client.UserID, "webrtc:signal", raw)
			}
		}

	case "mystery:reveal_request":
		if client.ActiveRoom != "" {
			client.MysteryLevel++
			h.broadcastToRoom(client.ActiveRoom, "mystery:update", map[string]interface{}{
				"userId":       client.UserID,
				"mysteryLevel": client.MysteryLevel,
			})
		}

	case "game:action":
		if client.ActiveRoom == "" {
			return
		}
		var payload struct {
			ActionType string                 `json:"actionType"` // "start", "move", "vote", "answer", "reset"
			GameType   games.GameType         `json:"gameType"`
			Data       map[string]interface{} `json:"data"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		if payload.ActionType == "start" {
			h.mu.RLock()
			roomClients := h.Rooms[client.ActiveRoom]
			var p2 string
			for uid := range roomClients {
				if uid != client.UserID {
					p2 = uid
					break
				}
			}
			h.mu.RUnlock()

			if p2 == "" {
				p2 = "peer"
			}

			session := h.GameManager.StartGame(client.ActiveRoom, payload.GameType, client.UserID, p2)
			h.broadcastToRoom(client.ActiveRoom, "game:update", session)
		} else {
			session, err := h.GameManager.HandleAction(client.ActiveRoom, client.UserID, payload.ActionType, payload.Data)
			if err == nil && session != nil {
				h.broadcastToRoom(client.ActiveRoom, "game:update", session)
			}
		}

	case "safety:block":
		var payload struct {
			BlockedUserID string `json:"blockedUserId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.BlockedUserID != "" {
			h.MatchEngine.AddBlock(client.UserID, payload.BlockedUserID)
			blockerUUID, err1 := uuid.Parse(client.UserID)
			blockedUUID, err2 := uuid.Parse(payload.BlockedUserID)
			if err1 == nil && err2 == nil {
				h.ModService.BlockUser(blockerUUID, blockedUUID)
			}
			h.TrustEngine.UpdateTrustScore(blockerUUID, -1, "blocked_user")

			// Immediately disconnect active room
			h.mu.Lock()
			if client.ActiveRoom != "" {
				if roomClients, exists := h.Rooms[client.ActiveRoom]; exists {
					for _, peer := range roomClients {
						peer.SendJSON("match:peer_left", map[string]string{
							"userId": client.UserID,
							"reason": "blocked",
						})
					}
					delete(h.Rooms, client.ActiveRoom)
				}
				client.ActiveRoom = ""
			}
			h.mu.Unlock()

			client.SendJSON("safety:alert", map[string]string{
				"message": "User blocked successfully. You will never match with this user again.",
			})
		}

	case "safety:report":
		var payload struct {
			ReportedUserID string `json:"reportedUserId"`
			Reason         string `json:"reason"`
			Description    string `json:"description"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.ReportedUserID != "" {
			reporterUUID, _ := uuid.Parse(client.UserID)
			reportedUUID, _ := uuid.Parse(payload.ReportedUserID)
			h.ModService.CreateReport(reporterUUID, reportedUUID, nil, payload.Reason, payload.Description)
			h.TrustEngine.UpdateTrustScore(reportedUUID, -20, "report_received")

			client.SendJSON("safety:alert", map[string]string{
				"message": "Report submitted. Our moderation team is reviewing this.",
			})
		}

	case "friend:request":
		var payload struct {
			FriendID string `json:"friendId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.FriendID != "" {
			userUUID, _ := uuid.Parse(client.UserID)
			friendUUID, _ := uuid.Parse(payload.FriendID)

			if userUUID != friendUUID {
				// Save bilateral mutual friendships
				var f1 models.Friendship
				if err := database.DB.Where("user_id = ? AND friend_id = ?", userUUID, friendUUID).First(&f1).Error; err != nil {
					f1 = models.Friendship{
						ID:        uuid.New(),
						UserID:    userUUID,
						FriendID:  friendUUID,
						Status:    "accepted",
						CreatedAt: time.Now().UTC(),
					}
					database.DB.Create(&f1)
				}

				var f2 models.Friendship
				if err := database.DB.Where("user_id = ? AND friend_id = ?", friendUUID, userUUID).First(&f2).Error; err != nil {
					f2 = models.Friendship{
						ID:        uuid.New(),
						UserID:    friendUUID,
						FriendID:  userUUID,
						Status:    "accepted",
						CreatedAt: time.Now().UTC(),
					}
					database.DB.Create(&f2)
				}

				h.TrustEngine.UpdateTrustScore(userUUID, +5, "friend_added")
				h.TrustEngine.UpdateTrustScore(friendUUID, +5, "friend_added")

				h.broadcastToRoom(client.ActiveRoom, "friend:update", map[string]interface{}{
					"status":   "accepted",
					"friendId": payload.FriendID,
					"message":  "You are now mutual friends! You can reconnect anytime.",
				})
			}
		}
	}
}

func (h *Hub) broadcastToRoom(roomName, msgType string, payload interface{}) {
	h.mu.RLock()
	roomClients, exists := h.Rooms[roomName]
	if !exists {
		h.mu.RUnlock()
		return
	}
	clientsList := make([]*Client, 0, len(roomClients))
	for _, c := range roomClients {
		clientsList = append(clientsList, c)
	}
	h.mu.RUnlock()

	for _, c := range clientsList {
		c.SendJSON(msgType, payload)
	}
}

func (h *Hub) broadcastToRoomExcept(roomName, exceptUserID, msgType string, payload interface{}) {
	h.mu.RLock()
	roomClients, exists := h.Rooms[roomName]
	if !exists {
		h.mu.RUnlock()
		return
	}
	clientsList := make([]*Client, 0, len(roomClients))
	for uid, c := range roomClients {
		if uid != exceptUserID {
			clientsList = append(clientsList, c)
		}
	}
	h.mu.RUnlock()

	for _, c := range clientsList {
		c.SendJSON(msgType, payload)
	}
}

func (h *Hub) IsUserOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.Clients[userID]
	return ok
}

func (h *Hub) GetOnlineCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.Clients)
}

func (h *Hub) GetActiveRoomsCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.Rooms)
}

func (h *Hub) GetRoomParticipantCount(roomName string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, exists := h.Rooms[roomName]; exists {
		return len(clients)
	}
	return 0
}

func (h *Hub) DisconnectUser(userID string) {
	h.mu.Lock()
	client, exists := h.Clients[userID]
	if exists {
		delete(h.Clients, userID)
		client.CloseSend()
		client.Conn.Close()
	}
	h.mu.Unlock()
}

func (h *Hub) finalizeConversation(roomName string) {
	if roomName == "" {
		return
	}
	var conv models.Conversation
	if err := database.DB.First(&conv, "room_name = ?", roomName).Error; err == nil {
		if conv.EndedAt == nil {
			now := time.Now().UTC()
			duration := int(now.Sub(conv.CreatedAt).Seconds())
			if duration < 0 {
				duration = 0
			}
			database.DB.Model(&conv).Updates(map[string]interface{}{
				"ended_at":         now,
				"duration_seconds": duration,
			})
		}
	}
}
