package livekit

import (
	"time"

	"airtak/services/api/internal/config"

	"github.com/livekit/protocol/auth"
)

type TokenGenerator struct {
	cfg *config.Config
}

func NewTokenGenerator(cfg *config.Config) *TokenGenerator {
	return &TokenGenerator{cfg: cfg}
}

func (tg *TokenGenerator) GenerateRoomToken(roomName, participantIdentity, participantName string, isPublisher bool) (string, error) {
	at := auth.NewAccessToken(tg.cfg.LiveKitAPIKey, tg.cfg.LiveKitAPISecret)
	
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         roomName,
		CanPublish:   &isPublisher,
		CanSubscribe: func() *bool { b := true; return &b }(),
	}

	at.AddGrant(grant).
		SetIdentity(participantIdentity).
		SetName(participantName).
		SetValidFor(30 * time.Minute)

	return at.ToJWT()
}

func (tg *TokenGenerator) GetLiveKitURL() string {
	return tg.cfg.LiveKitHost
}
