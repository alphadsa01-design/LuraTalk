function getApiBase(): string {
  let url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        url = 'http://localhost:8080';
      } else {
        url = window.location.origin;
        console.warn(
          '[LuraTalk Config Warning] NEXT_PUBLIC_API_URL is not set in Vercel Environment Variables. Falling back to',
          url
        );
      }
    } else {
      url = 'http://localhost:8080';
    }
  }
  return url.replace(/\/+$/, '');
}

const API_BASE = getApiBase();

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
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('luratalk_token') || localStorage.getItem('auravoice_token');
    // Try to load cached user from Zustand storage for 0ms instant startup
    const rawStorage = localStorage.getItem('luratalk_user_storage');
    let cachedUser: any = null;
    if (rawStorage) {
      try {
        const parsed = JSON.parse(rawStorage);
        if (parsed?.state?.user) {
          cachedUser = parsed.state.user;
        }
      } catch {}
    }

    if (token && cachedUser) {
      // Revalidate in background without blocking matchmaking startup
      fetch(`${API_BASE}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
        if (!res.ok && res.status === 401) {
          localStorage.removeItem('luratalk_token');
          localStorage.removeItem('auravoice_token');
        }
      }).catch(() => {});
      return { token, user: cachedUser };
    }

    if (token) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`${API_BASE}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const user = await res.json();
          return { token, user };
        }
      } catch {
        // Fall through to create session
      }
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
        localStorage.setItem('luratalk_token', data.token);
        localStorage.setItem('luratalk_user_id', data.user.id);
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

export async function createTopicRoom(token: string, payload: { title: string; topic: string; description: string; tags?: string[]; maxParticipants?: number }) {
  const res = await fetch(`${API_BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create topic room');
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

export async function addFriend(token: string, target: string) {
  const cleanTarget = target ? target.trim() : '';
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanTarget);
  const payload = isUUID ? { friendId: cleanTarget } : { username: cleanTarget };

  const res = await fetch(`${API_BASE}/api/v1/friends/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.text();
    throw new Error(data || 'Failed to add friend');
  }
  return res.json();
}

export async function acceptFriendRequest(token: string, friendId: string) {
  const res = await fetch(`${API_BASE}/api/v1/friends/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ friendId }),
  });
  if (!res.ok) {
    const data = await res.text();
    throw new Error(data || 'Failed to accept friend request');
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

export async function fetchLiveOnlineStats(): Promise<{ onlineCount: number; activeRooms: number; queueDepth: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/stats/online`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  } catch (err) {
    return { onlineCount: 1, activeRooms: 0, queueDepth: 0 };
  }
}
