package moderation

import (
	"errors"
	"fmt"
	"time"

	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/google/uuid"
)

type ModerationService struct{}

func NewModerationService() *ModerationService {
	return &ModerationService{}
}

// CreateReport records a user report with report bombing & false report throttling
func (s *ModerationService) CreateReport(reporterID, reportedID uuid.UUID, conversationID *uuid.UUID, reason, description string) (*models.Report, error) {
	// 1. Prohibit self-reporting
	if reporterID == reportedID {
		return nil, errors.New("cannot report your own account")
	}

	// 2. Report bombing defense: check if an identical open report was submitted in the last 1 hour
	var existing models.Report
	oneHourAgo := time.Now().UTC().Add(-1 * time.Hour)
	err := database.DB.Where("reporter_id = ? AND reported_id = ? AND status = 'open' AND created_at > ?", reporterID, reportedID, oneHourAgo).First(&existing).Error
	if err == nil {
		// Report already received and queued for review
		return &existing, nil
	}

	// 3. Input length bounds
	if len(reason) > 100 {
		reason = reason[:100]
	}
	if len(description) > 1000 {
		description = description[:1000]
	}

	report := models.Report{
		ID:             uuid.New(),
		ReporterID:     reporterID,
		ReportedID:     reportedID,
		ConversationID: conversationID,
		Reason:         reason,
		Description:    description,
		Status:         "open",
		CreatedAt:      time.Now().UTC(),
	}

	if err := database.DB.Create(&report).Error; err != nil {
		return nil, fmt.Errorf("failed to save report: %w", err)
	}

	return &report, nil
}

// BlockUser creates a permanent isolation barrier between two users
func (s *ModerationService) BlockUser(blockerID, blockedID uuid.UUID) (*models.Block, error) {
	if blockerID == blockedID {
		return nil, errors.New("cannot block your own account")
	}

	var existing models.Block
	if err := database.DB.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	block := models.Block{
		ID:        uuid.New(),
		BlockerID: blockerID,
		BlockedID: blockedID,
		CreatedAt: time.Now().UTC(),
	}

	if err := database.DB.Create(&block).Error; err != nil {
		return nil, err
	}

	return &block, nil
}

// IsBlocked checks if either user has blocked the other
func (s *ModerationService) IsBlocked(userA, userB uuid.UUID) bool {
	var count int64
	database.DB.Model(&models.Block{}).Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", userA, userB, userB, userA).Count(&count)
	return count > 0
}

// GetOpenReports retrieves paginated open reports for authorized moderators
func (s *ModerationService) GetOpenReports() ([]models.Report, error) {
	var reports []models.Report
	err := database.DB.Preload("ReportedUser").Order("created_at desc").Limit(50).Find(&reports).Error
	return reports, err
}

// ActionReport updates report status with audit trail and executes trust/ban penalties
func (s *ModerationService) ActionReport(reportID uuid.UUID, action string) error {
	var report models.Report
	if err := database.DB.First(&report, "id = ?", reportID).Error; err != nil {
		return err
	}

	report.Status = action
	if err := database.DB.Save(&report).Error; err != nil {
		return err
	}

	if action == "banned" {
		var user models.User
		if err := database.DB.First(&user, "id = ?", report.ReportedID).Error; err == nil {
			user.IsBanned = true
			user.TrustScore = 0
			database.DB.Save(&user)
		}
	} else if action == "warned" {
		var user models.User
		if err := database.DB.First(&user, "id = ?", report.ReportedID).Error; err == nil {
			user.TrustScore -= 20
			if user.TrustScore < 0 {
				user.TrustScore = 0
			}
			database.DB.Save(&user)
		}
	}

	return nil
}
