# LuraTalk — Production-Grade Real-Time Voice Social Platform

> *"Meet someone worth talking to."*

LuraTalk is a high-performance, privacy-first random voice and text social platform. It features multi-dimensional matchmaking, LiveKit SFU voice routing with TURN fallback, real-time AI icebreakers, synchronized in-call mini-games, consensual friendships, and an enterprise Trust, Safety & Telemetry engine.

---

## 🚀 Key Features

* **Intelligent Multi-Dimensional Matchmaking**:
  - $O(1)$ queue insertion and instant ticket removal indexed by `MatchMode` and `userID`.
  - Non-blocking candidate scoring computed outside write locks.
  - Multi-dimensional compatibility matrix (Language practice, Jaccard interest overlap, Harmonic mood pairings, Conversation intention, and Trust normalization).
* **High-Definition Voice (LiveKit SFU + Enterprise TURN)**:
  - Primary audio routing via LiveKit SFU for 1-on-1 voice matches and multi-party Lounges (3+ participants).
  - Enterprise TURN relay fallback (`openrelay.metered.ca`) for symmetric NAT environments.
  - Opus packetization (20ms frames, inband FEC, DTX enabled) for crystal-clear low-latency audio.
* **Mystery Match Progression**:
  - **Level 1 (Stranger)**: Anonymous pseudonym, mood, and audio only.
  - **Level 2 (Common Ground)**: Mutual shared interest tags revealed upon mutual request.
  - **Level 3 (Full Profile & Friendship)**: Full profile reveal and consensual friend connection.
* **In-Call Synchronized Mini-Games**:
  - Live multiplayer Tic-Tac-Toe with turn indicators.
  - "Would You Rather" dilemma card decks.
  - Real-time Speed Trivia engine.
* **Non-Intrusive AI Conversation Assistant**:
  - Contextual conversation starters and talking points generated on-demand when silence is detected. Can be disabled with 1 click.
* **Community Lounges & Topic Stages**:
  - Multi-participant voice stages (Late Night Gaming, 3 AM Philosophy, Language Exchange, Tech Founders) powered by LiveKit SFU.
* **Consensual Friendships & Memory Notes**:
  - Safe friend request / accept workflow with bidirectional block enforcement.
  - Store non-sensitive, editable topic memory notes to pick up conversations right where you left off.
* **Trust, Safety & Security Hardening**:
  - Private trust score tracking (0–100) with report deduplication and self-report guards.
  - Ban actions restricted to authenticated moderation workflows.
  - Server-stamped WebSocket signal identity routing (`fromUserId`).
  - Strict proxy verification on rate limiter IP extraction (`X-Forwarded-For`).
  - Persistent block list hydration into memory on boot.
  - Bounded in-memory maps with automatic background TTL sweepers.

---

## 🏗 Architecture & Tech Stack

```
                          ┌────────────────────────┐
                          │   Client Browser/PWA   │
                          │      (Next.js 15)      │
                          └───────────┬────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 │ HTTPS/REST + WSS   │                    │ WebRTC / SFU Audio
                 ▼                    ▼                    ▼
        ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
        │  Go API Backend │  │   Go Realtime   │  │   LiveKit SFU   │
        │  (REST Service) │  │  (WebSockets)   │  │  (Media Server) │
        └────────┬────────┘  └────────┬────────┘  └─────────────────┘
                 │                    │
                 ├────────────────────┤
                 ▼                    ▼
        ┌─────────────────┐  ┌─────────────────┐
        │   PostgreSQL    │  │ SQLite Fallback │
        │ (Relational DB) │  │  (0-Config Dev) │
        └─────────────────┘  └─────────────────┘
```

