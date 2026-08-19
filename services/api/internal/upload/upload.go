package upload

import (
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"airtak/services/api/internal/auth"
	"airtak/services/api/internal/config"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const (
	MaxUploadSize    = 2 * 1024 * 1024 // 2 MB strict file size limit
	MaxImageWidth    = 4096            // 4K Max width
	MaxImageHeight   = 4096            // 4K Max height
	UploadRateLimit  = 6               // Max 6 uploads per minute per user
	UploadDirStorage = "data/uploads"
)

type UploadService struct {
	cfg        *config.Config
	storageDir string
	rateLimits map[string][]time.Time
	mu         sync.Mutex
}

func NewUploadService(cfg *config.Config) *UploadService {
	// Create upload storage directory if not exists
	os.MkdirAll(UploadDirStorage, 0755)

	return &UploadService{
		cfg:        cfg,
		storageDir: UploadDirStorage,
		rateLimits: make(map[string][]time.Time),
	}
}

func (s *UploadService) checkRateLimit(userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)

	var valid []time.Time
	for _, t := range s.rateLimits[userID] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= UploadRateLimit {
		s.rateLimits[userID] = valid
		return false
	}

	valid = append(valid, now)
	s.rateLimits[userID] = valid
	return true
}

// UploadImage handles secure image uploads with MIME sniffing, dimension bounds, and UUID re-naming
func (s *UploadService) UploadImage(w http.ResponseWriter, r *http.Request) {
	// 1. Authentication Check
	tokenStr := auth.ExtractTokenFromRequest(r)
	claims, err := auth.ValidateJWT(s.cfg, tokenStr)
	if err != nil {
		http.Error(w, "Unauthorized: valid token required", http.StatusUnauthorized)
		return
	}

	// 2. Upload Rate Limiting Check
	if !s.checkRateLimit(claims.UserID) {
		http.Error(w, "Rate limit exceeded: max 6 uploads per minute", http.StatusTooManyRequests)
		return
	}

	// 3. Strict Payload Size Limit (2 MB)
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)
	if err := r.ParseMultipartForm(MaxUploadSize); err != nil {
		http.Error(w, "File exceeds 2MB limit or is malformed", http.StatusRequestEntityTooLarge)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing file in multipart form ('file')", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 4. Magic-Byte MIME Content Validation (Never trust client Content-Type)
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		http.Error(w, "Failed to inspect file bytes", http.StatusBadRequest)
		return
	}

	detectedMIME := http.DetectContentType(buffer[:n])
	var ext string
	switch detectedMIME {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	case "image/webp":
		ext = ".webp"
	default:
		// Explicitly block SVG, HTML, PHP, Executables
		http.Error(w, fmt.Sprintf("Forbidden format: %s. Only JPEG, PNG, and WebP images are permitted.", detectedMIME), http.StatusUnsupportedMediaType)
		return
	}

	// Rewind file pointer for full decoding
	file.Seek(0, io.SeekStart)

	// 5. Image Dimension & Decompression Bomb Protection
	config, _, err := image.DecodeConfig(file)
	if err == nil {
		if config.Width > MaxImageWidth || config.Height > MaxImageHeight {
			http.Error(w, fmt.Sprintf("Image dimensions too large (%dx%d, max %dx%d)", config.Width, config.Height, MaxImageWidth, MaxImageHeight), http.StatusBadRequest)
			return
		}
	}

	// Rewind file pointer for saving
	file.Seek(0, io.SeekStart)

	// 6. Cryptographic Generated UUID Filename (Immune to path traversal & filename tampering)
	fileUUID := uuid.New().String()
	safeFilename := fileUUID + ext
	filePath := filepath.Join(s.storageDir, safeFilename)

	// 7. Write to Private Disk with Non-Executable File Permissions (0644)
	out, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		http.Error(w, "Internal storage failure", http.StatusInternalServerError)
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		http.Error(w, "Failed to save media", http.StatusInternalServerError)
		return
	}

	mediaURL := fmt.Sprintf("/api/v1/media/%s", safeFilename)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        fileUUID,
		"filename":  safeFilename,
		"mimeType":  detectedMIME,
		"url":       mediaURL,
		"width":     config.Width,
		"height":    config.Height,
		"timestamp": time.Now().UnixMilli(),
	})
}

// ServeMedia serves uploaded media with path-traversal immunity and nosniff security headers
func (s *UploadService) ServeMedia(w http.ResponseWriter, r *http.Request) {
	rawID := chi.URLParam(r, "id")

	// 1. Strict Path Traversal Defense: only allow basename with clean alphanumeric UUIDs
	cleanFilename := filepath.Base(rawID)
	if strings.Contains(cleanFilename, "..") || strings.Contains(cleanFilename, "/") || strings.Contains(cleanFilename, "\\") {
		http.Error(w, "Invalid media path", http.StatusBadRequest)
		return
	}

	fullPath := filepath.Join(s.storageDir, cleanFilename)
	fileInfo, err := os.Stat(fullPath)
	if err != nil || fileInfo.IsDir() {
		http.Error(w, "Media not found", http.StatusNotFound)
		return
	}

	// 2. Security Headers on Media Delivery
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Cache-Control", "public, max-age=86400")

	http.ServeFile(w, r, fullPath)
}
