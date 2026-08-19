package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                 string
	DatabaseURL          string
	RedisURL             string
	JWTSecret            string
	LiveKitHost          string
	LiveKitAPIKey        string
	LiveKitAPISecret     string
	CORSAllowedOrigins   string
	Environment          string
	AdminAPIKey          string
	STUNServerURL        string
	PaymentWebhookSecret string
	UploadMaxBytes       int64
	RateLimitPerMin      int
}

// loadEnvFile reads a local .env file if present and sets environment variables
func loadEnvFile(paths ...string) {
	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
				if os.Getenv(k) == "" {
					os.Setenv(k, v)
				}
			}
		}
		break
	}
}

func LoadConfig() *Config {
	// Auto-load from .env if present
	loadEnvFile(".env", "../../.env", "../.env")

	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "auravoice.db") // SQLite embedded default
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379/0")
	jwtSecret := getEnv("JWT_SECRET", "aura_voice_super_secure_jwt_secret_key_2026")
	lkHost := getEnv("LIVEKIT_HOST", "http://localhost:7880")
	lkAPIKey := getEnv("LIVEKIT_API_KEY", "devkey")
	lkAPISecret := getEnv("LIVEKIT_API_SECRET", "secret_livekit_key_aura_voice_dev")
	corsOrigins := getEnv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
	env := getEnv("ENV", "development")
	adminKey := getEnv("ADMIN_API_KEY", "aura_admin_master_secret_key_2026")
	stunURL := getEnv("STUN_SERVER_URL", "stun:stun.l.google.com:19302")
	webhookSecret := getEnv("PAYMENT_WEBHOOK_SECRET", "whsec_aura_payment_secret_2026")
	maxUpload := int64(getEnvAsInt("UPLOAD_MAX_BYTES", 2097152))
	rateLimit := getEnvAsInt("RATE_LIMIT_PER_MIN", 120)

	return &Config{
		Port:                 port,
		DatabaseURL:          dbURL,
		RedisURL:             redisURL,
		JWTSecret:            jwtSecret,
		LiveKitHost:          lkHost,
		LiveKitAPIKey:        lkAPIKey,
		LiveKitAPISecret:     lkAPISecret,
		CORSAllowedOrigins:   corsOrigins,
		Environment:          env,
		AdminAPIKey:          adminKey,
		STUNServerURL:        stunURL,
		PaymentWebhookSecret: webhookSecret,
		UploadMaxBytes:       maxUpload,
		RateLimitPerMin:      rateLimit,
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}
