package middleware

import (
	"context"
	"net/http"
	"strings"

	"airtak/services/api/internal/auth"
	"airtak/services/api/internal/config"
	"airtak/services/api/internal/models"
	"airtak/services/api/internal/telemetry"

	"github.com/google/uuid"
)

type contextKey string

const (
	UserContextKey   contextKey = "authUser"
	ClaimsContextKey contextKey = "authClaims"
)

// AuthMiddleware extracts Bearer JWT token, validates claims, checks user ban status, and injects user into context
func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := auth.ExtractTokenFromRequest(r)
			if tokenStr == "" {
				telemetry.Monitor.RecordEvent(telemetry.EventAuthFailure)
				http.Error(w, "Unauthorized: missing authorization token", http.StatusUnauthorized)
				return
			}

			claims, err := auth.ValidateJWT(cfg, tokenStr)
			if err != nil {
				telemetry.Monitor.RecordEvent(telemetry.EventAuthFailure)
				http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
				return
			}

			userUUID, err := uuid.Parse(claims.UserID)
			if err != nil {
				http.Error(w, "Unauthorized: invalid user identification", http.StatusUnauthorized)
				return
			}

			user, err := auth.EnsureUserExists(userUUID, claims.Username, claims.IsAnonymous)
			if err != nil || user == nil {
				http.Error(w, "Unauthorized: user account error", http.StatusUnauthorized)
				return
			}

			if user.IsBanned {
				http.Error(w, "Forbidden: account is suspended", http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
			ctx = context.WithValue(ctx, UserContextKey, user)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetAuthenticatedUser retrieves the authenticated user from request context
func GetAuthenticatedUser(r *http.Request) *models.User {
	if val := r.Context().Value(UserContextKey); val != nil {
		if user, ok := val.(*models.User); ok {
			return user
		}
	}
	return nil
}

// GetAuthenticatedClaims retrieves the parsed JWT claims from request context
func GetAuthenticatedClaims(r *http.Request) *auth.Claims {
	if val := r.Context().Value(ClaimsContextKey); val != nil {
		if claims, ok := val.(*auth.Claims); ok {
			return claims
		}
	}
	return nil
}

// AdminAuthMiddleware validates admin API key from X-Admin-Key or Authorization header
func AdminAuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			adminKey := r.Header.Get("X-Admin-Key")
			if adminKey == "" {
				authHeader := r.Header.Get("Authorization")
				if strings.HasPrefix(authHeader, "Bearer ") {
					adminKey = strings.TrimPrefix(authHeader, "Bearer ")
				}
			}

			if adminKey == "" || adminKey != cfg.AdminAPIKey {
				http.Error(w, "Unauthorized: invalid or missing admin credentials", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
