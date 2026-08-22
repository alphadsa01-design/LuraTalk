'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  SkipForward,
  UserPlus,
  ShieldAlert,
  Gamepad2,
  MessageSquare,
  Sparkles,
  PhoneOff,
  Loader2,
  Languages,
  Radio,
  Sliders,
  X,
} from 'lucide-react';
import { useUserStore, getDicebearAvatarUrl, AVATAR_PRESETS } from '@/stores/useUserStore';
import { useCallStore } from '@/stores/useCallStore';
import { useGameStore } from '@/stores/useGameStore';
import { socketClient } from '@/lib/socket';
import { getOrCreateAnonymousSession } from '@/lib/api';
import { webrtcEngine } from '@/lib/webrtc';
import { sounds } from '@/lib/sounds';
import { notifications } from '@/lib/notifications';
import AudioVisualizer from '@/components/AudioVisualizer';
import AIWidget from '@/components/AIWidget';
import TranslationBar from '@/components/TranslationBar';
import GameOverlay from '@/components/GameOverlay';
import ChatPanel from '@/components/ChatPanel';
import SafetyModal from '@/components/SafetyModal';
import AudioSettingsModal from '@/components/AudioSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function MatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[70vh] items-center justify-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      }
    >
      <MatchPageContent />
    </Suspense>
  );
}

function MatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as 'voice' | 'text' | 'mystery') || 'voice';

  const {
    token,
    user,
    setAuth,
    mood,
    intention,
    nativeLanguage,
    targetLanguages,
    interests,
    countryPreference,
    oneQuestionAnswer,
    enableAiAssistant,
    enableLiveTranslation,
    targetTranslationLanguage,
    updatePreferences,
  } = useUserStore();

  const {
    status,
    mode,
    peer,
    isMuted,
    isDeafened,
    isSpeaking,
    peerSpeaking,
    callDuration,
    messages,
    isPeerTyping,
    icebreakerSuggestion,
    liveTranslationCaption,
    autoConnectNext,
    setAutoConnectNext,
    toggleAutoConnectNext,
    setMatchFound,
    setStatus,
    setMode,
    toggleMute,
    toggleDeafen,
    setSpeaking,
    setPeerSpeaking,
    incrementDuration,
    addMessage,
    setPeerTyping,
    updateMysteryLevel,
    resetCall,
  } = useCallStore();

  const { openGame, updateGameState } = useGameStore();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

  const [directCallState, setDirectCallState] = useState<'idle' | 'ringing' | 'rejected' | 'failed'>('idle');
  const [directCallMessage, setDirectCallMessage] = useState<string>('');
  const directPartnerName = searchParams?.get('partnerName') || 'Partner';
  const callPartnerId = searchParams?.get('callPartnerId');

  // Sync mute & deafen state with WebRTC audio tracks
  useEffect(() => {
    webrtcEngine.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    webrtcEngine.setDeafened(isDeafened);
  }, [isDeafened]);

  // Automatically resume audio context and playback on user interaction
  useEffect(() => {
    if (status === 'matched') {
      webrtcEngine.resumeAudio();
      const resume = () => webrtcEngine.resumeAudio();
      window.addEventListener('click', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
      return () => {
        window.removeEventListener('click', resume);
        window.removeEventListener('touchstart', resume);
      };
    }
  }, [status]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'matched') {
      interval = setInterval(() => {
        incrementDuration();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, incrementDuration]);

  // Connect WebSocket and Listeners with Auto-Auth Safeguard
  useEffect(() => {
    let isMounted = true;

    async function initAndConnect() {
      let activeToken = token;
      let attempts = 0;
      while (!activeToken && attempts < 3 && isMounted) {
        try {
          const authData = await getOrCreateAnonymousSession();
          if (!isMounted) return;
          setAuth(authData.token, authData.user);
          activeToken = authData.token;
          break;
        } catch (err) {
          attempts++;
          if (attempts >= 3) {
            console.warn('Session init will retry when network reconnects', err);
            return;
          }
          await new Promise((r) => setTimeout(r, 600 * attempts));
        }
      }

      if (!isMounted || !activeToken) return;

      setMode(initialMode);
      socketClient.connect(activeToken);

      // Pre-warm microphone hardware in background so match audio connects in <100ms
      if (initialMode === 'voice' || initialMode === 'mystery') {
        webrtcEngine.warmupMicrophone().catch(() => {});
      }

      const acceptedCall = searchParams?.get('acceptedCall') === '1';

      // Only enter matching queue if not an accepted call and not already in an active call
      if (!acceptedCall && useCallStore.getState().status !== 'matched') {
        if (callPartnerId) {
          setStatus('searching');
          setDirectCallState('ringing');
          socketClient.directCall(callPartnerId);
        } else {
          handleStartQueue(initialMode);
        }
      }
    }

    const triggerAutoNextMatch = () => {
      webrtcEngine.cleanup();
      sounds.playEndCall();
      setFriendRequested(false);
      resetCall();
      setStatus('searching');
      const currentMode = useCallStore.getState().mode || initialMode || 'voice';
      socketClient.nextMatch(currentMode, {
        nativeLanguage,
        targetLanguages,
        interests,
        mood,
        intention,
        countryPreference,
        oneQuestionAnswer,
      });
    };

    const unsubMatch = socketClient.on('match:found', (payload: any) => {
      setDirectCallState('idle');
      sounds.playMatchFound();
      notifications.showMatchFound(payload.partner?.username || 'Stranger');
      setMatchFound(payload);
      if (initialMode === 'voice' || initialMode === 'mystery') {
        webrtcEngine.startCall({
          isInitiator: payload.isInitiator,
          livekitToken: payload.livekitToken,
          livekitUrl: payload.livekitUrl,
          roomName: payload.roomName,
          onSpeakingChange: (spk) => setSpeaking(spk),
          onPeerSpeakingChange: (peerSpk) => setPeerSpeaking(peerSpk),
          onDisconnected: () => {
            if (useCallStore.getState().status === 'matched') {
              triggerAutoNextMatch();
            }
          },
          onError: (err) => console.error('WebRTC Call Error:', err),
        });
      }
    });

    const unsubRinging = socketClient.on('direct:outgoing_ringing', () => {
      setDirectCallState('ringing');
    });

    const unsubDirectRejected = socketClient.on('direct:call_rejected', (data: any) => {
      setDirectCallState('rejected');
      setDirectCallMessage(data.message || 'Call was declined.');
      sounds.playEndCall();
    });

    const unsubDirectFailed = socketClient.on('direct:call_failed', (data: any) => {
      setDirectCallState('failed');
      setDirectCallMessage(data.message || 'User is currently offline.');
      sounds.playEndCall();
    });

    const unsubPeerLeft = socketClient.on('match:peer_left', () => {
      triggerAutoNextMatch();
    });

    const unsubChat = socketClient.on('chat:message', (payload: any) => {
      // Ignore if sender is self (since sender already rendered optimistically)
      const currentUid = useUserStore.getState().user?.id;
      if (payload.senderId === currentUid || payload.senderId === 'me') {
        return;
      }
      addMessage(payload);
    });

    const unsubTyping = socketClient.on('chat:typing', () => {
      setPeerTyping(true);
      setTimeout(() => setPeerTyping(false), 2000);
    });

    const unsubMystery = socketClient.on('mystery:update', (payload: any) => {
      updateMysteryLevel(payload.mysteryLevel);
    });

    const unsubGame = socketClient.on('game:update', (payload: any) => {
      updateGameState(payload);
    });

    const unsubFriend = socketClient.on('friend:update', () => {
      setFriendRequested(true);
    });

    initAndConnect();

    return () => {
      isMounted = false;
      const currentStatus = useCallStore.getState().status;
      if (currentStatus !== 'matched') {
        webrtcEngine.cleanup();
        socketClient.leaveQueue();
      }
      unsubMatch();
      unsubRinging();
      unsubDirectRejected();
      unsubDirectFailed();
      unsubPeerLeft();
      unsubChat();
      unsubTyping();
      unsubMystery();
      unsubGame();
      unsubFriend();
    };
  }, [token, initialMode, searchParams]);

  const handleStartQueue = (m: 'voice' | 'text' | 'mystery') => {
    setStatus('searching');
    socketClient.joinQueue(m, {
      nativeLanguage,
      targetLanguages,
      interests,
      mood,
      intention,
      countryPreference,
      oneQuestionAnswer,
    });
  };

  const handleNextMatch = () => {
    sounds.playSkip();
    webrtcEngine.cleanup();
    setFriendRequested(false);
    resetCall();
    setStatus('searching');
    socketClient.nextMatch(mode, {
      nativeLanguage,
      targetLanguages,
      interests,
      mood,
      intention,
      countryPreference,
      oneQuestionAnswer,
    });
  };

  const handleLeaveCall = () => {
    sounds.playEndCall();
    webrtcEngine.cleanup();
    socketClient.send('call:end', {});
    socketClient.leaveQueue();
    setFriendRequested(false);
    resetCall();
    setStatus('idle');
    router.push('/');
  };

  const handleCancelSearch = () => {
    sounds.playEndCall();
    webrtcEngine.cleanup();
    if (callPartnerId) {
      socketClient.cancelDirectCall(callPartnerId);
    }
    socketClient.leaveQueue();
    resetCall();
    setDirectCallState('idle');
    setStatus('idle');
    router.push('/');
  };

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;
    const trimmed = content.trim();
    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const myId = user?.id || 'me';
    addMessage({
      id: tempId,
      senderId: myId,
      senderName: user?.username || 'You',
      content: trimmed,
      timestamp: Date.now(),
    });
    socketClient.sendChat(
      trimmed,
      nativeLanguage,
      targetTranslationLanguage,
      enableLiveTranslation,
      tempId
    );
  };

  const handleTyping = () => {
    socketClient.sendTyping();
  };

  const handleRequestReveal = () => {
    socketClient.requestReveal();
  };

  const handleSendFriendRequest = () => {
    if (peer) {
      socketClient.sendFriendRequest(peer.id);
      setFriendRequested(true);
    }
  };

  const handleBlockUser = () => {
    if (peer) {
      socketClient.blockUser(peer.id);
      setIsSafetyOpen(false);
      handleNextMatch();
    }
  };

  const handleReportUser = (reason: string, description: string) => {
    if (peer) {
      socketClient.reportUser(peer.id, reason, description);
      setIsSafetyOpen(false);
      handleNextMatch();
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 min-h-[calc(100dvh-4.5rem)] pb-32 sm:pb-16 flex flex-col justify-between">
      {/* Sleek Top Status Header */}
      <div className="flex items-center justify-between glass-panel px-4 py-2.5 rounded-2xl border border-white/10 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancelSearch}
            className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors flex items-center gap-1 p-1 rounded-lg hover:bg-white/5"
            title="Return to Home"
          >
            <span>← Home</span>
          </button>

          <span className="h-3.5 w-px bg-white/10" />

          {status === 'matched' ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-mono font-bold text-white tracking-wider">
                {formatDuration(callDuration)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neutral-500 animate-ping" />
              <span className="text-xs font-medium text-neutral-400">
                {status === 'searching' ? 'Searching...' : 'Standby'}
              </span>
            </div>
          )}
        </div>

        {/* Top Right Utilities */}
        <div className="flex items-center gap-2">
          {/* Auto-Connect Next Switch */}
          <label
            className="flex items-center gap-1.5 cursor-pointer select-none bg-surfaceLight hover:bg-white/10 px-2.5 py-1 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 transition-all"
            title="Automatically pair with the next person when a call ends"
          >
            <input
              type="checkbox"
              checked={autoConnectNext}
              onChange={toggleAutoConnectNext}
              className="w-3.5 h-3.5 rounded accent-secondary cursor-pointer"
            />
            <span className={autoConnectNext ? 'text-secondary font-bold' : 'text-gray-400'}>
              Auto-Next
            </span>
          </label>

          <button
            onClick={() => setIsAudioSettingsOpen(true)}
            className="p-2 rounded-xl bg-surfaceLight hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all"
            title="Audio & Microphone Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Center Stage */}
      <div className="my-auto w-full">
        {directCallState === 'ringing' ? (
          <div className="w-full h-[280px] sm:h-[340px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
            <div className="absolute w-40 h-40 sm:w-56 sm:h-56 rounded-full border border-emerald-500/30 animate-ping opacity-30" />
            <div className="absolute w-60 h-60 sm:w-80 sm:h-80 rounded-full border border-emerald-500/20 animate-pulse-slow opacity-20" />

            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-primary to-secondary p-1 shadow-2xl mb-4 relative">
              <div className="w-full h-full rounded-full bg-background overflow-hidden flex items-center justify-center">
                <img
                  src={getDicebearAvatarUrl(directPartnerName)}
                  alt="Partner Avatar"
                  className="w-full h-full object-cover bg-slate-900"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 border-2 border-background animate-pulse flex items-center justify-center text-xs">
                📞
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white">
              Calling {directPartnerName}...
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Waiting for them to answer.
            </p>

            <button
              onClick={handleCancelSearch}
              className="mt-6 px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Cancel Call</span>
            </button>
          </div>
        ) : directCallState === 'rejected' || directCallState === 'failed' ? (
          <div className="w-full h-[280px] sm:h-[340px] rounded-3xl glass-panel flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-300 flex items-center justify-center">
              <PhoneOff className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {directCallState === 'rejected' ? 'Call Declined' : 'User Unavailable'}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                {directCallMessage ||
                  (directCallState === 'rejected'
                    ? 'The user declined the call.'
                    : 'The user is currently offline.')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDirectCallState('idle');
                  handleStartQueue(initialMode);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Random Voice Match</span>
              </button>

              <button
                onClick={() => router.push('/history')}
                className="px-5 py-2.5 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-bold transition-all"
              >
                Back to History
              </button>
            </div>
          </div>
        ) : status === 'searching' ? (
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
            {/* Concentric Radar Rings - Monochrome */}
            <div className="absolute w-44 h-44 sm:w-64 sm:h-64 rounded-full border border-white/20 animate-ping opacity-40" />
            <div className="absolute w-64 h-64 sm:w-88 sm:h-88 rounded-full border border-white/10 animate-pulse-slow opacity-30" />

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 border border-white/20 p-1 shadow-2xl mb-4 relative z-10 animate-pulse">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-white">
                <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white z-10">Finding someone to talk with...</h3>
            <p className="text-xs text-neutral-400 mt-1.5 max-w-xs z-10">
              Connecting you with someone online right now.
            </p>

            <button
              onClick={handleCancelSearch}
              className="mt-6 px-6 py-2.5 rounded-xl bg-surfaceLight hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-bold border border-white/10 transition-all active:scale-95 flex items-center gap-1.5 z-10"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        ) : status === 'disconnected' ? (
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center">
              <PhoneOff className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Call Ended</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                Your partner has left the conversation.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleCancelSearch}
                className="px-5 py-3 rounded-2xl bg-surfaceLight hover:bg-white/10 text-white text-xs sm:text-sm font-semibold border border-white/10 transition-all"
              >
                ← Back to Home
              </button>

              <button
                onClick={handleNextMatch}
                className="px-6 py-3 rounded-2xl bg-white text-black text-xs sm:text-sm font-bold shadow-xl shadow-white/10 hover:bg-neutral-200 hover:scale-105 transition-transform"
              >
                Find Next Match ➔
              </button>
            </div>
          </div>
        ) : peer ? (
          <div className="space-y-3">
            <AudioVisualizer
              isSpeaking={isSpeaking}
              peerSpeaking={peerSpeaking}
              isMuted={isMuted}
              isDeafened={isDeafened}
              peerName={peer.username}
              peerAvatar={peer.avatarId}
              sharedInterestsCount={peer.sharedInterests?.length || 0}
              onEndCall={handleLeaveCall}
            />

            {/* AI Icebreaker Card (Clean, Unobtrusive, Single-Line Strip) */}
            {icebreakerSuggestion && (
              <div className="glass-panel px-4 py-2.5 rounded-2xl border border-white/15 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-white min-w-0">
                  <Sparkles className="w-4 h-4 text-white shrink-0" />
                  <span className="truncate text-neutral-300">{icebreakerSuggestion}</span>
                </div>
                <button
                  onClick={() => handleSendMessage(icebreakerSuggestion)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white text-white hover:text-black text-[11px] font-semibold transition-all"
                >
                  Send
                </button>
              </div>
            )}

            {/* Live Translation Caption (If Enabled) */}
            {enableLiveTranslation && liveTranslationCaption && (
              <div className="glass-panel px-4 py-2 rounded-2xl border border-white/20 text-center text-xs text-white font-medium animate-pulse">
                {liveTranslationCaption}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-black flex items-center justify-center text-white">
                <Radio className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Ready for a Voice Match?</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                Connect instantly with someone online right now.
              </p>
            </div>
            <button
              onClick={() => handleStartQueue(initialMode)}
              className="px-6 py-3 rounded-2xl bg-white text-black text-sm font-bold shadow-xl shadow-white/10 hover:bg-neutral-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Radio className="w-4 h-4 text-black" />
              <span>Start Voice Match</span>
            </button>
          </div>
        )}
      </div>

      {/* Slide-over Text Channel Modal */}
      {isChatOpen && status === 'matched' && (
        <div className="fixed inset-0 z-50 p-3 sm:p-4 bg-black/80 backdrop-blur-md flex flex-col justify-end sm:justify-center">
          <div className="relative w-full h-[80vh] max-w-md mx-auto">
            <button
              onClick={() => setIsChatOpen(false)}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-surfaceLight text-neutral-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <ChatPanel
              messages={messages}
              currentUserId={user?.id || ''}
              isPeerTyping={isPeerTyping}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
            />
          </div>
        </div>
      )}

      {/* Clean Floating Bottom In-Call Dock - Monochrome */}
      {status === 'matched' && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-1.5rem)] sm:w-auto glass-panel-glow p-2 sm:p-2.5 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-3xl flex items-center justify-between sm:justify-center gap-2 sm:gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
              isMuted
                ? 'bg-neutral-800 text-white border border-white/20'
                : 'bg-surfaceLight hover:bg-white/15 text-white border border-white/10'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-white" />}
          </button>

          {/* Chat Button with Badge */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center relative transition-all active:scale-95 ${
              isChatOpen
                ? 'bg-white text-black shadow-lg shadow-white/20'
                : 'bg-surfaceLight hover:bg-white/15 text-neutral-200 border border-white/10'
            }`}
            title="Open In-Call Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {messages.length > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center shadow">
                {messages.length}
              </span>
            )}
          </button>

          {/* Next Match Button (Primary & Prominent - White Button with Black Text) */}
          <button
            onClick={handleNextMatch}
            className="flex-1 sm:flex-initial h-12 min-w-[130px] px-5 rounded-2xl bg-white text-black text-xs sm:text-sm font-bold shadow-xl shadow-white/20 hover:bg-neutral-200 hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            title="Find Next Match"
          >
            <SkipForward className="w-4 h-4 text-black" />
            <span>Next Match</span>
          </button>

          {/* Add Friend Button */}
          <button
            onClick={handleSendFriendRequest}
            disabled={friendRequested}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
              friendRequested
                ? 'bg-white/20 text-white border border-white/40'
                : 'bg-surfaceLight hover:bg-white/15 text-white border border-white/10'
            }`}
            title={friendRequested ? 'Friend Added' : 'Add Friend'}
          >
            <UserPlus className="w-5 h-5 text-white" />
          </button>

          {/* Safety / Report Button */}
          <button
            onClick={() => setIsSafetyOpen(true)}
            className="w-12 h-12 rounded-2xl bg-surfaceLight hover:bg-white/15 text-neutral-400 hover:text-white border border-white/10 flex items-center justify-center transition-all active:scale-95"
            title="Safety & Moderation"
          >
            <ShieldAlert className="w-5 h-5" />
          </button>

          {/* End Call Button */}
          <button
            onClick={handleLeaveCall}
            className="w-12 h-12 rounded-2xl bg-neutral-900 hover:bg-red-600 border border-white/20 hover:border-red-500 text-white shadow-lg flex items-center justify-center transition-all active:scale-95 ml-auto sm:ml-0"
            title="End Conversation"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Mini-Games Picker Menu */}
      {isGameMenuOpen && (
        <div className="fixed bottom-28 sm:bottom-24 left-4 right-4 sm:left-auto sm:right-8 z-40 glass-panel rounded-2xl p-3 border border-white/10 space-y-2 max-w-xs sm:w-56 mx-auto sm:mx-0 shadow-2xl">
          <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase px-2 mb-1">
            Launch In-Call Game
          </p>
          {[
            { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '❌' },
            { id: 'would_you_rather', name: 'Would You Rather', icon: '🤔' },
            { id: 'trivia', name: 'Speed Trivia', icon: '🧠' },
          ].map((game) => (
            <button
              key={game.id}
              onClick={() => {
                socketClient.sendGameAction('start', game.id);
                openGame(game.id as any);
                setIsGameMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 text-xs font-semibold text-white transition-colors"
            >
              <span>{game.icon}</span>
              <span>{game.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Synchronized Multiplayer Game Modal */}
      <GameOverlay
        currentUserId={user?.id || ''}
        onSendAction={(actionType, gameType, data) =>
          socketClient.sendGameAction(actionType, gameType, data)
        }
      />

      {/* Safety Modal */}
      <SafetyModal
        isOpen={isSafetyOpen}
        peerName={peer?.username || 'Stranger'}
        onClose={() => setIsSafetyOpen(false)}
        onBlock={handleBlockUser}
        onReport={handleReportUser}
      />

      {/* Audio & Mic Settings Modal */}
      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
      />
    </div>
  );
}
