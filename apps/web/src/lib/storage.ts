/**
 * LuraTalk Local Browser Storage Engine
 * Provides zero-latency, privacy-first offline & client-side persistence
 * for call history, friends, conversation memories, and blocks.
 */

export interface LocalHistoryItem {
  id: string;
  conversationId: string;
  roomName: string;
  durationSeconds: number;
  createdAt: string;
  partner: {
    id: string;
    username: string;
    avatarId: string;
    countryCode?: string;
    mood?: string;
    intention?: string;
    interests?: string[];
    bio?: string;
  };
  isPartnerOnline?: boolean;
  isFriend?: boolean;
}

export interface LocalFriendItem {
  id: string;
  friend: {
    id: string;
    username: string;
    avatarId: string;
    countryCode?: string;
    mood: string;
    intention: string;
    interests: string[];
    bio?: string;
  };
  status: 'accepted' | 'pending';
  isOnline: boolean;
  isIncoming?: boolean;
  addedAt?: string;
}

export interface LocalMemoryItem {
  id: string;
  friendId: string;
  topicSummary: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  CALL_HISTORY: 'luratalk_call_history_v1',
  FRIENDS: 'luratalk_friends_v1',
  MEMORIES: 'luratalk_memories_v1',
  BLOCKED: 'luratalk_blocked_users_v1',
};

// Safe JSON parser for localStorage
function getStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStoredJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to save to localStorage (${key})`, err);
  }
}

/* ==========================================================================
   CALL HISTORY STORAGE
   ========================================================================== */

export function getLocalCallHistory(): LocalHistoryItem[] {
  return getStoredJson<LocalHistoryItem[]>(STORAGE_KEYS.CALL_HISTORY, []);
}

export function saveLocalCallHistoryItem(item: LocalHistoryItem): LocalHistoryItem[] {
  const current = getLocalCallHistory();
  // Avoid duplicate conversation entries
  const filtered = current.filter(
    (h) => h.id !== item.id && h.conversationId !== item.conversationId
  );
  const updated = [item, ...filtered].slice(0, 100); // Keep last 100 calls
  setStoredJson(STORAGE_KEYS.CALL_HISTORY, updated);
  return updated;
}

export function deleteLocalCallHistoryItem(id: string): LocalHistoryItem[] {
  const current = getLocalCallHistory();
  const updated = current.filter((h) => h.id !== id && h.conversationId !== id);
  setStoredJson(STORAGE_KEYS.CALL_HISTORY, updated);
  return updated;
}

export function clearLocalCallHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.CALL_HISTORY);
}

/* ==========================================================================
   FRIENDS & FRIEND REQUESTS STORAGE
   ========================================================================== */

export function getLocalFriends(): LocalFriendItem[] {
  return getStoredJson<LocalFriendItem[]>(STORAGE_KEYS.FRIENDS, []);
}

export function saveLocalFriend(friendItem: LocalFriendItem): LocalFriendItem[] {
  const current = getLocalFriends();
  const existingIdx = current.findIndex(
    (f) => f.friend.id === friendItem.friend.id || f.id === friendItem.id
  );

  let updated: LocalFriendItem[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...friendItem };
  } else {
    updated = [friendItem, ...current];
  }

  setStoredJson(STORAGE_KEYS.FRIENDS, updated);
  return updated;
}

export function acceptLocalFriendRequest(friendId: string): LocalFriendItem[] {
  const current = getLocalFriends();
  const updated = current.map((f) => {
    if (f.friend.id === friendId || f.id === friendId) {
      return { ...f, status: 'accepted' as const, isIncoming: false };
    }
    return f;
  });
  setStoredJson(STORAGE_KEYS.FRIENDS, updated);
  return updated;
}

export function removeLocalFriend(friendId: string): LocalFriendItem[] {
  const current = getLocalFriends();
  const updated = current.filter((f) => f.friend.id !== friendId && f.id !== friendId);
  setStoredJson(STORAGE_KEYS.FRIENDS, updated);
  return updated;
}

/* ==========================================================================
   CONVERSATION MEMORIES ("WHAT WE TALKED ABOUT")
   ========================================================================== */

export function getLocalMemories(friendId?: string): LocalMemoryItem[] {
  const all = getStoredJson<LocalMemoryItem[]>(STORAGE_KEYS.MEMORIES, []);
  if (!friendId) return all;
  return all.filter((m) => m.friendId === friendId);
}

export function saveLocalMemory(friendId: string, topicSummary: string): LocalMemoryItem {
  const all = getLocalMemories();
  const newItem: LocalMemoryItem = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    friendId,
    topicSummary: topicSummary.trim(),
    createdAt: new Date().toISOString(),
  };
  const updated = [newItem, ...all];
  setStoredJson(STORAGE_KEYS.MEMORIES, updated);
  return newItem;
}

export function deleteLocalMemory(memoryId: string): LocalMemoryItem[] {
  const all = getLocalMemories();
  const updated = all.filter((m) => m.id !== memoryId);
  setStoredJson(STORAGE_KEYS.MEMORIES, updated);
  return updated;
}

/* ==========================================================================
   BLOCKED USERS STORAGE
   ========================================================================== */

export function getLocalBlockedUserIds(): string[] {
  return getStoredJson<string[]>(STORAGE_KEYS.BLOCKED, []);
}

export function addLocalBlockedUserId(userId: string): void {
  const current = getLocalBlockedUserIds();
  if (!current.includes(userId)) {
    setStoredJson(STORAGE_KEYS.BLOCKED, [...current, userId]);
  }
}