* **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand, `livekit-client` SDK.
* **Backend**: Go 1.22+, Chi Router v5, Gorilla WebSocket, GORM, LiveKit Server Protocol, Crypto JWT.
* **Database**: PostgreSQL 16 (Production) / SQLite3 with WAL mode (Local Zero-Config Fallback).
* **Audio & Video**: LiveKit SFU Media Server, STUN (`stun.l.google.com:19302`), Enterprise TURN Relays.
* **Telemetry**: In-memory sliding-window security monitor with automatic anomaly spike detection.

---

## 🔒 Security & Architecture Hardening

| Component | Security & Performance Implementation |
| :--- | :--- |
| **Authentication** | Unified `AuthMiddleware` verifying Bearer JWT, claims, and ban status with request context injection. |
| **WebSocket Auth** | Strictly authenticated via RFC 6455 `Sec-WebSocket-Protocol: ["aura-auth", <token>]` or `Authorization` header. |
| **Data Protection** | Sanitized `UserPublic` DTO prevents leakage of `email`, `trustScore`, and `isBanned` to peers. |
| **Friendships** | Consensual bilateral approval (`status: 'pending'`) with mutual block guards. |
| **Username Integrity** | Regexp validation `^[a-zA-Z0-9_-]{3,30}$` with database uniqueness index. |
| **Rate Limiting** | Remote IP verification trusting forwarded headers only from verified private/loopback proxies. |
| **Matchmaker Memory** | Bounded maps with periodic 2-minute background TTL eviction sweepers for stale records. |
| **Signaling Security** | Server-stamped `fromUserId` on `webrtc:signal` prevents signal spoofing. |

---

## 💻 Local Development Setup

### Prerequisites
* **Go**: `1.22+`
* **Node.js**: `18+` and `npm`
* **Docker & Docker Compose** (Optional for containerized stack)

---

### Option 1: Native Local Run (Zero-Config Development)

#### 1. Backend (Go API & Real-Time WebSockets)
```bash
cd services/api
go run cmd/server/main.go
```
* The Go API will start on `http://localhost:8080` (auto-creates local SQLite database `auravoice.db` if PostgreSQL is not active).

#### 2. Frontend (Next.js Web Application)
```bash
cd apps/web
npm install
npm run dev
```
* Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option 2: Docker Compose (Full Stack with LiveKit)

```bash
cd infra/docker
docker compose up --build
```
* **Web Application**: `http://localhost:3000`
* **Go API Backend**: `http://localhost:8080`
* **LiveKit SFU**: `http://localhost:7880`

---

## 🧪 Testing & Verification

### Run Complete Go Test Suite
```bash
cd services/api
go test -v ./...
```
Runs all unit tests, moderation tests, hub safety tests, and trust engine tests.

### Run High-Concurrency Matchmaking Load Simulation
```bash
cd services/api
go test -v -run=TestMatchmakingLoadSimulation ./internal/matchmaking
```
Simulates concurrent queue submissions (10, 100, 1,000, and 5,000 users) and asserts pairing latencies:
* **Ingestion**: $< 25\mu\text{s}$ per ticket.
* **Pairing Latency**: $p50 \approx 200\text{ms}$, $p95 < 600\text{ms}$ at 1,000 concurrent users.
* **Match Success Rate**: $100\%$.

### Run Frontend Production Build Check
```bash
cd apps/web
npm run build
```
Validates TypeScript type safety and prerenders all 10 static pages.

---

## 📂 Repository Layout

```
airtak/
├── apps/
│   └── web/                   # Next.js 15 Web Application & Voice Client
├── services/
│   └── api/                   # Go API (REST + WebSocket + Matchmaking + LiveKit)
│       ├── cmd/server/        # Server bootstrap main.go
│       └── internal/          # Auth, Handlers, Matchmaking, Realtime, Telemetry, Models
├── packages/
│   └── types/                 # Shared TypeScript data contracts (@luratalk/types)
├── infra/
│   └── docker/                # Docker Compose & LiveKit SFU configurations
├── docs/                      # Technical Architecture, API & Protocol Specs
└── tests/                     # Performance benchmarks and stress testing scripts
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
