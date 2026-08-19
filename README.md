# LuraTalk — Production-Grade Random Voice Social Platform

> "Meet someone worth talking to."

LuraTalk is a high-performance, privacy-first random voice and text social platform. It combines multi-dimensional matchmaking, WebRTC voice routing, real-time bilingual translation, non-intrusive AI icebreakers, synchronized in-call mini-games, persistent friendships, and an internal Trust & Safety engine.

---

## 🚀 Key Features

* **Intelligent Multi-Dimensional Matchmaking**: Pairs users based on conversation intention (Casual, Deep, Language practice, Gaming, etc.), harmonic mood (Chill, Energetic, Curious...), native & target languages, Jaccard interest overlap, and trust scores. Sub-100ms queue insertion, sub-500ms match pairing.
* **Real-Time Voice (LiveKit WebRTC SFU)**: High-definition Opus audio routing directly between client browsers and LiveKit SFU with zero raw audio traversing the application server.
* **Mystery Match Progression**:
  1. *Stranger*: Anonymous pseudonym & mood only.
  2. *Common Ground*: Mutual shared interest tags unlocked.
  3. *Full Profile & Friend*: Bio reveal and persistent friendship creation.
* **In-Call Synchronized Mini-Games**: Play multiplayer Tic-Tac-Toe, Would You Rather dilemma decks, and Speed Trivia during live calls.
* **Quiet AI Conversation Assistant**: Contextual talking points and icebreakers generated on-demand when silence is detected. Can be disabled with 1 click.
* **Real-Time Neural Translation**: Live bilingual speech and text subtitle captions across Spanish, Japanese, French, German, Hindi, Mandarin, and English.
* **Topic Lounges**: Small-group community voice stages (Late Night Gaming, 3 AM Philosophy, Language Exchange, Tech Founders).
* **Persistent Friendships & Conversation Memory**: Reconnect directly with friends and store non-sensitive editable/deletable topic memory notes.
* **Trust & Safety / Admin Console**: Private trust scoring (0–100), automated rate limiting, suspicious link filters, and real-time admin telemetry dashboard with 1-click ban & moderation queue.

---

## 🏗 Architecture & Tech Stack

```
                          ┌────────────────────────┐
                          │   Client Browser/PWA   │
                          └───────────┬────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 │ HTTPS/REST + WSS   │                    │ WebRTC Audio Media
                 ▼                    ▼                    ▼
        ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
        │  Go API Backend │  │   Go Realtime   │  │   LiveKit SFU   │
        │  (REST Service) │  │  (WebSockets)   │  │  (Media Server) │
        └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
                 │                    │                    │
                 ├────────────────────┤                    │
                 ▼                    ▼                    │
        ┌─────────────────┐  ┌─────────────────┐           │
        │   PostgreSQL    │  │   Redis 7+      │           │
        │ (Relational DB) │  │ (Queues/Presence│           │
        └─────────────────┘  └─────────────────┘           │
                 │                    │                    │
                 └────────────────────┴────────────────────┘
```

* **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand, LiveKit Client SDK.
* **Backend**: Go (Golang), Chi Router, Gorilla WebSocket, GORM, Redis v9, LiveKit Server Protocol.
* **Data Storage**: PostgreSQL 16 (Relational persistence), Redis 7 (Queues, presence, rate limits, ephemeral match tickets).
* **Infrastructure**: Docker Compose, multi-stage production Dockerfiles, LiveKit SFU server configuration.

---

## 💻 Local Development Setup

### Prerequisites
* Go 1.22+
* Node.js 18+ and npm
* Docker & Docker Compose (Optional for containerized run)

### 1. Run via Docker Compose (One-Click Stack)
```bash
cd infra/docker
docker compose up --build
```
* Web Client: `http://localhost:3000`
* Go API Server: `http://localhost:8080`
* LiveKit SFU: `http://localhost:7880`

---

### 2. Run Locally (Native Development)

#### Backend (Go API & WebSockets)
```bash
cd services/api
go run cmd/server/main.go
```
*API will start on `http://localhost:8080` and use SQLite fallback automatically if PostgreSQL is not active.*

#### Frontend (Next.js App)
```bash
cd apps/web
npm install
npm run dev
```
*Access web client at `http://localhost:3000`.*

---

## 🧪 Testing & Verification

### Run Go Unit & Safety Tests
```bash
cd services/api
go test -v ./...
```

### Run High-Throughput Matchmaking Benchmarks
```bash
cd services/api
go test -v -bench=. ./internal/matchmaking
```

### Run 3,000-User Concurrent Load Simulation
```bash
cd services/api
go test -v -run=TestMatchmakingLoadSimulation ./internal/matchmaking
```

### Run Frontend Lint & Build Test
```bash
cd apps/web
npm run build
```

---

## 📂 Repository Layout

```
airtak/
├── apps/
│   └── web/                   # Next.js 15 Web Application
├── services/
│   └── api/                   # Go Modular Monolith (REST + WSS + Matchmaking)
│       ├── cmd/server/        # Server bootstrap main.go
│       └── internal/          # Auth, Matchmaking, Realtime, AI, Games, Trust, DB
├── packages/
│   └── types/                 # Shared TypeScript data contracts
├── infra/
│   └── docker/                # Docker Compose & container configurations
├── docs/                      # Full Architecture, API, WebSocket, and Security specs
└── tests/                     # Automated load and stress testing scripts
```
