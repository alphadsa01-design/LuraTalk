package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// SecurityHeaders sets standard OWASP HTTP defense-in-depth headers
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")

		next.ServeHTTP(w, r)
	})
}

// RequestSizeLimiter restricts incoming payload sizes to prevent memory DoS attacks
func RequestSizeLimiter(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}

type clientRate struct {
	tokens     int
	lastRefill time.Time
}

// IPRateLimiter provides per-IP token bucket rate limiting
type IPRateLimiter struct {
	mu       sync.Mutex
	clients  map[string]*clientRate
	rate     int           // tokens per interval
	interval time.Duration // refill window
	capacity int           // max burst
}

func NewIPRateLimiter(rate int, interval time.Duration) *IPRateLimiter {
	limiter := &IPRateLimiter{
		clients:  make(map[string]*clientRate),
		rate:     rate,
		interval: interval,
		capacity: rate,
	}

	// Periodic cleanup of stale client IPs every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			limiter.mu.Lock()
			now := time.Now()
			for ip, cr := range limiter.clients {
				if now.Sub(cr.lastRefill) > 10*time.Minute {
					delete(limiter.clients, ip)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

func (lim *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)

		lim.mu.Lock()
		cr, exists := lim.clients[ip]
		now := time.Now()

		if !exists {
			lim.clients[ip] = &clientRate{
				tokens:     lim.capacity - 1,
				lastRefill: now,
			}
			lim.mu.Unlock()
			next.ServeHTTP(w, r)
			return
		}

		// Refill tokens
		elapsed := now.Sub(cr.lastRefill)
		if elapsed > lim.interval {
			cr.tokens = lim.capacity
			cr.lastRefill = now
		}

		if cr.tokens <= 0 {
			lim.mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"Too many requests. Please slow down."}`))
			return
		}

		cr.tokens--
		lim.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
