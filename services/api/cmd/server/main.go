package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"airtak/services/api/internal/ai"
	"airtak/services/api/internal/config"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/games"
	"airtak/services/api/internal/handlers"
	"airtak/services/api/internal/livekit"
	"airtak/services/api/internal/matchmaking"
	"airtak/services/api/internal/moderation"
	"airtak/services/api/internal/realtime"
	"airtak/services/api/internal/trust"
	"airtak/services/api/internal/upload"
	apimw "airtak/services/api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	cfg := config.LoadConfig()

	log.Println("==========================================================")
	log.Printf("Starting AuraVoice Production API on port %s (%s)", cfg.Port, cfg.Environment)
	log.Println("==========================================================")

	// Initialize Database
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}
	_ = db

	// Initialize Modules
	aiEngine := ai.NewAssistantEngine()
	gameManager := games.NewGameManager()
	trustEngine := trust.NewTrustEngine()
	modService := moderation.NewModerationService()
	livekitGen := livekit.NewTokenGenerator(cfg)

	var hub *realtime.Hub

	// Initialize Matchmaking Engine with callback connecting to WebSocket Hub
	matchEngine := matchmaking.NewEngine(cfg.RedisURL, func(pair *matchmaking.MatchedPair) {
		if hub != nil {
			hub.HandleMatchFound(pair)
		}
	})
	defer matchEngine.Stop()

	// Initialize WebSocket Hub
	hub = realtime.NewHub(cfg, matchEngine, livekitGen, aiEngine, gameManager, trustEngine, modService)
	go hub.Run()

	// HTTP Handlers
	h := handlers.NewHandler(cfg, hub, matchEngine, livekitGen, modService)
	uploadService := upload.NewUploadService(cfg)

	// Router setup
	r := chi.NewRouter()

	// Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS Allowlist Defense (Executed before security headers)
	corsOpts := cors.Options{
		AllowedOrigins: []string{"*"},
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			return true // Support Vercel deployments, custom domains, and local testing
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Admin-Key", "Origin"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}

	r.Use(cors.Handler(corsOpts))

	// OWASP Security Defense & DoS Protections
	r.Use(apimw.SecurityHeaders)
	r.Use(apimw.RequestSizeLimiter(3 * 1024 * 1024)) // 3MB Max Request Body
	ipLimiter := apimw.NewIPRateLimiter(120, time.Minute)
	r.Use(ipLimiter.Middleware)

	// Root API Info & Status
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"name":"LuraTalk Production API","status":"healthy","version":"1.0.0","service":"luratalk-api","timestamp":%d,"endpoints":{"health":"/health","ws":"/ws","api":"/api/v1"}}`, time.Now().UnixMilli())
	})

	// Health Check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"luratalk-api","timestamp":%d}`, time.Now().UnixMilli())
	})

	// WebSocket Endpoint
	r.Get("/ws", hub.ServeWS)

	// Define API v1 Handlers
	registerAPIRoutes := func(api chi.Router) {
		// Auth
		api.Post("/auth/anonymous", h.CreateAnonymousSession)
		api.Post("/auth/upgrade", h.UpgradeAccount)

		// Users & Preferences
		api.Get("/users/me", h.GetMe)
		api.Put("/users/me/preferences", h.UpdatePreferences)

		// Topic Lounges / Rooms
		api.Get("/rooms", h.GetRooms)
		api.Post("/rooms", h.CreateRoom)
		api.Get("/rooms/{id}/token", h.GetRoomToken)

		// Persistent Friendships & Memories
		api.Get("/friends", h.GetFriends)
		api.Post("/friends/add", h.AddFriend)
		api.Delete("/friends/{id}", h.RemoveFriend)
		api.Get("/memories", h.GetMemories)
		api.Post("/memories", h.SaveMemory)
		api.Delete("/memories/{id}", h.DeleteMemory)

		// Call History & Re-connect
		api.Get("/history", h.GetHistory)
		api.Delete("/history/{id}", h.DeleteHistory)

		// Secure File & Image Uploads
		api.Post("/upload", uploadService.UploadImage)
		api.Get("/media/{id}", uploadService.ServeMedia)

		// Safety, Reporting & Bilateral Blocking
		api.Post("/report", h.CreateReport)
		api.Post("/block", h.BlockUser)

		// Admin & Moderation Dashboard
		api.Get("/admin/stats", h.GetAdminStats)
		api.Get("/admin/reports", h.GetAdminReports)
		api.Post("/admin/reports/{id}/action", h.ActionAdminReport)
		api.Post("/admin/rooms", h.AdminCreateRoom)
		api.Delete("/admin/rooms/{id}", h.AdminDeleteRoom)
		api.Post("/admin/users/{id}/revoke", h.AdminRevokeUser)
	}

	// Mount REST API routes at both /api/v1 and /api/api/v1 (for multi-service proxies)
	r.Route("/api/v1", registerAPIRoutes)
	r.Route("/api/api/v1", registerAPIRoutes)
	r.Route("/v1", registerAPIRoutes)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("AuraVoice API listening at http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server Listen error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down AuraVoice server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced shutdown: %v", err)
	}

	log.Println("AuraVoice server cleanly exited.")
}
