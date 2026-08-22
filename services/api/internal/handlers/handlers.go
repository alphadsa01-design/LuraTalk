package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"airtak/services/api/internal/auth"
	"airtak/services/api/internal/config"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/livekit"
	"airtak/services/api/internal/matchmaking"
	"airtak/services/api/internal/middleware"
	"airtak/services/api/internal/models"
	"airtak/services/api/internal/moderation"
	"airtak/services/api/internal/realtime"
	"airtak/services/api/internal/telemetry"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,30}$`)

type Handler struct {
	Cfg         *config.Config
	Hub         *realtime.Hub
	MatchEngine *matchmaking.MatchmakingEngine
	LiveKitGen  *livekit.TokenGenerator
	ModService  *moderation.ModerationService
}

func NewHandler(
	cfg *config.Config,
	hub *realtime.Hub,
	matchEngine *matchmaking.MatchmakingEngine,
	livekitGen *livekit.TokenGenerator,
	modService *moderation.ModerationService,
) *Handler {
	return &Handler{
		Cfg:         cfg,
		Hub:         hub,
		MatchEngine: matchEngine,
		LiveKitGen:  livekitGen,
		ModService:  modService,
	}
}

func (h *Handler) CreateAnonymousSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DeviceFingerprint string `json:"deviceFingerprint"`
	}
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			http.Error(w, "Payload too large or invalid JSON", http.StatusBadRequest)
			return
		}
	}

	ipHash := r.RemoteAddr
	resp, err := auth.CreateAnonymousSession(h.Cfg, body.DeviceFingerprint, ipHash)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) UpgradeAccount(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		Email    string `json:"email"`
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		http.Error(w, "Valid email required", http.StatusBadRequest)
		return
	}

	if body.Username != "" && !usernameRegex.MatchString(body.Username) {
		http.Error(w, "Username must be 3-30 characters (alphanumeric, underscores, hyphens only)", http.StatusBadRequest)
		return
	}

	upgraded, err := auth.UpgradeAnonymousUser(h.Cfg, user.ID, body.Email, body.Username)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(upgraded)
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		Username        string   `json:"username"`
		AvatarID        string   `json:"avatarId"`
		Bio             string   `json:"bio"`
		CountryCode     string   `json:"countryCode"`
		NativeLanguage  string   `json:"nativeLanguage"`
		TargetLanguages []string `json:"targetLanguages"`
		Interests       []string `json:"interests"`
		Mood            string   `json:"mood"`
		Intention       string   `json:"intention"`
		OneQuestionAns  string   `json:"oneQuestionAnswer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if body.Username != "" {
		trimmedUsername := strings.TrimSpace(body.Username)
		if !usernameRegex.MatchString(trimmedUsername) {
			http.Error(w, "Username must be 3-30 characters containing only letters, numbers, underscores, and hyphens", http.StatusBadRequest)
			return
		}

		if !strings.EqualFold(trimmedUsername, user.Username) {
			var existing models.User
			if err := database.DB.Where("LOWER(username) = LOWER(?) AND id != ?", trimmedUsername, user.ID).First(&existing).Error; err == nil {
				http.Error(w, "Username is already taken by another account", http.StatusBadRequest)
				return
			}
			user.Username = trimmedUsername
		}
	}

	if body.AvatarID != "" {
		user.AvatarID = body.AvatarID
	}
	if body.Bio != "" {
		user.Bio = body.Bio
	}
	if body.CountryCode != "" {
		user.CountryCode = body.CountryCode
	}
	if body.NativeLanguage != "" {
		user.NativeLanguage = body.NativeLanguage
	}
	if body.TargetLanguages != nil {
		user.TargetLanguages = body.TargetLanguages
	}
	if body.Interests != nil {
		user.Interests = body.Interests
	}
	if body.Mood != "" {
		user.Mood = body.Mood
	}
	if body.Intention != "" {
		user.Intention = body.Intention
	}
	if body.OneQuestionAns != "" {
		user.OneQuestionAns = body.OneQuestionAns
	}
	user.UpdatedAt = time.Now().UTC()

	database.DB.Save(user)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) GetRooms(w http.ResponseWriter, r *http.Request) {
	var rooms []models.Room
	database.DB.Where("is_active = ?", true).Find(&rooms)

	for i := range rooms {
		roomName := "lounge_" + rooms[i].ID.String()[:8]
		rooms[i].CurrentParticipants = h.Hub.GetRoomParticipantCount(roomName)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

func (h *Handler) GetRoomToken(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	roomIDStr := chi.URLParam(r, "id")
	var room models.Room
	if err := database.DB.First(&room, "id = ?", roomIDStr).Error; err != nil {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	roomName := "lounge_" + room.ID.String()[:8]
	lkToken, err := h.LiveKitGen.GenerateRoomToken(roomName, user.ID.String(), user.Username, true)
	if err != nil {
		http.Error(w, "Failed to generate room token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"roomName":     roomName,
		"livekitToken": lkToken,
		"livekitUrl":   h.LiveKitGen.GetLiveKitURL(),
		"room":         room,
	})
}

func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Title           string   `json:"title"`
		Topic           string   `json:"topic"`
		Description     string   `json:"description"`
		MaxParticipants int      `json:"maxParticipants"`
		Tags            []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.MaxParticipants <= 0 || req.MaxParticipants > 50 {
		req.MaxParticipants = 15
	}
	if req.Topic == "" {
		req.Topic = "Chill"
	}

	room := models.Room{
		ID:                  uuid.New(),
		Title:               req.Title,
		Topic:               req.Topic,
		Description:         req.Description,
		MaxParticipants:     req.MaxParticipants,
		CurrentParticipants: 1,
		IsActive:            true,
		CreatedBy:           user.ID,
		Tags:                models.StringArray(req.Tags),
		CreatedAt:           time.Now().UTC(),
	}

	if err := database.DB.Create(&room).Error; err != nil {
		http.Error(w, "Failed to create room", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(room)
}

func (h *Handler) GetFriends(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var friendships []models.Friendship
	database.DB.Preload("Friend").Where("user_id = ? AND status = 'accepted'", user.ID).Find(&friendships)

	type FriendResponse struct {
		ID       uuid.UUID         `json:"id"`
		Friend   models.UserPublic `json:"friend"`
		Status   string            `json:"status"`
		IsOnline bool              `json:"isOnline"`
	}

	var res []FriendResponse
	for _, f := range friendships {
		if f.Friend != nil {
			isOnline := h.Hub.IsUserOnline(f.Friend.ID.String())

			res = append(res, FriendResponse{
				ID:       f.ID,
				Friend:   f.Friend.ToPublic(),
				Status:   f.Status,
				IsOnline: isOnline,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *Handler) AddFriend(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		FriendUsername string `json:"username"`
		FriendID       string `json:"friendId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	var targetUser models.User
	if body.FriendID != "" {
		targetUUID, err := uuid.Parse(body.FriendID)
		if err != nil {
			http.Error(w, "Invalid friend ID format", http.StatusBadRequest)
			return
		}
		if err := database.DB.First(&targetUser, "id = ?", targetUUID).Error; err != nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
	} else if body.FriendUsername != "" {
		if err := database.DB.First(&targetUser, "LOWER(username) = LOWER(?)", strings.TrimSpace(body.FriendUsername)).Error; err != nil {
			http.Error(w, "User not found with that username", http.StatusNotFound)
			return
		}
	} else {
		http.Error(w, "Username or Friend ID required", http.StatusBadRequest)
		return
	}

	if targetUser.ID == user.ID {
		http.Error(w, "Cannot add yourself as a friend", http.StatusBadRequest)
		return
	}

	// Bilateral block check
	if h.ModService.IsBlocked(user.ID, targetUser.ID) {
		http.Error(w, "Unable to send friend request to this user", http.StatusForbidden)
		return
	}

	// Check if already friends or pending
	var existing models.Friendship
	if err := database.DB.Where("user_id = ? AND friend_id = ?", user.ID, targetUser.ID).First(&existing).Error; err == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": existing.Status,
			"friend": targetUser.ToPublic(),
		})
		return
	}

	// Create single pending friend request row (consensual friendship)
	reqFriendship := models.Friendship{
		ID:        uuid.New(),
		UserID:    user.ID,
		FriendID:  targetUser.ID,
		Status:    "pending",
		CreatedAt: time.Now().UTC(),
	}
	if err := database.DB.Create(&reqFriendship).Error; err != nil {
		http.Error(w, "Failed to submit friend request", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "pending",
		"friend": targetUser.ToPublic(),
	})
}

func (h *Handler) AcceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		FriendID string `json:"friendId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.FriendID == "" {
		http.Error(w, "Friend ID is required", http.StatusBadRequest)
		return
	}

	friendUUID, err := uuid.Parse(body.FriendID)
	if err != nil {
		http.Error(w, "Invalid friend ID", http.StatusBadRequest)
		return
	}

	if h.ModService.IsBlocked(user.ID, friendUUID) {
		http.Error(w, "Unable to connect with this user", http.StatusForbidden)
		return
	}

	// Update incoming pending request
	var incoming models.Friendship
	if err := database.DB.Where("user_id = ? AND friend_id = ?", friendUUID, user.ID).First(&incoming).Error; err != nil {
		http.Error(w, "No pending friend request found from this user", http.StatusNotFound)
		return
	}

	incoming.Status = "accepted"
	database.DB.Save(&incoming)

	// Create or update reciprocal friendship row
	var reciprocal models.Friendship
	if err := database.DB.Where("user_id = ? AND friend_id = ?", user.ID, friendUUID).First(&reciprocal).Error; err != nil {
		reciprocal = models.Friendship{
			ID:        uuid.New(),
			UserID:    user.ID,
			FriendID:  friendUUID,
			Status:    "accepted",
			CreatedAt: time.Now().UTC(),
		}
		database.DB.Create(&reciprocal)
	} else {
		reciprocal.Status = "accepted"
		database.DB.Save(&reciprocal)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "accepted",
		"friendId": friendUUID.String(),
	})
}

func (h *Handler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	friendIDStr := chi.URLParam(r, "id")
	friendUUID, err := uuid.Parse(friendIDStr)
	if err != nil {
		http.Error(w, "Invalid friend ID", http.StatusBadRequest)
		return
	}

	// Delete mutual friendships
	database.DB.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", user.ID, friendUUID, friendUUID, user.ID).Delete(&models.Friendship{})
	// Delete shared conversation memories
	database.DB.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", user.ID, friendUUID, friendUUID, user.ID).Delete(&models.ConversationMemory{})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "removed",
	})
}

func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Fetch participant records for this user
	var participants []models.ConversationParticipant
	database.DB.Where("user_id = ?", user.ID).Order("joined_at desc").Limit(50).Find(&participants)

	type HistoryItem struct {
		ID              uuid.UUID         `json:"id"`
		ConversationID  uuid.UUID         `json:"conversationId"`
		RoomName        string            `json:"roomName"`
		DurationSeconds int               `json:"durationSeconds"`
		CreatedAt       time.Time         `json:"createdAt"`
		Partner         models.UserPublic `json:"partner"`
		IsPartnerOnline bool              `json:"isPartnerOnline"`
		IsFriend        bool              `json:"isFriend"`
	}

	var results []HistoryItem
	for _, p := range participants {
		var conv models.Conversation
		if err := database.DB.First(&conv, "id = ?", p.ConversationID).Error; err != nil {
			continue
		}

		// Find other participant
		var otherParticipant models.ConversationParticipant
		if err := database.DB.Where("conversation_id = ? AND user_id != ?", p.ConversationID, user.ID).First(&otherParticipant).Error; err != nil {
			continue
		}

		var partnerUser models.User
		if err := database.DB.First(&partnerUser, "id = ?", otherParticipant.UserID).Error; err != nil {
			continue
		}

		isOnline := h.Hub.IsUserOnline(partnerUser.ID.String())

		// Check if friendship exists
		var friendshipCount int64
		database.DB.Model(&models.Friendship{}).Where("user_id = ? AND friend_id = ? AND status = 'accepted'", user.ID, partnerUser.ID).Count(&friendshipCount)

		results = append(results, HistoryItem{
			ID:              p.ID,
			ConversationID:  conv.ID,
			RoomName:        conv.RoomName,
			DurationSeconds: conv.DurationSeconds,
			CreatedAt:       conv.CreatedAt,
			Partner:         partnerUser.ToPublic(),
			IsPartnerOnline: isOnline,
			IsFriend:        friendshipCount > 0,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *Handler) DeleteHistory(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	pUUID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid history ID", http.StatusBadRequest)
		return
	}

	database.DB.Where("id = ? AND user_id = ?", pUUID, user.ID).Delete(&models.ConversationParticipant{})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *Handler) GetMemories(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	friendIDStr := r.URL.Query().Get("friendId")
	friendUUID, _ := uuid.Parse(friendIDStr)

	var memories []models.ConversationMemory
	database.DB.Where("user_id = ? AND friend_id = ?", user.ID, friendUUID).Order("created_at desc").Find(&memories)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memories)
}

func (h *Handler) SaveMemory(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		FriendID     string `json:"friendId"`
		TopicSummary string `json:"topicSummary"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TopicSummary == "" {
		http.Error(w, "Invalid memory content", http.StatusBadRequest)
		return
	}

	friendUUID, _ := uuid.Parse(body.FriendID)

	memory := models.ConversationMemory{
		ID:           uuid.New(),
		UserID:       user.ID,
		FriendID:     friendUUID,
		TopicSummary: body.TopicSummary,
		CreatedAt:    time.Now().UTC(),
	}
	database.DB.Create(&memory)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memory)
}

func (h *Handler) DeleteMemory(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	memIDStr := chi.URLParam(r, "id")
	memUUID, _ := uuid.Parse(memIDStr)

	database.DB.Where("id = ? AND user_id = ?", memUUID, user.ID).Delete(&models.ConversationMemory{})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func (h *Handler) GetPublicStats(w http.ResponseWriter, r *http.Request) {
	onlineCount := h.Hub.GetOnlineCount()
	activeRooms := h.Hub.GetActiveRoomsCount()
	queueDepth := h.MatchEngine.GetQueueCount()

	stats := map[string]interface{}{
		"onlineCount": onlineCount,
		"activeRooms": activeRooms,
		"queueDepth":  queueDepth,
		"timestamp":   time.Now().UnixMilli(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	json.NewEncoder(w).Encode(stats)
}

func (h *Handler) GetAdminStats(w http.ResponseWriter, r *http.Request) {
	var totalUsers, activeRoomsCount, totalReports, totalBlocks int64
	database.DB.Model(&models.User{}).Count(&totalUsers)
	database.DB.Model(&models.Room{}).Where("is_active = ?", true).Count(&activeRoomsCount)
	database.DB.Model(&models.Report{}).Where("status = 'open'").Count(&totalReports)
	database.DB.Model(&models.Block{}).Count(&totalBlocks)

	var rooms []models.Room
	database.DB.Order("current_participants desc").Limit(10).Find(&rooms)

	rates, alerts := telemetry.Monitor.GetMetrics()

	stats := map[string]interface{}{
		"activeOnlineUsers":      h.Hub.GetOnlineCount(),
		"activeVoiceRooms":       h.Hub.GetActiveRoomsCount(),
		"matchQueueDepth":        h.MatchEngine.GetQueueCount(),
		"totalRegistered":        totalUsers,
		"openReportsCount":       totalReports,
		"totalBlocksRecorded":    totalBlocks,
		"securityRatesPerMinute": rates,
		"securityAlerts":         alerts,
		"rooms":                  rooms,
		"timestamp":              time.Now().UnixMilli(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *Handler) GetAdminReports(w http.ResponseWriter, r *http.Request) {
	reports, err := h.ModService.GetOpenReports()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reports)
}

func (h *Handler) ActionAdminReport(w http.ResponseWriter, r *http.Request) {
	reportIDStr := chi.URLParam(r, "id")
	reportUUID, err := uuid.Parse(reportIDStr)
	if err != nil {
		http.Error(w, "Invalid report ID", http.StatusBadRequest)
		return
	}

	var body struct {
		Action string `json:"action"` // "resolved", "dismissed", "warned", "banned", "action_taken", "rejected"
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid action payload", http.StatusBadRequest)
		return
	}

	if err := h.ModService.ActionReport(reportUUID, body.Action); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	telemetry.Monitor.RecordEvent(telemetry.EventAdminAction)
	log.Printf("[ADMIN AUDIT] ip=%s action=ACTION_REPORT reportId=%s reportAction=%s", r.RemoteAddr, reportIDStr, body.Action)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "actioned", "action": body.Action})
}

func (h *Handler) AdminCreateRoom(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title           string   `json:"title"`
		Topic           string   `json:"topic"`
		Description     string   `json:"description"`
		MaxParticipants int      `json:"maxParticipants"`
		Tags            []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
		http.Error(w, "Invalid room data", http.StatusBadRequest)
		return
	}

	systemAdminID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	maxP := 12
	if body.MaxParticipants > 0 {
		maxP = body.MaxParticipants
	}

	room := models.Room{
		ID:                  uuid.New(),
		Title:               body.Title,
		Topic:               body.Topic,
		Description:         body.Description,
		MaxParticipants:     maxP,
		CurrentParticipants: 1,
		IsActive:            true,
		CreatedBy:           systemAdminID,
		Tags:                models.StringArray(body.Tags),
		CreatedAt:           time.Now().UTC(),
	}

	database.DB.Create(&room)
	log.Printf("[ADMIN AUDIT] ip=%s action=CREATE_ROOM roomId=%s title=%q topic=%q", r.RemoteAddr, room.ID.String(), room.Title, room.Topic)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(room)
}

func (h *Handler) AdminDeleteRoom(w http.ResponseWriter, r *http.Request) {
	roomIDStr := chi.URLParam(r, "id")
	roomUUID, err := uuid.Parse(roomIDStr)
	if err != nil {
		http.Error(w, "Invalid room ID", http.StatusBadRequest)
		return
	}

	database.DB.Model(&models.Room{}).Where("id = ?", roomUUID).Update("is_active", false)
	log.Printf("[ADMIN AUDIT] ip=%s action=DELETE_ROOM roomId=%s", r.RemoteAddr, roomIDStr)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func (h *Handler) AdminRevokeUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	database.DB.Where("user_id = ?", userUUID).Delete(&models.AnonymousSession{})
	database.DB.Model(&models.User{}).Where("id = ?", userUUID).Update("is_banned", true)

	// Instantly kill live WebSocket connection
	h.Hub.DisconnectUser(userIDStr)
	log.Printf("[ADMIN AUDIT] ip=%s action=REVOKE_AND_BAN_USER targetUserId=%s", r.RemoteAddr, userIDStr)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "revoked_and_banned"})
}

func (h *Handler) CreateReport(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		ReportedID     string  `json:"reportedId"`
		ConversationID *string `json:"conversationId,omitempty"`
		Reason         string  `json:"reason"`
		Description    string  `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	reportedUUID, err := uuid.Parse(body.ReportedID)
	if err != nil {
		http.Error(w, "Invalid reported user ID", http.StatusBadRequest)
		return
	}

	var convUUID *uuid.UUID
	if body.ConversationID != nil && *body.ConversationID != "" {
		if parsed, err := uuid.Parse(*body.ConversationID); err == nil {
			convUUID = &parsed
		}
	}

	report, isNew, err := h.ModService.CreateReport(user.ID, reportedUUID, convUUID, body.Reason, body.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if isNew {
		telemetry.Monitor.RecordEvent(telemetry.EventUserReport)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

func (h *Handler) BlockUser(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetAuthenticatedUser(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		BlockedID string `json:"blockedId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	blockedUUID, err := uuid.Parse(body.BlockedID)
	if err != nil {
		http.Error(w, "Invalid blocked user ID", http.StatusBadRequest)
		return
	}

	block, err := h.ModService.BlockUser(user.ID, blockedUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Immediately update in-memory matchmaking block table
	h.MatchEngine.AddBlock(user.ID.String(), body.BlockedID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(block)
}
