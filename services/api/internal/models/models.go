package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StringArray is a custom JSON-serializable string slice for cross-DB compatibility (Postgres & SQLite)
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(value interface{}) error {
	if value == nil {
		*a = []string{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		str, ok := value.(string)
		if !ok {
			return errors.New("cannot scan into StringArray")
		}
		bytes = []byte(str)
	}
	return json.Unmarshal(bytes, a)
}

type User struct {
	ID              uuid.UUID   `gorm:"type:uuid;primary_key;" json:"id"`
	IsAnonymous     bool        `gorm:"default:true" json:"isAnonymous"`
	Username        string      `gorm:"size:64;not null" json:"username"`
	Email           *string     `gorm:"size:255;uniqueIndex" json:"email,omitempty"`
	AvatarID        string      `gorm:"size:50;default:'aura_1'" json:"avatarId"`
	Bio             string      `gorm:"type:text" json:"bio,omitempty"`
	CountryCode     string      `gorm:"size:5" json:"countryCode,omitempty"`
	NativeLanguage  string      `gorm:"size:10;default:'en'" json:"nativeLanguage"`
	TargetLanguages StringArray `gorm:"type:text" json:"targetLanguages"`
	Interests       StringArray `gorm:"type:text" json:"interests"`
	Mood            string      `gorm:"size:50;default:'chill'" json:"mood"`
	Intention       string      `gorm:"size:50;default:'casual'" json:"intention"`
	TrustScore      int         `gorm:"default:100" json:"trustScore"`
	IsBanned        bool        `gorm:"default:false" json:"isBanned"`
	OneQuestionAns  string      `gorm:"type:text" json:"oneQuestionAnswer,omitempty"`
	CreatedAt       time.Time   `json:"createdAt"`
	UpdatedAt       time.Time   `json:"updatedAt"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	if u.TargetLanguages == nil {
		u.TargetLanguages = StringArray{}
	}
	if u.Interests == nil {
		u.Interests = StringArray{}
	}
	return nil
}

type AnonymousSession struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	SessionToken      string    `gorm:"size:255;uniqueIndex;not null" json:"sessionToken"`
	UserID            uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	User              User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	DeviceFingerprint string    `gorm:"size:255" json:"deviceFingerprint,omitempty"`
	IPHash            string    `gorm:"size:255" json:"ipHash,omitempty"`
	ExpiresAt         time.Time `json:"expiresAt"`
	CreatedAt         time.Time `json:"createdAt"`
}

func (s *AnonymousSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

type Friendship struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	FriendID  uuid.UUID `gorm:"type:uuid;index;not null" json:"friendId"`
	Friend    *User     `gorm:"foreignKey:FriendID" json:"friend,omitempty"`
	Status    string    `gorm:"size:20;default:'pending'" json:"status"` // pending, accepted, rejected
	CreatedAt time.Time `json:"createdAt"`
}

type Block struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	BlockerID uuid.UUID `gorm:"type:uuid;index;not null" json:"blockerId"`
	BlockedID uuid.UUID `gorm:"type:uuid;index;not null" json:"blockedId"`
	CreatedAt time.Time `json:"createdAt"`
}

type Report struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	ReporterID     uuid.UUID `gorm:"type:uuid;index" json:"reporterId"`
	ReportedID     uuid.UUID `gorm:"type:uuid;index;not null" json:"reportedId"`
	ReportedUser   *User     `gorm:"foreignKey:ReportedID" json:"reportedUser,omitempty"`
	ConversationID *uuid.UUID `gorm:"type:uuid" json:"conversationId,omitempty"`
	Reason         string    `gorm:"size:100;not null" json:"reason"`
	Description    string    `gorm:"type:text" json:"description"`
	Status         string    `gorm:"size:20;default:'open'" json:"status"` // open, reviewed, actioned, dismissed
	CreatedAt      time.Time `json:"createdAt"`
}

type Conversation struct {
	ID              uuid.UUID   `gorm:"type:uuid;primary_key;" json:"id"`
	RoomName        string      `gorm:"size:100;uniqueIndex;not null" json:"roomName"`
	Type            string      `gorm:"size:30;default:'random_voice'" json:"type"`
	DurationSeconds int         `gorm:"default:0" json:"durationSeconds"`
	Messages        []Message   `gorm:"foreignKey:ConversationID" json:"messages,omitempty"`
	CreatedAt       time.Time   `json:"createdAt"`
	EndedAt         *time.Time  `json:"endedAt,omitempty"`
}

type ConversationParticipant struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	ConversationID uuid.UUID `gorm:"type:uuid;index;not null" json:"conversationId"`
	UserID         uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	JoinedAt       time.Time `json:"joinedAt"`
	LeftAt         *time.Time `json:"leftAt,omitempty"`
}

type Message struct {
	ID                uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	ConversationID    uuid.UUID  `gorm:"type:uuid;index;not null" json:"conversationId"`
	SenderID          uuid.UUID  `gorm:"type:uuid;index;not null" json:"senderId"`
	SenderName        string     `gorm:"size:64" json:"senderName"`
	Content           string     `gorm:"type:text;not null" json:"content"`
	IsTranslated      bool       `gorm:"default:false" json:"isTranslated"`
	TranslatedContent string     `gorm:"type:text" json:"translatedContent,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
}

type Room struct {
	ID                  uuid.UUID   `gorm:"type:uuid;primary_key;" json:"id"`
	Title               string      `gorm:"size:120;not null" json:"title"`
	Topic               string      `gorm:"size:60;not null" json:"topic"`
	Description         string      `gorm:"type:text" json:"description"`
	MaxParticipants     int         `gorm:"default:12" json:"maxParticipants"`
	CurrentParticipants int         `gorm:"default:1" json:"currentParticipants"`
	IsActive            bool        `gorm:"default:true" json:"isActive"`
	CreatedBy           uuid.UUID   `gorm:"type:uuid;not null" json:"createdBy"`
	Tags                StringArray `gorm:"type:text" json:"tags"`
	CreatedAt           time.Time   `json:"createdAt"`
}

type ConversationMemory struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	FriendID     uuid.UUID `gorm:"type:uuid;index;not null" json:"friendId"`
	TopicSummary string    `gorm:"type:text;not null" json:"topicSummary"`
	CreatedAt    time.Time `json:"createdAt"`
}
