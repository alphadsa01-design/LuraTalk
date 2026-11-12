package realtime

import (
	"encoding/json"
	"fmt"
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
	"airtak/services/api/internal/telemetry"
	"airtak/services/api/internal/topics"
	"airtak/services/api/internal/trust"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

type DirectCallInvite struct {
	CallID    string
	CallerID  string
	CalleeID  string
	RoomName  string
	ExpiresAt time.Time
}

type Hub struct {
	Clients         map[string]*Client            // userID -> *Client
	Rooms           map[string]map[string]*Client  // roomName -> userID -> *Client
	PendingInvites  map[string]*DirectCallInvite  // callID -> *DirectCallInvite
	RematchPairs    map[string]time.Time          // pairKey -> matchedAt ("Talk again?" eligibility)
	RematchVotes    map[string]map[string]bool    // pairKey -> userID -> liked
	Register        chan *Client
	Unregister      chan *Client
	Broadcast       chan []byte
	MatchEngine     *matchmaking.MatchmakingEngine
	LiveKitTokenGen *livekit.TokenGenerator
	AIEngine        *ai.AssistantEngine
	GameManager     *games.GameManager
	TrustEngine     *trust.TrustEngine
	ModService      *moderation.ModerationService
	Cfg             *config.Config
	mu              sync.RWMutex
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
		PendingInvites:  make(map[string]*DirectCallInvite),
		RematchPairs:    make(map[string]time.Time),
		RematchVotes:    make(map[string]map[string]bool),
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
			// Only remove from map if it is this exact client instance. If a newer
			// connection for the same user already replaced this one (e.g. page refresh),
			// the user-level state (queue ticket, pending invites) belongs to the new
			// connection and must not be torn down.
			curr, ok := h.Clients[client.UserID]
			replaced := ok && curr != client
			if ok && curr == client {
				delete(h.Clients, client.UserID)
			}
			client.CloseSend()

			if !replaced {
				// Remove from matchmaking queue
				h.MatchEngine.LeaveQueue(client.UserID)

				// Clean up any pending invites involving this client
				for cid, inv := range h.PendingInvites {
					if inv.CallerID == client.UserID || inv.CalleeID == client.UserID {
						delete(h.PendingInvites, cid)
					}
				}
			}

			// Auto-notify active room peers
			activeRoom := client.ActiveRoom
			roomLeft := false
			if activeRoom != "" {
				if room, ok := h.Rooms[activeRoom]; ok && room[client.UserID] == client {
					roomLeft = true
					delete(room, client.UserID)
					for _, peer := range room {
						peer.SendJSON("match:peer_left", map[string]string{
							"userId": client.UserID,
							"reason": "client_disconnected",
						})
						peer.SendJSON("lounge:peer_left", map[string]string{
							"userId": client.UserID,
							"reason": "client_disconnected",
						})
					}
					if len(room) == 0 {
						h.deleteRoomLocked(activeRoom)
					}
				}
				client.ActiveRoom = ""
			}
			h.mu.Unlock()

			if roomLeft {
				// DB work must not block the hub event loop
				go h.finalizeConversation(activeRoom)
			}

		case message := <-h.Broadcast:
			h.mu.RLock()
			for _, client := range h.Clients {
				client.mu.Lock()
				if !client.isClosed {
					select {
					case client.Send <- message:
					default:
					}
				}
				client.mu.Unlock()
			}
			h.mu.RUnlock()
		}
	}
}

