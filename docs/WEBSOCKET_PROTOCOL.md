# AuraVoice WebSocket Real-Time Protocol Specification

WebSocket Endpoint: `ws://localhost:8080/ws?token=<JWT>`

All messages follow the envelope format:
```json
{
  "type": "event:name",
  "payload": { ... }
}
```

---

## 1. Client → Server Events

| Event Type | Payload Fields | Description |
|---|---|---|
| `queue:join` | `mode`, `preferences` | Enters matchmaking queue |
| `queue:leave` | `{}` | Leaves matchmaking queue |
| `match:next` | `mode`, `preferences` | Skips current match & immediately re-queues |
| `chat:send` | `content`, `sourceLang`, `targetLang`, `enableTranslation` | Sends in-call chat message |
| `chat:typing` | `{}` | Broadcasts typing indicator to peer |
| `mystery:reveal_request` | `{}` | Requests next progressive mystery reveal stage |
| `game:action` | `actionType`, `gameType`, `data` | Sends move, vote, or answer in mini-game |
| `friend:request` | `friendId` | Sends mutual friend request |
| `safety:block` | `blockedUserId` | Blocks user and immediately disconnects |
| `safety:report` | `reportedUserId`, `reason`, `description` | Submits moderation report |

---

## 2. Server → Client Events

| Event Type | Payload Fields | Description |
|---|---|---|
| `system:connected` | `userId`, `username`, `timestamp` | Connection handshake confirmed |
| `queue:status` | `status`, `mode`, `message` | Queue status update |
| `match:found` | `matchId`, `roomName`, `livekitToken`, `livekitUrl`, `peer`, `icebreakerSuggestion` | Match paired successfully |
| `match:peer_left` | `userId`, `reason` | Peer left or skipped |
| `chat:message` | `id`, `conversationId`, `senderId`, `senderName`, `content`, `isTranslated`, `translatedContent`, `timestamp` | Broadcasts text chat message |
| `mystery:update` | `userId`, `mysteryLevel` | Mystery level updated |
| `game:update` | `gameId`, `gameType`, `turn`, `status`, `board`, `scores`, `customData` | Synchronized game state |
| `friend:update` | `status`, `friendId`, `message` | Friend request accepted |
| `safety:alert` | `message` | Safety notification or rate limit warning |
