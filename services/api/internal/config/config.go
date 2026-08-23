package config

import (
	"bufio"
	"log"
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
	env := getEnv("ENV", "development")

	jwtSecret := getEnv("JWT_SECRET", "aura_voice_super_secure_jwt_secret_key_2026")
	lkHost := getEnv("LIVEKIT_HOST", "http://localhost:7880")
	lkAPIKey := getEnv("LIVEKIT_API_KEY", "devkey")
	lkAPISecret := getEnv("LIVEKIT_API_SECRET", "secret_livekit_key_aura_voice_dev")
	corsOrigins := getEnv("CORS_ORIGINS", "https://luratalk.vercel.app,http://localhost:3000,http://127.0.0.1:3000")
	adminKey := getEnv("ADMIN_API_KEY", "aura_admin_master_secret_key_2026")
	stunURL := getEnv("STUN_SERVER_URL", "stun:stun.l.google.com:19302")
	webhookSecret := getEnv("PAYMENT_WEBHOOK_SECRET", "whsec_aura_payment_secret_2026")
	maxUpload := int64(getEnvAsInt("UPLOAD_MAX_BYTES", 2097152))
	rateLimit := getEnvAsInt("RATE_LIMIT_PER_MIN", 120)

	// In production, warn if critical security secrets are missing or using dev defaults
	if strings.ToLower(env) == "production" {
		if os.Getenv("JWT_SECRET") == "" || os.Getenv("JWT_SECRET") == "aura_voice_super_secure_jwt_secret_key_2026" {
			log.Println("WARNING: JWT_SECRET is not set in production; using server-generated fallback")
		}
		if os.Getenv("LIVEKIT_API_SECRET") == "" || os.Getenv("LIVEKIT_API_SECRET") == "secret_livekit_key_aura_voice_dev" {
			log.Println("WARNING: LIVEKIT_API_SECRET is not set or using default; LiveKit token generation will use fallback")
		}
		if os.Getenv("ADMIN_API_KEY") == "" || os.Getenv("ADMIN_API_KEY") == "aura_admin_master_secret_key_2026" {
			log.Println("WARNING: ADMIN_API_KEY is not set or using default")
		}
	}

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

func (c *Config) GetParsedAllowedOrigins() []string {
	if c.CORSAllowedOrigins == "" {
		return []string{"https://luratalk.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"}
	}
	parts := strings.Split(c.CORSAllowedOrigins, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func (c *Config) IsOriginAllowed(origin string) bool {
	if origin == "" {
		return true // Allow non-browser clients / tools
	}
	// Always allow all localhost, 127.0.0.1, and all Vercel domains (*.vercel.app)
	if strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1") || strings.Contains(origin, ".vercel.app") || strings.Contains(origin, "luratalk") {
		return true
	}
	allowed := c.GetParsedAllowedOrigins()
	for _, a := range allowed {
		if a == "*" || a == origin {
			return true
		}
	}
	return false
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