// ServeWS upgrades the HTTP request to WebSocket with header-based authentication
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	var token string
	var selectedSubprotocol string

	// 1. Authorization header (e.g. backend / native clients)
	if authH := r.Header.Get("Authorization"); authH != "" {
		parts := strings.Split(authH, " ")
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			token = strings.TrimSpace(parts[1])
		}
	}

	// 2. Sec-WebSocket-Protocol header (browser WebSocket clients)
	if token == "" {
		if protoHeader := r.Header.Get("Sec-WebSocket-Protocol"); protoHeader != "" {
			protocols := strings.Split(protoHeader, ",")
			for i, p := range protocols {
				trimmed := strings.TrimSpace(p)
				if strings.EqualFold(trimmed, "aura-auth") && i+1 < len(protocols) {
					token = strings.TrimSpace(protocols[i+1])
					selectedSubprotocol = "aura-auth"
					break
				} else if len(trimmed) > 20 && strings.Count(trimmed, ".") == 2 {
					// Direct JWT passed as subprotocol
					token = trimmed
					selectedSubprotocol = trimmed
					break
				}
			}
		}
	}

	// 3. Fallback to query string parameter (?token=)
	if token == "" {
		token = r.URL.Query().Get("token")
	}

	if protoHeader := r.Header.Get("Sec-WebSocket-Protocol"); protoHeader != "" && selectedSubprotocol == "" {
		protocols := strings.Split(protoHeader, ",")
		for _, p := range protocols {
			trimmed := strings.TrimSpace(p)
			if strings.EqualFold(trimmed, "aura-auth") {
				selectedSubprotocol = "aura-auth"
				break
			}
		}
	}

	if token == "" {
		http.Error(w, "Unauthorized: missing websocket authorization header or protocol", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateJWT(h.Cfg, token)
	if err != nil {
		http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
		return
	}

	userUUID, err := uuid.Parse(claims.UserID)
	if err != nil {
		http.Error(w, "Unauthorized: invalid user ID", http.StatusUnauthorized)
		return
	}

	user, err := auth.EnsureUserExists(userUUID, claims.Username, claims.IsAnonymous)
	if err != nil || user == nil || user.IsBanned {
		http.Error(w, "Forbidden: account is suspended", http.StatusForbidden)
		return
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  2048,
		WriteBufferSize: 2048,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				return true
			}
			return h.Cfg.IsOriginAllowed(origin)
		},
		Subprotocols: []string{"aura-auth"},
	}

	var respHeader http.Header
	if selectedSubprotocol != "" {
		respHeader = http.Header{"Sec-WebSocket-Protocol": []string{selectedSubprotocol}}
	}

	conn, err := upgrader.Upgrade(w, r, respHeader)
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
		AvatarID:     user.AvatarID,
		MysteryLevel: 1,
	}

	h.Register <- client
	telemetry.Monitor.RecordEvent(telemetry.EventWSConnect)
	telemetry.Monitor.RecordSystemLog("WS", fmt.Sprintf("WebSocket client connected: @%s (ID: %s)", client.Username, client.UserID[:8]), "info")

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
				h.deleteRoomLocked(clientA.ActiveRoom)
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
				h.deleteRoomLocked(clientB.ActiveRoom)
			}
		}
	}

	clientA.ActiveRoom = pair.RoomName
	clientB.ActiveRoom = pair.RoomName
	h.pruneRematchesLocked(time.Now())
	h.recordRematchPairLocked(clientA.UserID, clientB.UserID, time.Now())
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

	// Record Conversation atomically in DB in background so match dispatch is instant (<1ms)
	convID := uuid.New()
	now := time.Now().UTC()
	go func(cID uuid.UUID, rName, uA, uB, unameA, unameB, avA, avB string, n time.Time) {
		uidA, errUA := uuid.Parse(uA)
		uidB, errUB := uuid.Parse(uB)
		if errUA != nil || errUB != nil {
			return
		}

		// Ensure both users are in the DB before inserting participant foreign keys
		var userA, userB models.User
		if err := database.DB.First(&userA, "id = ?", uidA).Error; err != nil {
			userA = models.User{
				ID:          uidA,
				IsAnonymous: true,
				Username:    unameA,
				AvatarID:    avA,
				CreatedAt:   n,
				UpdatedAt:   n,
			}
			_ = database.DB.Create(&userA)
		}
		if err := database.DB.First(&userB, "id = ?", uidB).Error; err != nil {
			userB = models.User{
				ID:          uidB,
				IsAnonymous: true,
				Username:    unameB,
				AvatarID:    avB,
				CreatedAt:   n,
				UpdatedAt:   n,
			}
			_ = database.DB.Create(&userB)
		}

		txErr := database.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&models.Conversation{
				ID:              cID,
				RoomName:        rName,
				Type:            "random_voice",
				DurationSeconds: 0,
				CreatedAt:       n,
			}).Error; err != nil {
				return err
			}

			if err := tx.Create(&models.ConversationParticipant{
				ID:             uuid.New(),
				ConversationID: cID,
				UserID:         uidA,
				JoinedAt:       n,
			}).Error; err != nil {
				return err
			}

			return tx.Create(&models.ConversationParticipant{
				ID:             uuid.New(),
				ConversationID: cID,
				UserID:         uidB,
				JoinedAt:       n,
			}).Error
		})
		if txErr != nil {
			log.Printf("[Hub] Conversation history save error: %v", txErr)
		}
	}(convID, pair.RoomName, clientA.UserID, clientB.UserID, clientA.Username, clientB.Username, clientA.AvatarID, clientB.AvatarID, now)

	// Generate unique, distinct AI icebreaker suggestions for both peers
	icebreakerA, icebreakerB := h.AIEngine.GeneratePairIcebreakers(
		pair.SharedInterests,
		pair.TicketA.Preferences.Intention, pair.TicketA.Preferences.Mood,
		pair.TicketB.Preferences.Intention, pair.TicketB.Preferences.Mood,
	)

	// Both opted into the same topic of the day: tell them what they're here to talk about
	var sharedTopic interface{}
	if t := pair.TicketA.Preferences.Topic; t != "" && t == pair.TicketB.Preferences.Topic {
		if topic, ok := topics.ByID(t); ok {
			sharedTopic = topic
		}
	}

	// Notify Client A
	clientA.SendJSON("match:found", map[string]interface{}{
		"matchId":      pair.MatchID,
		"roomName":     pair.RoomName,
		"mode":         pair.TicketA.Mode,
		"livekitToken": tokenA,
		"livekitUrl":   h.LiveKitTokenGen.GetLiveKitURL(),
		"isInitiator":  true,
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
		"icebreakerSuggestion": icebreakerA,
		"topic":                sharedTopic,
	})

	// Notify Client B
	clientB.SendJSON("match:found", map[string]interface{}{
		"matchId":      pair.MatchID,
		"roomName":     pair.RoomName,
		"mode":         pair.TicketB.Mode,
		"livekitToken": tokenB,
		"livekitUrl":   h.LiveKitTokenGen.GetLiveKitURL(),
		"isInitiator":  false,
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
		"icebreakerSuggestion": icebreakerB,
		"topic":                sharedTopic,
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
		h.leaveActiveRoom(client, "requeued")
		h.enqueueClient(client, msg.Payload)

	case "queue:leave":
		h.MatchEngine.LeaveQueue(client.UserID)
		client.SendJSON("queue:status", map[string]string{
			"status": "idle",
		})

	case "call:end":
		h.leaveActiveRoom(client, "hung_up")

	case "direct:call":
		var payload struct {
			TargetUserID string `json:"targetUserId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil || payload.TargetUserID == "" {
			return
		}

		callerUUID, err1 := uuid.Parse(client.UserID)
		targetUUID, err2 := uuid.Parse(payload.TargetUserID)
		if err1 != nil || err2 != nil || callerUUID == targetUUID {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "invalid_target",
				"message": "Cannot call this user.",
			})
			return
		}

		if h.ModService.IsBlocked(targetUUID, callerUUID) || h.ModService.IsBlocked(callerUUID, targetUUID) {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "blocked",
				"message": "Cannot call this user.",
			})
			return
		}

		h.mu.RLock()
		targetClient, exists := h.Clients[targetUUID.String()]
		targetBusy := exists && targetClient != nil && targetClient.ActiveRoom != ""
		h.mu.RUnlock()

		if !exists || targetClient == nil {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "offline",
				"message": "User is currently offline.",
			})
			return
		}

		if targetBusy {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "busy",
				"message": "User is currently in another conversation.",
			})
			return
		}

		callID := uuid.New().String()
		roomName := "direct_" + callID[:12]

		// Server stores validated pending call invite
		h.mu.Lock()
		h.PendingInvites[callID] = &DirectCallInvite{
			CallID:    callID,
			CallerID:  client.UserID,
			CalleeID:  targetClient.UserID,
			RoomName:  roomName,
			ExpiresAt: time.Now().Add(45 * time.Second),
		}
		h.mu.Unlock()

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
			CallID string `json:"callId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil || payload.CallID == "" {
			return
		}

		// Retrieve and validate server-minted pending invite
		h.mu.Lock()
		invite, inviteExists := h.PendingInvites[payload.CallID]
		if inviteExists {
			delete(h.PendingInvites, payload.CallID)
		}
		h.mu.Unlock()

		if !inviteExists || invite == nil || invite.CalleeID != client.UserID || time.Now().After(invite.ExpiresAt) {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "expired",
				"message": "Call invitation has expired or is invalid.",
			})
			return
		}

		callerUUID, err1 := uuid.Parse(invite.CallerID)
		calleeUUID, err2 := uuid.Parse(client.UserID)
		if err1 != nil || err2 != nil || h.ModService.IsBlocked(calleeUUID, callerUUID) || h.ModService.IsBlocked(callerUUID, calleeUUID) {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "blocked",
				"message": "Cannot connect to this user.",
			})
			return
		}

		h.mu.RLock()
		callerClient, callerExists := h.Clients[invite.CallerID]
		callerBusy := callerExists && callerClient != nil && callerClient.ActiveRoom != ""
		h.mu.RUnlock()

		if !callerExists || callerClient == nil {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "caller_left",
				"message": "The caller hung up.",
			})
			return
		}

		if callerBusy {
			client.SendJSON("direct:call_failed", map[string]string{
				"reason":  "busy",
				"message": "The caller is already in another conversation.",
			})
			return
		}

		// Strictly use server-derived roomName from validated invite
		secureRoomName := invite.RoomName

		// Neither side may stay in the random-match queue or a previous room
		h.MatchEngine.LeaveQueue(client.UserID)
		h.MatchEngine.LeaveQueue(callerClient.UserID)
		h.leaveActiveRoom(client, "joined_direct_call")

		h.mu.Lock()
		client.ActiveRoom = secureRoomName
		callerClient.ActiveRoom = secureRoomName
		if h.Rooms[secureRoomName] == nil {
			h.Rooms[secureRoomName] = make(map[string]*Client)
		}
		h.Rooms[secureRoomName][client.UserID] = client
		h.Rooms[secureRoomName][callerClient.UserID] = callerClient
		h.mu.Unlock()

		tokenCallee, _ := h.LiveKitTokenGen.GenerateRoomToken(secureRoomName, client.UserID, client.Username, true)
		tokenCaller, _ := h.LiveKitTokenGen.GenerateRoomToken(secureRoomName, callerClient.UserID, callerClient.Username, true)

		convID := uuid.New()
		now := time.Now().UTC()
		database.DB.Create(&models.Conversation{
			ID:              convID,
			RoomName:        secureRoomName,
			Type:            "direct_voice",
			DurationSeconds: 0,
			CreatedAt:       now,
		})
		database.DB.Create(&models.ConversationParticipant{
			ID:             uuid.New(),
			ConversationID: convID,
			UserID:         callerUUID,
			JoinedAt:       now,
		})
		database.DB.Create(&models.ConversationParticipant{
			ID:             uuid.New(),
			ConversationID: convID,
			UserID:         calleeUUID,
			JoinedAt:       now,
		})

		callerClient.SendJSON("match:found", map[string]interface{}{
			"matchId":      convID.String(),
			"roomName":     secureRoomName,
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
			"roomName":     secureRoomName,
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
			CallID   string `json:"callId"`
			CallerID string `json:"callerId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil {
			// Only the callee of a pending invite may reject it
			invite := h.takeInvite(payload.CallID, func(inv *DirectCallInvite) bool {
				return inv.CalleeID == client.UserID && (payload.CallID != "" || inv.CallerID == payload.CallerID)
			})
			if invite != nil {
				h.mu.RLock()
				callerClient, exists := h.Clients[invite.CallerID]
				h.mu.RUnlock()
				if exists && callerClient != nil {
					callerClient.SendJSON("direct:call_rejected", map[string]string{
						"reason":  "declined",
						"message": "Call was declined.",
					})
				}
			}
		}

	case "direct:call_block":
		var payload struct {
			CallID   string `json:"callId"`
			CallerID string `json:"callerId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil {
			invite := h.takeInvite(payload.CallID, func(inv *DirectCallInvite) bool {
				return inv.CalleeID == client.UserID && (payload.CallID != "" || inv.CallerID == payload.CallerID)
			})
			if invite == nil {
				return
			}
			blockerUUID, err1 := uuid.Parse(client.UserID)
			blockedUUID, err2 := uuid.Parse(invite.CallerID)
			if err1 != nil || err2 != nil {
				return
			}
			h.MatchEngine.AddBlock(blockerUUID.String(), blockedUUID.String())
			h.ModService.BlockUser(blockerUUID, blockedUUID)

			h.mu.RLock()
			callerClient, exists := h.Clients[invite.CallerID]
			h.mu.RUnlock()
			if exists && callerClient != nil {
				callerClient.SendJSON("direct:call_rejected", map[string]string{
					"reason":  "declined",
					"message": "Call was declined.",
				})
			}
			client.SendJSON("safety:alert", map[string]string{
				"message": "User blocked successfully. They can no longer call you.",
			})
		}

	case "direct:call_cancel":
		var payload struct {
			CallID       string `json:"callId"`
			TargetUserID string `json:"targetUserId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil {
			// Only the caller of a pending invite may cancel it
			invite := h.takeInvite(payload.CallID, func(inv *DirectCallInvite) bool {
				return inv.CallerID == client.UserID && (payload.CallID != "" || inv.CalleeID == payload.TargetUserID)
			})
			if invite != nil {
				h.mu.RLock()
				targetClient, exists := h.Clients[invite.CalleeID]
				h.mu.RUnlock()
				if exists && targetClient != nil {
					targetClient.SendJSON("direct:call_cancelled", map[string]string{
						"callId":   invite.CallID,
						"callerId": client.UserID,
					})
				}
			}
		}

	case "match:next":
		// Disconnect from current room and jump straight to matchmaking
		h.leaveActiveRoom(client, "skipped")
		if !h.TrustEngine.CheckRateLimit(client.UserID+":queue", 12, time.Minute) {
			client.SendJSON("safety:alert", map[string]string{
				"message": "You are joining queues too quickly. Please wait a moment.",
			})
			return
		}
		h.enqueueClient(client, msg.Payload)

	case "chat:send":
		activeRoom := h.activeRoomOf(client)
		if activeRoom == "" {
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
		if runes := []rune(cleanContent); len(runes) > 1000 {
			// Truncate on rune boundaries so multi-byte characters are never split
			cleanContent = string(runes[:1000])
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
			"conversationId":    activeRoom,
			"senderId":          client.UserID,
			"senderName":        client.Username,
			"content":           sanitizedContent,
			"isTranslated":      isTranslated,
			"translatedContent": translatedContent,
			"timestamp":         time.Now().UnixMilli(),
		}

		h.broadcastToRoomExcept(activeRoom, client.UserID, "chat:message", chatMsg)

	case "rematch:vote":
		h.handleRematchVote(client, msg.Payload)

	case "chat:typing":
		if activeRoom := h.activeRoomOf(client); activeRoom != "" {
			h.broadcastToRoomExcept(activeRoom, client.UserID, "chat:typing", map[string]interface{}{
				"userId":   client.UserID,
				"isTyping": true,
			})
		}

	case "webrtc:signal":
		if activeRoom := h.activeRoomOf(client); activeRoom != "" {
			var raw map[string]interface{}
			if err := json.Unmarshal(msg.Payload, &raw); err == nil && raw != nil {
				raw["fromUserId"] = client.UserID
				h.broadcastToRoomExcept(activeRoom, client.UserID, "webrtc:signal", raw)
			}
		}

	case "mystery:reveal_request":
		h.mu.Lock()
		activeRoom := client.ActiveRoom
		if activeRoom != "" && client.MysteryLevel < 3 {
			// 1: anonymous, 2: shared interests, 3: full profile (max)
			client.MysteryLevel++
		}
		level := client.MysteryLevel
		h.mu.Unlock()
		if activeRoom != "" {
			h.broadcastToRoom(activeRoom, "mystery:update", map[string]interface{}{
				"userId":       client.UserID,
				"mysteryLevel": level,
			})
		}

	case "game:action":
		activeRoom := h.activeRoomOf(client)
		if activeRoom == "" {
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
			roomClients := h.Rooms[activeRoom]
			var p2 string
			for uid := range roomClients {
				if uid != client.UserID {
					p2 = uid
					break
				}
			}
			h.mu.RUnlock()

			if p2 == "" {
				return // games need both people in the call
			}

			if session := h.GameManager.StartGame(activeRoom, payload.GameType, client.UserID, p2, payload.Data); session != nil {
				h.broadcastToRoom(activeRoom, "game:update", session)
			}
		} else {
			session, err := h.GameManager.HandleAction(activeRoom, client.UserID, payload.ActionType, payload.Data)
			if err == nil && session != nil {
				h.broadcastToRoom(activeRoom, "game:update", session)
			}
		}

	case "safety:block":
		var payload struct {
			BlockedUserID string `json:"blockedUserId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.BlockedUserID != "" {
			blockerUUID, err1 := uuid.Parse(client.UserID)
			blockedUUID, err2 := uuid.Parse(payload.BlockedUserID)
			if err1 != nil || err2 != nil || blockerUUID == blockedUUID {
				client.SendJSON("safety:alert", map[string]string{
					"message": "Invalid block request.",
				})
				return
			}
			h.MatchEngine.AddBlock(blockerUUID.String(), blockedUUID.String())
			if _, err := h.ModService.BlockUser(blockerUUID, blockedUUID); err == nil {
				h.TrustEngine.UpdateTrustScore(blockedUUID, -1, "blocked_by_user")
			}

			// Immediately disconnect active room for everyone in it
			h.mu.Lock()
			activeRoom := client.ActiveRoom
			if activeRoom != "" {
				if roomClients, exists := h.Rooms[activeRoom]; exists {
					for uid, peer := range roomClients {
						if uid == client.UserID {
							continue
						}
						peer.ActiveRoom = ""
						peer.SendJSON("match:peer_left", map[string]string{
							"userId": client.UserID,
							"reason": "blocked",
						})
					}
					h.deleteRoomLocked(activeRoom)
				}
				client.ActiveRoom = ""
			}
			h.mu.Unlock()
			if activeRoom != "" {
				h.finalizeConversation(activeRoom)
			}

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
			reporterUUID, err1 := uuid.Parse(client.UserID)
			reportedUUID, err2 := uuid.Parse(payload.ReportedUserID)
			if err1 != nil || err2 != nil || reporterUUID == reportedUUID {
				client.SendJSON("safety:alert", map[string]string{
					"message": "Invalid report submission.",
				})
				return
			}

			_, isNew, err := h.ModService.CreateReport(reporterUUID, reportedUUID, nil, payload.Reason, payload.Description)
			if err == nil && isNew {
				h.TrustEngine.UpdateTrustScore(reportedUUID, -20, "report_received")
				telemetry.Monitor.RecordEvent(telemetry.EventUserReport)
			}

			client.SendJSON("safety:alert", map[string]string{
				"message": "Report submitted. Our moderation team is reviewing this.",
			})
		}

	case "friend:request":
		var payload struct {
			FriendID string `json:"friendId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil && payload.FriendID != "" {
			userUUID, err1 := uuid.Parse(client.UserID)
			friendUUID, err2 := uuid.Parse(payload.FriendID)

			if err1 == nil && err2 == nil && userUUID != friendUUID {
				if !h.ModService.IsBlocked(userUUID, friendUUID) {
					// Check if reciprocal pending request already exists (mutual friend match)
					var reverseReq models.Friendship
					if err := database.DB.Where("user_id = ? AND friend_id = ? AND status = 'pending'", friendUUID, userUUID).First(&reverseReq).Error; err == nil {
						// Mutual add! Accept both sides
						reverseReq.Status = "accepted"
						database.DB.Save(&reverseReq)

						var myReciprocal models.Friendship
						if err := database.DB.Where("user_id = ? AND friend_id = ?", userUUID, friendUUID).First(&myReciprocal).Error; err != nil {
							myReciprocal = models.Friendship{
								ID:        uuid.New(),
								UserID:    userUUID,
								FriendID:  friendUUID,
								Status:    "accepted",
								CreatedAt: time.Now().UTC(),
							}
							database.DB.Create(&myReciprocal)
						} else {
							myReciprocal.Status = "accepted"
							database.DB.Save(&myReciprocal)
						}

						// Notify both users in real-time
						h.mu.RLock()
						targetClient, exists := h.Clients[payload.FriendID]
						h.mu.RUnlock()
						if exists && targetClient != nil {
							targetClient.SendJSON("friend:update", map[string]interface{}{
								"status":   "accepted",
								"friendId": client.UserID,
							})
							targetClient.SendJSON("friend:accepted", map[string]interface{}{
								"friendId": client.UserID,
								"username": client.Username,
							})
						}

						client.SendJSON("friend:update", map[string]interface{}{
							"status":   "accepted",
							"friendId": payload.FriendID,
						})
						client.SendJSON("friend:accepted", map[string]interface{}{
							"friendId": payload.FriendID,
						})
						return
					}

					var existing models.Friendship
					if err := database.DB.Where("user_id = ? AND friend_id = ?", userUUID, friendUUID).First(&existing).Error; err != nil {
						reqFriendship := models.Friendship{
							ID:        uuid.New(),
							UserID:    userUUID,
							FriendID:  friendUUID,
							Status:    "pending",
							CreatedAt: time.Now().UTC(),
						}
						database.DB.Create(&reqFriendship)
					}

					// Notify recipient live if online
					h.mu.RLock()
					targetClient, exists := h.Clients[payload.FriendID]
					h.mu.RUnlock()
					if exists && targetClient != nil {
						targetClient.SendJSON("friend:request_received", map[string]interface{}{
							"fromUserId":   client.UserID,
							"fromUsername": client.Username,
							"fromAvatarId": client.AvatarID,
						})
						targetClient.SendJSON("friend:update", map[string]interface{}{
							"status":   "pending",
							"friendId": client.UserID,
						})
					}

					client.SendJSON("friend:request_sent", map[string]string{
						"status":   "pending",
						"friendId": payload.FriendID,
					})
					client.SendJSON("friend:update", map[string]interface{}{
						"status":   "pending",
						"friendId": payload.FriendID,
					})
				}
			}
		}
	}
}

// deleteRoomLocked removes a room and discards its game. Caller must hold h.mu.
func (h *Hub) deleteRoomLocked(roomName string) {
	delete(h.Rooms, roomName)
	h.GameManager.EndGame(roomName)
}

// activeRoomOf returns the client's current room. ActiveRoom is mutated under h.mu
// from other goroutines (matchmaking callback, peers), so reads must hold the lock too.
func (h *Hub) activeRoomOf(c *Client) string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return c.ActiveRoom
}

// leaveActiveRoom removes the client from its current room (if any), notifies the
// remaining peers, garbage-collects empty rooms and finalizes the conversation.
func (h *Hub) leaveActiveRoom(client *Client, reason string) {
	h.mu.Lock()
	activeRoom := client.ActiveRoom
	if activeRoom != "" {
		if roomClients, exists := h.Rooms[activeRoom]; exists {
			delete(roomClients, client.UserID)
			for _, peer := range roomClients {
				peer.SendJSON("match:peer_left", map[string]string{
					"userId": client.UserID,
					"reason": reason,
				})
			}
			if len(roomClients) == 0 {
				h.deleteRoomLocked(activeRoom)
			}
		}
		client.ActiveRoom = ""
	}
	h.mu.Unlock()
	h.finalizeConversation(activeRoom)
}

// enqueueClient builds a matchmaking ticket from the client payload, overriding every
// server-authoritative field (identity, trust score, country, ticket ID) so clients
// cannot spoof them, and submits it to the matchmaking engine.
func (h *Hub) enqueueClient(client *Client, rawPayload json.RawMessage) {
	var ticket matchmaking.MatchTicket
	if err := json.Unmarshal(rawPayload, &ticket); err != nil {
		return
	}
	ticket.TicketID = ""
	ticket.QueuedAt = 0
	ticket.BlockList = nil
	ticket.RecentList = nil
	ticket.TrustScore = 0
	ticket.CountryCode = ""
	ticket.UserID = client.UserID
	ticket.Username = client.Username
	ticket.AvatarID = client.AvatarID
	switch ticket.Mode {
	case matchmaking.ModeVoice, matchmaking.ModeText, matchmaking.ModeMystery:
	default:
		ticket.Mode = matchmaking.ModeVoice
	}
	// Only today's topic counts; stale or made-up topics are ignored
	if !topics.IsToday(ticket.Preferences.Topic, time.Now()) {
		ticket.Preferences.Topic = ""
	}

	// Overwrite TrustScore and CountryCode directly from database user
	if uUUID, err := uuid.Parse(client.UserID); err == nil {
		if dbUser, err := auth.GetUserByID(uUUID); err == nil && dbUser != nil {
			ticket.TrustScore = dbUser.TrustScore
			ticket.CountryCode = dbUser.CountryCode
			if dbUser.AvatarID != "" {
				ticket.AvatarID = dbUser.AvatarID
			}
		}
	}
	if ticket.TrustScore == 0 {
		ticket.TrustScore = 100
	}

	h.MatchEngine.JoinQueue(&ticket)
	telemetry.Monitor.RecordEvent(telemetry.EventMatchQueue)
	client.SendJSON("queue:status", map[string]interface{}{
		"status":  "queued",
		"mode":    ticket.Mode,
		"message": "Finding someone worth talking to...",
	})
}

// takeInvite atomically removes and returns a pending invite that satisfies match.
// When callID is given it is looked up directly; otherwise the first matching invite wins.
func (h *Hub) takeInvite(callID string, match func(*DirectCallInvite) bool) *DirectCallInvite {
	h.mu.Lock()
	defer h.mu.Unlock()
	if callID != "" {
		if inv, ok := h.PendingInvites[callID]; ok && inv != nil && match(inv) {
			delete(h.PendingInvites, callID)
			return inv
		}
		return nil
	}
	for cid, inv := range h.PendingInvites {
		if inv != nil && match(inv) {
			delete(h.PendingInvites, cid)
			return inv
		}
	}
	return nil
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
