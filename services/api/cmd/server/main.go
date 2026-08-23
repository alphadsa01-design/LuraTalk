package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"airtak/services/api/internal/ai"
	"airtak/services/api/internal/config"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/games"
	"airtak/services/api/internal/handlers"
	"airtak/services/api/internal/livekit"
	"airtak/services/api/internal/matchmaking"
	apimw "airtak/services/api/internal/middleware"
	"airtak/services/api/internal/models"
	"airtak/services/api/internal/moderation"
	"airtak/services/api/internal/realtime"
	"airtak/services/api/internal/trust"
	"airtak/services/api/internal/upload"

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

	// Hydrate persistent database blocks into memory on server boot
	var initialBlocks []models.Block
	if err := database.DB.Find(&initialBlocks).Error; err == nil {
		matchEngine.HydrateBlocks(initialBlocks)
	}

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

	// CORS Allowlist Defense (Strictly locked to configured origins)
	corsOpts := cors.Options{
		AllowedOrigins:   cfg.GetParsedAllowedOrigins(),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Admin-Key", "Origin"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
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
		// Public routes
		api.Post("/auth/anonymous", h.CreateAnonymousSession)
		api.Get("/stats/online", h.GetPublicStats)
		api.Get("/rooms", h.GetRooms)
		api.Get("/media/{id}", uploadService.ServeMedia)

		// Protected User Routes (AuthMiddleware)
		api.Group(func(protected chi.Router) {
			protected.Use(apimw.AuthMiddleware(cfg))

			protected.Post("/auth/upgrade", h.UpgradeAccount)
			protected.Get("/users/me", h.GetMe)
			protected.Put("/users/me/preferences", h.UpdatePreferences)

			protected.Post("/rooms", h.CreateRoom)
			protected.Get("/rooms/{id}/token", h.GetRoomToken)

			protected.Get("/friends", h.GetFriends)
			protected.Post("/friends/add", h.AddFriend)
			protected.Post("/friends/accept", h.AcceptFriendRequest)
			protected.Delete("/friends/{id}", h.RemoveFriend)

			protected.Get("/memories", h.GetMemories)
			protected.Post("/memories", h.SaveMemory)
			protected.Delete("/memories/{id}", h.DeleteMemory)

			protected.Get("/history", h.GetHistory)
			protected.Delete("/history/{id}", h.DeleteHistory)

			protected.Post("/upload", uploadService.UploadImage)
			protected.Post("/report", h.CreateReport)
			protected.Post("/block", h.BlockUser)
		})

		// Admin & Moderation Routes (AdminAuthMiddleware)
		api.Group(func(admin chi.Router) {
			admin.Use(apimw.AdminAuthMiddleware(cfg))

			admin.Get("/admin/stats", h.GetAdminStats)
			admin.Get("/admin/reports", h.GetAdminReports)
			admin.Post("/admin/reports/{id}/action", h.ActionAdminReport)
			admin.Post("/admin/rooms", h.AdminCreateRoom)
			admin.Delete("/admin/rooms/{id}", h.AdminDeleteRoom)
			admin.Post("/admin/users/{id}/revoke", h.AdminRevokeUser)
		})
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

	// Render Self-Ping Keep-Alive Worker (prevents free instance from sleeping)
	go func() {
		targetURL := os.Getenv("RENDER_EXTERNAL_URL")
		if targetURL == "" {
			targetURL = os.Getenv("KEEP_ALIVE_URL")
		}
		if targetURL != "" {
			healthEndpoint := fmt.Sprintf("%s/health", targetURL)
			log.Printf("[KeepAlive] Auto self-ping worker activated for %s (pings every 10m)", healthEndpoint)
			ticker := time.NewTicker(10 * time.Minute)
			defer ticker.Stop()
			client := &http.Client{Timeout: 10 * time.Second}

			for range ticker.C {
				resp, err := client.Get(healthEndpoint)
				if err != nil {
					log.Printf("[KeepAlive] Warning: Self-ping failed: %v", err)
				} else {
					resp.Body.Close()
					log.Printf("[KeepAlive] Self-ping successful (status: %d)", resp.StatusCode)
				}
			}
		}
	}()

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
