// AuraVoice Client API SDK

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface UserPreferencesPayload {
  username?: string;
  avatarId?: string;
  bio?: string;
  countryCode?: string;
  nativeLanguage?: string;
  targetLanguages?: string[];
  interests?: string[];
  mood?: string;
  intention?: string;
  oneQuestionAnswer?: string;
}

export async function getOrCreateAnonymousSession(deviceFingerprint?: string, retries = 3): Promise<{ token: string; user: any }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auravoice_token') : null;
  if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        return { token, user };
      }
    } catch {
      // Fall through to create session
    }
  }

  // Create new session with retry resilience
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint: deviceFingerprint || 'web-client' }),
      });

      if (!res.ok) {
        throw new Error(`Session creation failed with status ${res.status}`);
      }

      const data = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem('auravoice_token', data.token);
        localStorage.setItem('auravoice_user_id', data.user.id);
      }
      return data;
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  throw new Error('Failed to create session after retries');
}

export async function updateUserPreferences(token: string, payload: UserPreferencesPayload) {
  const res = await fetch(`${API_BASE}/api/v1/users/me/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}

export async function fetchTopicRooms() {
  const res = await fetch(`${API_BASE}/api/v1/rooms`);
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function fetchRoomToken(token: string, roomId: string) {
  const res = await fetch(`${API_BASE}/api/v1/rooms/${roomId}/token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to join room stage');
  return res.json();
}

export async function fetchFriends(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/friends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch friends');
  return res.json();
}

export async function addFriend(token: string, username: string) {
  const res = await fetch(`${API_BASE}/api/v1/friends/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.text();
    throw new Error(data || 'Failed to add friend');
  }
  return res.json();
}

export async function removeFriend(token: string, friendId: string) {
  const res = await fetch(`${API_BASE}/api/v1/friends/${friendId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to remove friend');
  return res.json();
}

export async function fetchMemories(token: string, friendId: string) {
  const res = await fetch(`${API_BASE}/api/v1/memories?friendId=${friendId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch memories');
  return res.json();
}

export async function saveMemory(token: string, friendId: string, topicSummary: string) {
  const res = await fetch(`${API_BASE}/api/v1/memories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ friendId, topicSummary }),
  });
  if (!res.ok) throw new Error('Failed to save memory');
  return res.json();
}

export async function deleteMemory(token: string, memoryId: string) {
  const res = await fetch(`${API_BASE}/api/v1/memories/${memoryId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete memory');
  return res.json();
}

export async function fetchAdminStats(adminKey: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/stats`, {
    headers: { 'X-Admin-Key': adminKey },
  });
  if (!res.ok) throw new Error('Unauthorized admin access');
  return res.json();
}

export async function fetchAdminReports(adminKey: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/reports`, {
    headers: { 'X-Admin-Key': adminKey },
  });
  if (!res.ok) throw new Error('Unauthorized admin access');
  return res.json();
}

export async function actionAdminReport(adminKey: string, reportId: string, action: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/reports/${reportId}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error('Failed to action report');
  return res.json();
}

export async function adminCreateRoom(adminKey: string, roomData: { title: string; topic: string; description: string; maxParticipants: number; tags: string[] }) {
  const res = await fetch(`${API_BASE}/api/v1/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify(roomData),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function adminDeleteRoom(adminKey: string, roomId: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/rooms/${roomId}`, {
    method: 'DELETE',
    headers: {
      'X-Admin-Key': adminKey,
    },
  });
  if (!res.ok) throw new Error('Failed to delete room');
  return res.json();
}

export async function adminRevokeUser(adminKey: string, userId: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/revoke`, {
    method: 'POST',
    headers: {
      'X-Admin-Key': adminKey,
    },
  });
  if (!res.ok) throw new Error('Failed to revoke user session');
  return res.json();
}

export async function fetchCallHistory(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch call history');
  return res.json();
}

export async function deleteCallHistory(token: string, historyId: string) {
  const res = await fetch(`${API_BASE}/api/v1/history/${historyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete history record');
  return res.json();
}
