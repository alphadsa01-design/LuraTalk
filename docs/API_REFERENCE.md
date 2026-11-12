# AuraVoice REST API Reference

Base URL: `http://localhost:8080/api/v1`

---

## 1. Authentication

### Create Anonymous Session
- **Endpoint**: `POST /auth/anonymous`
- **Request Body**:
  ```json
  {
    "deviceFingerprint": "browser-fp-12345"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "sessionToken": "a4f89b...",
    "user": {
      "id": "c1f7a4...",
      "isAnonymous": true,
      "username": "CosmicVoyager042",
      "avatarId": "aura_1",
      "trustScore": 100
    },
    "expiresAt": "2026-08-25T13:30:00Z"
  }
  ```

### Upgrade Account to Email
- **Endpoint**: `POST /auth/upgrade`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "username": "Mayank"
  }
  ```

---

## 2. User Preferences

### Get Current User Profile
- **Endpoint**: `GET /users/me`
- **Headers**: `Authorization: Bearer <token>`

### Update Preferences
- **Endpoint**: `PUT /users/me/preferences`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "nativeLanguage": "en",
    "targetLanguages": ["es", "ja"],
    "interests": ["gaming", "technology", "music"],
    "mood": "chill",
    "intention": "casual",
    "oneQuestionAnswer": "Travel to Kyoto"
  }
  ```

---

## 3. Lounges / Topic Rooms

### List Active Topic Rooms
- **Endpoint**: `GET /rooms`

### Join Stage / Mint Room Token
- **Endpoint**: `GET /rooms/{id}/token`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "roomName": "lounge_gaming",
    "livekitToken": "eyJhbGci...",
    "livekitUrl": "http://localhost:7880"
  }
  ```

### Topic of the Day
- **Endpoint**: `GET /topics/today` (public, cacheable for 5 minutes)
- **Response**:
  ```json
  {
    "topic": { "id": "best-trip", "emoji": "✈️", "title": "Best trip ever", "prompt": "Where's the best place you've ever been?" },
    "changesAt": "2026-11-12T00:00:00Z"
  }
  ```
- To opt in, send `preferences.topic` (the topic `id`) with `queue:join` / `match:next`. The server ignores any value that is not today's topic. Two opted-in users get a strong matching bonus (never a hard filter), and their `match:found` payload includes the shared `topic`.

---

## 4. Friends & Memories

### List Friends
- **Endpoint**: `GET /friends`
- **Headers**: `Authorization: Bearer <token>`

### Get Conversation Memories
- **Endpoint**: `GET /memories?friendId={friendId}`
- **Headers**: `Authorization: Bearer <token>`

### Save Memory Note
- **Endpoint**: `POST /memories`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "friendId": "uuid-here",
    "topicSummary": "Discussed indie game development and pixel art"
  }
  ```

---

## 5. Admin & Moderation

### Get System Telemetry
- **Endpoint**: `GET /admin/stats`
- **Headers**: `X-Admin-Key: <ADMIN_SECRET>`

### Get Moderation Reports
- **Endpoint**: `GET /admin/reports`
- **Headers**: `X-Admin-Key: <ADMIN_SECRET>`

### Action Report
- **Endpoint**: `POST /admin/reports/{id}/action`
- **Headers**: `X-Admin-Key: <ADMIN_SECRET>`
- **Request Body**:
  ```json
  {
    "action": "banned" // "banned", "dismissed", "warned"
  }
  ```
