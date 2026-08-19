# AuraVoice Architecture & Engineering Design

AuraVoice is an ultra-low-latency, privacy-first random voice and text social platform built from the ground up to connect strangers through intelligent matchmaking, non-intrusive AI icebreakers, real-time translation, and interactive mini-games.

---

## 1. High-Level Architecture

```
                               ┌────────────────────────┐
                               │   Browser / Web App    │
                               └───────────┬────────────┘
                                           │
                      ┌────────────────────┼────────────────────┐
                      │ REST / WebSocket   │                    │ WebRTC Opus Audio
                      ▼                    ▼                    ▼
             ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
             │  Go REST API    │  │ Go WebSocket Hub│  │   LiveKit SFU   │
             │ (Auth, Prefs)   │  │(Events, Games)  │  │ (Media Server)  │
             └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
                      │                    │                    │
                      ├────────────────────┤                    │
                      ▼                    ▼                    │
             ┌─────────────────┐  ┌─────────────────┐           │
             │   PostgreSQL    │  │   Redis 7+      │           │
             │(Persistent Data)│  │(Queues/Presence)│           │
             └─────────────────┘  └─────────────────┘           │
                      │                    │                    │
                      └────────────────────┴────────────────────┘
```

### Media vs Signaling Separation
- **Signaling Layer (Go + WebSockets)**: Handles authentication, matchmaking queue tickets, in-call chat, typing indicators, progressive mystery reveal level transitions, mini-game states, moderation reports, and presence.
- **Media Layer (LiveKit SFU)**: Real-time Opus WebRTC audio routing. No raw audio traffic touches the application server, guaranteeing scalability and minimal jitter.

---

## 2. Matchmaking Algorithm Math

The matchmaking engine pairs users based on a multi-dimensional score function:

$$Score(A, B) = W_{lang} \cdot C_{language} + W_{int} \cdot C_{interest} + W_{intent} \cdot C_{intention} + W_{mood} \cdot C_{mood} + W_{trust} \cdot C_{trust} - Penalty_{recent} - Penalty_{block}$$

### Weights & Parameters
1. **Language Compatibility ($C_{language} \in [0, 30]$)**:
   - Same native language: $+30$ pts.
   - Target practice overlap (User A wants to practice User B's native language): $+25$ pts.
   - Shared target language: $+20$ pts.
2. **Interest Similarity ($C_{interest} \in [0, 30]$)**:
   - Jaccard similarity index: $\frac{|A \cap B|}{|A \cup B|} \times 30$ pts.
3. **Intention Match ($C_{intent} \in [0, 20]$)**:
   - Identical intention (e.g. "Deep conversation", "Gaming", "Language"): $+20$ pts.
   - Casual fallback: $+10$ pts.
4. **Mood Harmony ($C_{mood} \in [0, 15]$)**:
   - Same mood: $+15$ pts.
   - Harmonic pairs (Chill ↔ Deep, Curious ↔ Talkative): $+12$ pts.
5. **Trust Score Factor ($C_{trust} \in [0, 10]$)**:
   - High-trust pool normalization: $\frac{Trust_A + Trust_B}{200} \times 10$ pts.
6. **Hard Penalties**:
   - Blocked relationship: $-\infty$ (Prohibits matching permanently).
   - Matched within last 30 minutes: $-50$ pts.

---

## 3. Mystery Match Progression

1. **Stage 1 (Stranger)**: Only anonymous generated pseudonym (e.g. *CosmicVoyager042*) and current mood are exposed.
2. **Stage 2 (Common Ground)**: Once conversation begins, either user can trigger "Reveal Interests" unlocking mutual hobby tags.
3. **Stage 3 (Full Profile & Friend)**: Mutual friend request unlocks profile bio, online presence, and permanent reconnect ability.

---

## 4. Trust & Safety Scoring Engine

- Internal score (0–100) per user:
  - Rapid skip penalty (< 10s): $-5$ pts.
  - Report received: $-20$ pts.
  - Successful conversation (> 5 min): $+5$ pts.
  - Mutual friend add: $+5$ pts.
- Score $< 40$: Low priority queue isolation.
- Score $< 20$: Automatic account suspension and session invalidation.
