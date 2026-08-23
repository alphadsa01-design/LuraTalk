# ==============================================================================
# Multi-Stage Production Dockerfile for LuraTalk Go API (Render / Railway / GCP)
# ==============================================================================

FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Cache Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/bin/server ./cmd/server/main.go

# ------------------------------------------------------------------------------
# Minimal Scratch/Alpine Runtime Image
# ------------------------------------------------------------------------------
FROM alpine:3.20

WORKDIR /app

# Add security certificates & timezone data
RUN apk add --no-cache ca-certificates tzdata

# Copy compiled binary from builder
COPY --from=builder /app/bin/server /app/server

# Expose default HTTP/WebSocket port
EXPOSE 8080

# Run binary
CMD ["/app/server"]
