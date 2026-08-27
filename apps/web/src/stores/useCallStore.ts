import { create } from 'zustand';
import { useGameStore } from './useGameStore';

export type CallStatus = 'idle' | 'searching' | 'matched' | 'in_call' | 'disconnected';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  isTranslated?: boolean;
  translatedContent?: string;
  timestamp: number;
}

export interface PeerProfile {
  id: string;
  username: string;
  avatarId: string;
  countryCode?: string;
  mood: string;
  intention: string;
  sharedInterests: string[];
  mysteryLevel: number; // 1: anonymous, 2: interests unlocked, 3: full bio
  bio?: string;
}

export interface CallState {
  status: CallStatus;
  mode: 'voice' | 'text' | 'mystery';
  matchId: string | null;
  roomName: string | null;
  peer: PeerProfile | null;
  isInitiator: boolean;
  livekitToken: string | null;
  livekitUrl: string | null;

  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  peerSpeaking: boolean;
  callDuration: number; // in seconds

  messages: ChatMessage[];
  isPeerTyping: boolean;
  icebreakerSuggestion: string | null;
  liveTranslationCaption: string | null;

  isLocalScreenSharing: boolean;
  isRemoteScreenSharing: boolean;
  localScreenStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;

  autoConnectNext: boolean;

  setAutoConnectNext: (val: boolean) => void;
  toggleAutoConnectNext: () => void;
  setMatchFound: (data: any) => void;
  setStatus: (status: CallStatus) => void;
  setMode: (mode: 'voice' | 'text' | 'mystery') => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setSpeaking: (speaking: boolean) => void;
  setPeerSpeaking: (speaking: boolean) => void;
  incrementDuration: () => void;
  addMessage: (msg: ChatMessage) => void;
  setPeerTyping: (typing: boolean) => void;
  updateMysteryLevel: (level: number) => void;
  setIcebreaker: (suggestion: string) => void;
  setLocalScreenSharing: (sharing: boolean, stream?: MediaStream | null) => void;
  setRemoteScreenSharing: (sharing: boolean, stream?: MediaStream | null) => void;
  resetCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  status: 'idle',
  mode: 'voice',
  matchId: null,
  roomName: null,
  peer: null,
  isInitiator: false,
  livekitToken: null,
  livekitUrl: null,

  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  peerSpeaking: false,
  callDuration: 0,

  messages: [],
  isPeerTyping: false,
  icebreakerSuggestion: null,
  liveTranslationCaption: null,

  isLocalScreenSharing: false,
  isRemoteScreenSharing: false,
  localScreenStream: null,
  remoteScreenStream: null,

  autoConnectNext: true,

  setAutoConnectNext: (val) => set({ autoConnectNext: val }),
  toggleAutoConnectNext: () => set((state) => ({ autoConnectNext: !state.autoConnectNext })),

  setMatchFound: (data) =>
    set({
      status: 'matched',
      matchId: data.matchId,
      roomName: data.roomName,
      peer: data.peer,
      livekitToken: data.livekitToken,
      livekitUrl: data.livekitUrl,
      isInitiator: data.isInitiator,
      icebreakerSuggestion: data.icebreakerSuggestion || null,
      callDuration: 0,
      messages: [],
      isLocalScreenSharing: false,
      isRemoteScreenSharing: false,
      localScreenStream: null,
      remoteScreenStream: null,
    }),

  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setPeerSpeaking: (speaking) => set({ peerSpeaking: speaking }),
  incrementDuration: () => set((state) => ({ callDuration: state.callDuration + 1 })),
  addMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) {
        return state;
      }
      return { messages: [...state.messages, msg] };
    }),
  setPeerTyping: (typing) => set({ isPeerTyping: typing }),
  updateMysteryLevel: (level) =>
    set((state) => ({
      peer: state.peer ? { ...state.peer, mysteryLevel: level } : null,
    })),
  setIcebreaker: (suggestion) => set({ icebreakerSuggestion: suggestion }),
  setLocalScreenSharing: (sharing, stream = null) =>
    set((state) => ({
      isLocalScreenSharing: sharing,
      localScreenStream: stream !== undefined && stream !== null ? stream : (sharing ? state.localScreenStream : null),
    })),
  setRemoteScreenSharing: (sharing, stream = null) =>
    set((state) => ({
      isRemoteScreenSharing: sharing,
      remoteScreenStream: stream !== undefined && stream !== null ? stream : (sharing ? state.remoteScreenStream : null),
    })),
  resetCall: () => {
    // Automatically close and reset any open multiplayer games
    try {
      useGameStore.getState().resetGame();
    } catch {}
    set({
      status: 'idle',
      matchId: null,
      roomName: null,
      peer: null,
      livekitToken: null,
      livekitUrl: null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      peerSpeaking: false,
      callDuration: 0,
      messages: [],
      isPeerTyping: false,
      icebreakerSuggestion: null,
      liveTranslationCaption: null,
      isLocalScreenSharing: false,
      isRemoteScreenSharing: false,
      localScreenStream: null,
      remoteScreenStream: null,
    });
  },
}));
