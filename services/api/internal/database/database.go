package database

import (
	"log"
	"strings"
	"time"

	"airtak/services/api/internal/config"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	if strings.HasPrefix(cfg.DatabaseURL, "postgres://") || strings.HasPrefix(cfg.DatabaseURL, "postgresql://") {
		dialector = postgres.Open(cfg.DatabaseURL)
	} else {
		// Use SQLite for local development or fallback
		dialector = sqlite.Open(cfg.DatabaseURL)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.New(
			log.New(log.Writer(), "\r\n[SQL] ", log.LstdFlags),
			logger.Config{
				SlowThreshold:             200 * time.Millisecond, // Alert on queries exceeding 200ms
				LogLevel:                  logger.Warn,
				IgnoreRecordNotFoundError: true,
				Colorful:                  true,
			},
		),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
		PrepareStmt: true, // Prepared statements for query plan caching & SQL injection defense
	})
	if err != nil {
		return nil, err
	}

	// Configure Production Connection Pool
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(50)                  // Max simultaneous open connections
		sqlDB.SetMaxIdleConns(25)                  // Max idle connections in pool
		sqlDB.SetConnMaxLifetime(10 * time.Minute) // Maximum duration a connection may be reused
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)  // Close idle connections after 5m
	}

	// Auto-migrate tables
	err = db.AutoMigrate(
		&models.User{},
		&models.AnonymousSession{},
		&models.Friendship{},
		&models.Block{},
		&models.Report{},
		&models.Conversation{},
		&models.ConversationParticipant{},
		&models.Message{},
		&models.Room{},
		&models.ConversationMemory{},
	)
	if err != nil {
		log.Printf("Warning during AutoMigrate: %v", err)
	}

	DB = db
	seedDefaultRooms(db)

	return db, nil
}

func seedDefaultRooms(db *gorm.DB) {
	var count int64
	db.Model(&models.Room{}).Count(&count)
	if count > 0 {
		return
	}

	systemAdminID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	defaultRooms := []models.Room{
		{
			ID:                  uuid.New(),
			Title:               "🎮 Late Night Gaming & Co-Op",
			Topic:               "Gaming",
			Description:         "Drop in to talk about Steam gems, RPGs, esports, or find your next duo partner.",
			MaxParticipants:     15,
			CurrentParticipants: 0,
			IsActive:            true,
			CreatedBy:           systemAdminID,
			Tags:                models.StringArray{"gaming", "steam", "fps", "chill"},
			CreatedAt:           time.Now().UTC(),
		},
		{
			ID:                  uuid.New(),
			Title:               "🌍 English & Language Exchange",
			Topic:               "Language",
			Description:         "Practice spoken English, Spanish, Japanese, or any language in a friendly zero-judgment zone.",
			MaxParticipants:     12,
			CurrentParticipants: 0,
			IsActive:            true,
			CreatedBy:           systemAdminID,
			Tags:                models.StringArray{"language", "english", "practice", "culture"},
			CreatedAt:           time.Now().UTC(),
		},
		{
			ID:                  uuid.New(),
			Title:               "🌌 3 AM Deep Thoughts & Philosophy",
			Topic:               "Deep Conversations",
			Description:         "Life, the universe, consciousness, and whatever is on your mind late at night.",
			MaxParticipants:     10,
			CurrentParticipants: 0,
			IsActive:            true,
			CreatedBy:           systemAdminID,
			Tags:                models.StringArray{"deep", "philosophy", "night", "chill"},
			CreatedAt:           time.Now().UTC(),
		},
		{
			ID:                  uuid.New(),
			Title:               "🎵 Indie Vibes & Music Producers",
			Topic:               "Music",
			Description:         "Share underground tracks, talk production techniques, and discover new artists.",
			MaxParticipants:     15,
			CurrentParticipants: 0,
			IsActive:            true,
			CreatedBy:           systemAdminID,
			Tags:                models.StringArray{"music", "indie", "production", "beats"},
			CreatedAt:           time.Now().UTC(),
		},
		{
			ID:                  uuid.New(),
			Title:               "⚡ Tech Founders & Builders Lounge",
			Topic:               "Technology",
			Description:         "Building cool software, AI agents, indie hacking, and open source.",
			MaxParticipants:     20,
			CurrentParticipants: 0,
			IsActive:            true,
			CreatedBy:           systemAdminID,
			Tags:                models.StringArray{"tech", "coding", "ai", "startups"},
			CreatedAt:           time.Now().UTC(),
		},
	}

	for _, r := range defaultRooms {
		db.Create(&r)
	}
	log.Printf("Successfully seeded %d topic rooms.", len(defaultRooms))
}
