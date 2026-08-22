package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"airtak/services/api/internal/config"
	"airtak/services/api/internal/database"
	"airtak/services/api/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	adjectives = []string{"Cosmic", "Neon", "Velvet", "Solar", "Echo", "Misty", "Starlit", "Shadow", "Amber", "Quantum", "Hyper", "Astral", "Silent", "Midnight", "Radiant", "Vivid", "Mystic", "Azure"}
	nouns      = []string{"Voyager", "Drifter", "Wanderer", "Nomad", "Echo", "Pilot", "Falcon", "Ghost", "Lynx", "Pulse", "Rider", "Phoenix", "Sparrow", "Seeker", "Orbit", "Beacon", "Vibe", "Specter"}
)

type Claims struct {
	UserID      string `json:"userId"`
	Username    string `json:"username"`
	IsAnonymous bool   `json:"isAnonymous"`
	jwt.RegisteredClaims
}

type AuthResponse struct {
	Token        string             `json:"token"`
	SessionToken string             `json:"sessionToken"`
	User         models.User        `json:"user"`
	ExpiresAt    time.Time          `json:"expiresAt"`
}

func GenerateRandomUsername() string {
	adjIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(adjectives))))
	nounIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(nouns))))
	num, _ := rand.Int(rand.Reader, big.NewInt(999))
	return fmt.Sprintf("%s%s%03d", adjectives[adjIdx.Int64()], nouns[nounIdx.Int64()], num.Int64())
}

func CreateAnonymousSession(cfg *config.Config, deviceFingerprint, ipHash string) (*AuthResponse, error) {
	username := GenerateRandomUsername()
	user := models.User{
		ID:              uuid.New(),
		IsAnonymous:     true,
		Username:        username,
		AvatarID:        fmt.Sprintf("aura_%d", time.Now().UnixNano()%12+1),
		NativeLanguage:  "en",
		TargetLanguages: models.StringArray{"en"},
		Interests:       models.StringArray{"music", "technology", "movies"},
		Mood:            "chill",
		Intention:       "casual",
		TrustScore:      100,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return nil, err
	}

	rawBytes := make([]byte, 32)
	rand.Read(rawBytes)
	sessionToken := hex.EncodeToString(rawBytes)

	expiresAt := time.Now().UTC().Add(7 * 24 * time.Hour)
	session := models.AnonymousSession{
		ID:                uuid.New(),
		SessionToken:      sessionToken,
		UserID:            user.ID,
		DeviceFingerprint: deviceFingerprint,
		IPHash:            ipHash,
		ExpiresAt:         expiresAt,
		CreatedAt:         time.Now().UTC(),
	}

	if err := database.DB.Create(&session).Error; err != nil {
		return nil, err
	}

	jwtToken, err := GenerateJWT(cfg, user.ID.String(), user.Username, true, expiresAt)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token:        jwtToken,
		SessionToken: sessionToken,
		User:         user,
		ExpiresAt:    expiresAt,
	}, nil
}

func GenerateJWT(cfg *config.Config, userID, username string, isAnonymous bool, expiresAt time.Time) (string, error) {
	claims := Claims{
		UserID:      userID,
		Username:    username,
		IsAnonymous: isAnonymous,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			Issuer:    "auravoice-auth",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

func ValidateJWT(cfg *config.Config, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid authorization token")
}

func ExtractTokenFromRequest(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
	}
	return ""
}

func UpgradeAnonymousUser(cfg *config.Config, userID uuid.UUID, email, newUsername string) (*models.User, error) {
	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}

	// Check if email is already taken
	var existing models.User
	if err := database.DB.Where("email = ? AND id != ?", email, userID).First(&existing).Error; err == nil {
		return nil, errors.New("email is already in use by another account")
	}

	user.Email = &email
	if newUsername != "" {
		user.Username = newUsername
	}
	user.IsAnonymous = false
	user.UpdatedAt = time.Now().UTC()

	if err := database.DB.Save(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func GetUserByID(userID uuid.UUID) (*models.User, error) {
	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}
