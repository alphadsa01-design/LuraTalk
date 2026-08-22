package moderation

import (
	"testing"
	"time"

	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		t.Fatalf("Failed to open test in-memory DB: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Report{},
		&models.Block{},
	)
	if err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	database.DB = db
	return db
}

func TestSelfReportForbidden(t *testing.T) {
	setupTestDB(t)
	mod := NewModerationService()

	userID := uuid.New()
	_, _, err := mod.CreateReport(userID, userID, nil, "harassment", "reported myself")
	if err == nil {
		t.Errorf("Expected error when user reports themselves, got nil")
	}
}

func TestReportSpamDeduping(t *testing.T) {
	db := setupTestDB(t)
	mod := NewModerationService()

	reporterID := uuid.New()
	reportedID := uuid.New()

	reportedUser := models.User{
		ID:         reportedID,
		Username:   "innocent_user",
		TrustScore: 100,
		IsBanned:   false,
	}
	db.Create(&reportedUser)

	// 1st report from reporter -> isNew == true
	rep1, isNew1, err1 := mod.CreateReport(reporterID, reportedID, nil, "spam", "first report")
	if err1 != nil || !isNew1 || rep1 == nil {
		t.Fatalf("Expected first report to succeed and be new: err=%v, isNew=%v", err1, isNew1)
	}

	// 2nd, 3rd, 4th, 5th repeated report spam from same reporter -> isNew == false (deduped!)
	for i := 2; i <= 5; i++ {
		_, isNew, err := mod.CreateReport(reporterID, reportedID, nil, "spam", "spam report attempt")
		if err != nil {
			t.Fatalf("Report check returned unexpected error: %v", err)
		}
		if isNew {
			t.Errorf("Expected report spam attempt %d to be deduped (isNew=false), got isNew=true", i)
		}
	}

	// Verify database only has 1 report row
	var reportCount int64
	db.Model(&models.Report{}).Where("reporter_id = ? AND reported_id = ?", reporterID, reportedID).Count(&reportCount)
	if reportCount != 1 {
		t.Errorf("Expected exactly 1 report row in database, found %d", reportCount)
	}
}

func TestReportActionWhitelisting(t *testing.T) {
	db := setupTestDB(t)
	mod := NewModerationService()

	reporterID := uuid.New()
	reportedID := uuid.New()

	targetUser := models.User{
		ID:         reportedID,
		Username:   "offender_user",
		TrustScore: 80,
		IsBanned:   false,
	}
	db.Create(&targetUser)

	report, _, _ := mod.CreateReport(reporterID, reportedID, nil, "abusive", "bad behavior")

	// 1. Invalid status must be rejected
	err := mod.ActionReport(report.ID, "custom_arbitrary_string")
	if err == nil {
		t.Errorf("Expected invalid report action to be rejected, got nil")
	}

	// 2. Valid status "banned" must ban the user
	err = mod.ActionReport(report.ID, "banned")
	if err != nil {
		t.Fatalf("Failed to execute valid action 'banned': %v", err)
	}

	var updatedUser models.User
	db.First(&updatedUser, "id = ?", reportedID)
	if !updatedUser.IsBanned || updatedUser.TrustScore != 0 {
		t.Errorf("Expected user to be banned with trust score 0, got isBanned=%v trustScore=%d",
			updatedUser.IsBanned, updatedUser.TrustScore)
	}
}
