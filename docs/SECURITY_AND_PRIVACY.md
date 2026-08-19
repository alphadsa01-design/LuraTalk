# AuraVoice Security & Privacy Architecture

Safety and privacy are foundational pillars of AuraVoice.

---

## 1. Zero-Knowledge Identity Guarantees
- **No Mandatory Personal Identifiers**: Users can start voice and text conversations anonymously without email or phone number.
- **Short-Lived Ephemeral Sessions**: Anonymous tokens are cryptographically signed with HMAC-SHA256 and expire automatically.
- **Anonymous ID Masking**: Internal UUIDs and database identifiers are shielded. Opponents interact solely through ephemeral room names and generated pseudonyms.
- **Zero Audio Storage**: No audio recordings or voice transcripts are stored on disk. Media is routed strictly via LiveKit WebRTC SFU in real time.

---

## 2. Abuse Prevention & Spam Defense
- **Token Bucket Rate Limiting**: Max 20 messages per minute per active session.
- **Phishing & Suspicious Link Stripping**: Automated regex and domain masking cleans potential malicious URLs before broadcast.
- **Private Trust Scoring**: Trust scores (0–100) are updated privately based on conversation length, report logs, and skip frequency. Abusive accounts (<20 score) are suspended automatically.
- **Instant Disconnect & One-Tap Block**: Blocking permanently isolates both users from ever pairing again across queues and lounges.

---

## 3. Administrator Role-Based Access Control (RBAC)
- Admin operations (`/api/v1/admin/*`) require dedicated master secret authentication (`X-Admin-Key`).
- Full audit logs and report review queue allow moderation teams to investigate and action bad actors without violating user privacy.
