// AuraVoice Unified Protocol & Data Model Contracts

export type ConversationIntention =
  | 'casual'
  | 'friends'
  | 'deep'
  | 'language'
  | 'gaming'
  | 'music'
  | 'movies'
  | 'travel'
  | 'advice'
  | 'debate'
  | 'learning'
  | 'dating'
  | 'fun';

export type UserMood =
  | 'chill'
  | 'funny'
  | 'energetic'
  | 'curious'
  | 'deep'
  | 'talkative'
  | 'quiet'
  | 'need_to_talk';

export type MatchMode = 'voice' | 'text' | 'mystery';

export interface UserPreferences {
  nativeLanguage: string;
  targetLanguages: string[];
  interests: string[];
  mood: UserMood;
  intention: ConversationIntention;
  countryPreference: 'worldwide' | 'same_country' | 'specific_country';
  preferredCountry?: string;
  oneQuestionAnswer?: string;
  enableAiAssistant: boolean;
  enableLiveTranslation: boolean;
  targetTranslationLanguage?: string;
}

export interface UserProfile {
  id: string;
  isAnonymous: boolean;
  username: string;
  avatarId: string;
  bio?: string;
  countryCode?: string;
  nativeLanguage: string;
  targetLanguages: string[];
  interests: string[];
  mood: UserMood;
  intention: ConversationIntention;
  trustScore: number;
  createdAt: string;
}

export interface MatchTicket {
  ticketId: string;
  userId: string;
  mode: MatchMode;
  preferences: UserPreferences;
  queuedAt: number;
}

export interface MatchFoundPayload {
  matchId: string;
  roomName: string;
  peer: {
    id: string;
    username: string;
    avatarId: string;
    countryCode?: string;
    mood: UserMood;
    intention: ConversationIntention;
    sharedInterests: string[];
    mysteryLevel: number; // 1: anonymous, 2: interests unlocked, 3: full bio
  };
  livekitToken: string;
  livekitUrl: string;
  iceServers?: RTCIceServer[];
  isInitiator: boolean;
  icebreakerSuggestion?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isTranslated?: boolean;
  translatedContent?: string;
  timestamp: number;
}

export type GameType = 'tictactoe' | 'would_you_rather' | 'trivia' | 'two_truths' | 'twenty_questions';

export interface GameState {
  gameId: string;
  gameType: GameType;
  turn: string; // userId
  status: 'inviting' | 'in_progress' | 'completed' | 'abandoned';
  data: Record<string, unknown>;
  scores: Record<string, number>;
}

export interface RoomLounge {
  id: string;
  title: string;
  topic: string;
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  speakersCount: number;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

export interface FriendRelationship {
  id: string;
  friend: UserProfile;
  status: 'pending' | 'accepted' | 'rejected';
  online: boolean;
  lastConversationAt?: string;
  memories: ConversationMemoryItem[];
}

export interface ConversationMemoryItem {
  id: string;
  topicSummary: string;
  createdAt: string;
}

export interface ModerationReport {
  reportedUserId: string;
  conversationId?: string;
  reason: 'harassment' | 'hate_speech' | 'spam' | 'inappropriate_audio' | 'scam' | 'other';
  description?: string;
}

// WebSocket Event Enums
export enum WSEventType {
  // Client -> Server
  JOIN_QUEUE = 'queue:join',
  LEAVE_QUEUE = 'queue:leave',
  NEXT_MATCH = 'match:next',
  SEND_CHAT = 'chat:send',
  TYPING = 'chat:typing',
  REVEAL_PROFILE = 'mystery:reveal_request',
  ACCEPT_REVEAL = 'mystery:reveal_accept',
  GAME_ACTION = 'game:action',
  SEND_FRIEND_REQUEST = 'friend:request',
  ACCEPT_FRIEND_REQUEST = 'friend:accept',
  REPORT_USER = 'safety:report',
  BLOCK_USER = 'safety:block',
  HEARTBEAT = 'system:heartbeat',

  // Server -> Client
  QUEUE_STATUS = 'queue:status',
  MATCH_FOUND = 'match:found',
  PEER_LEFT = 'match:peer_left',
  CHAT_MESSAGE = 'chat:message',
  CHAT_TYPING = 'chat:typing',
  AI_SUGGESTION = 'ai:suggestion',
  LIVE_TRANSLATION = 'translation:caption',
  MYSTERY_UPDATE = 'mystery:update',
  GAME_STATE_UPDATE = 'game:update',
  FRIEND_STATUS_UPDATE = 'friend:update',
  SAFETY_ALERT = 'safety:alert',
  ERROR = 'system:error',
}
