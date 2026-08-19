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

    const unsubMatch = socketClient.on('match:found', (payload: any) => {
      setDirectCallState('idle');
      sounds.playMatchFound();
      notifications.showMatchFound(payload.partner?.username || 'Stranger');
      setMatchFound(payload);
      if (initialMode === 'voice' || initialMode === 'mystery') {
        webrtcEngine.startCall({
          isInitiator: payload.isInitiator,
          onSpeakingChange: (spk) => setSpeaking(spk),
          onPeerSpeakingChange: (peerSpk) => setPeerSpeaking(peerSpk),
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
      webrtcEngine.cleanup();
      sounds.playEndCall();
      if (useCallStore.getState().autoConnectNext) {
        setFriendRequested(false);
        resetCall();
        setStatus('searching');
        socketClient.nextMatch(useCallStore.getState().mode || 'voice', {
          nativeLanguage,
          targetLanguages,
          interests,
          mood,
          intention,
          countryPreference,
          oneQuestionAnswer,
        });
      } else {
        setStatus('disconnected');
      }
    });

    const unsubChat = socketClient.on('chat:message', (payload: any) => {
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
    socketClient.sendChat(
      content,
      nativeLanguage,
      targetTranslationLanguage,
      enableLiveTranslation
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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2 sm:py-6 min-h-[calc(100dvh-4.5rem)] pb-36 sm:pb-16 flex flex-col justify-between">
      {/* Top Status & Controls Header */}
      <div className="flex items-center justify-between glass-panel px-3.5 py-2 rounded-2xl border border-white/10 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                status === 'matched'
                  ? 'bg-emerald-400 animate-pulse'
                  : status === 'searching'
                  ? 'bg-secondary animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider font-mono">
              {status === 'matched'
                ? formatDuration(callDuration)
                : status === 'searching'
                ? 'Matching...'
                : status === 'disconnected'
                ? 'Peer Left'
                : 'Idle'}
            </span>
          </div>

          {peer?.mood && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300 capitalize">
              {peer.mood}
            </span>
          )}

          {/* Auto-Connect Next Checkbox Toggle */}
          <label
            className="flex items-center gap-1.5 cursor-pointer select-none bg-surfaceLight/80 hover:bg-white/10 px-2 sm:px-2.5 py-1 rounded-xl border border-white/10 text-[11px] font-semibold text-gray-300 transition-all"
            title="When a peer leaves or skips, automatically connect to the next person"
          >
            <input
              type="checkbox"
              checked={autoConnectNext}
              onChange={toggleAutoConnectNext}
              className="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-secondary focus:ring-secondary accent-secondary cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <span className={autoConnectNext ? 'text-secondary font-bold' : 'text-gray-400'}>
                ⚡ Auto-Next
              </span>
            </span>
          </label>
        </div>

        {/* Top Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {status === 'matched' && (
            <>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isChatOpen
                    ? 'bg-primary/25 text-secondary border-primary/40'
                    : 'bg-surfaceLight hover:bg-white/10 text-gray-300 border-white/10'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat</span>
                {messages.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[9px] font-mono">
                    {messages.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-surfaceLight hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-accent-pink" />
                <span className="hidden sm:inline">Games</span>
              </button>

              <button
                onClick={() => setIsAudioSettingsOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-surfaceLight hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Audio & Mic Settings"
              >
                <Sliders className="w-3.5 h-3.5 text-secondary" />
                <span className="hidden sm:inline">Audio</span>
              </button>
            </>
          )}

          <button
            onClick={status === 'matched' ? handleLeaveCall : handleCancelSearch}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            title={status === 'matched' ? 'End and Leave Call' : 'Cancel Search'}
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>{status === 'matched' ? 'End Call' : 'Cancel'}</span>
          </button>
        </div>
      </div>

      {/* Main Center Stage */}
      <div className="my-auto w-full">
        {directCallState === 'ringing' ? (
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
            <div className="absolute w-36 h-36 sm:w-48 sm:h-48 rounded-full border border-emerald-500/30 animate-ping opacity-30" />
            <div className="absolute w-52 h-52 sm:w-72 sm:h-72 rounded-full border border-emerald-500/20 animate-pulse-slow opacity-20" />

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-primary to-secondary p-1 shadow-2xl mb-4 relative">
              <div className="w-full h-full rounded-full bg-background overflow-hidden flex items-center justify-center text-2xl">
                <img
                  src={getDicebearAvatarUrl(directPartnerName)}
                  alt="Partner Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-background animate-pulse flex items-center justify-center text-[10px]">
                📞
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              Calling {directPartnerName}...
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Waiting for them to receive and accept the call.
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
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel flex flex-col items-center justify-center text-center p-6 space-y-4">
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
                    : 'The user is currently offline or in another conversation.')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDirectCallState('idle');
                  handleStartQueue(initialMode);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Random Voice Match</span>
              </button>

              <button
                onClick={() => router.push('/history')}
                className="px-4 py-2.5 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-bold transition-all"
              >
                Back to History
              </button>
            </div>
          </div>
        ) : status === 'searching' ? (
          <div className="w-full h-[240px] sm:h-[320px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
            <div className="absolute w-36 h-36 sm:w-48 sm:h-48 rounded-full border border-primary/40 animate-ping opacity-40" />
            <div className="absolute w-52 h-52 sm:w-72 sm:h-72 rounded-full border border-secondary/30 animate-pulse-slow opacity-30" />

            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-secondary animate-spin mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-white">Finding a match...</h3>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 max-w-xs">
              Pairing based on {intention} conversation &amp; {mood} mood.
            </p>

            <button
              onClick={handleCancelSearch}
              className="mt-4 px-5 py-2 rounded-xl bg-surfaceLight hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 text-xs font-semibold border border-white/10 hover:border-rose-500/30 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Cancel Search</span>
            </button>
          </div>
        ) : status === 'disconnected' ? (
          <div className="w-full h-[240px] sm:h-[320px] rounded-3xl glass-panel flex flex-col items-center justify-center text-center p-6 space-y-3">
            <span className="text-3xl sm:text-4xl">👋</span>
            <h3 className="text-lg sm:text-xl font-bold text-white">Conversation Ended</h3>
            <p className="text-xs text-gray-400 max-w-xs">
              Your peer has left or skipped to the next person.
            </p>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-surfaceLight px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={autoConnectNext}
                onChange={toggleAutoConnectNext}
                className="w-3.5 h-3.5 rounded accent-secondary cursor-pointer"
              />
              <span>Auto-connect next time a call ends</span>
            </label>

            <div>
              <button
                onClick={handleNextMatch}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white text-xs sm:text-sm font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-transform"
              >
                Find Next Person
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

            {/* Collapsible/Compact AI & Translation Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <AIWidget
                suggestion={icebreakerSuggestion}
                isEnabled={enableAiAssistant}
                onToggleEnabled={() =>
                  updatePreferences({ enableAiAssistant: !enableAiAssistant })
                }
                onSendToChat={handleSendMessage}
              />

              <TranslationBar
                isEnabled={enableLiveTranslation}
                onToggle={() =>
                  updatePreferences({ enableLiveTranslation: !enableLiveTranslation })
                }
                targetLang={targetTranslationLanguage}
                onSelectLang={(l) => updatePreferences({ targetTranslationLanguage: l })}
                currentCaption={liveTranslationCaption}
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-[240px] sm:h-[320px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-lg shadow-primary/30 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-background/90 flex items-center justify-center text-secondary">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Ready for a Voice Match?</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Tap below to instantly connect with someone based on shared vibe.
              </p>
            </div>
            <button
              onClick={() => handleStartQueue(initialMode)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Radio className="w-4 h-4 animate-spin" />
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
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-surfaceLight text-gray-300 hover:text-white"
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

      {/* Bottom In-Call Dock (Ergonomic for Mobile & Desktop) */}
      {status === 'matched' && (
        <div className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-40 max-w-lg w-[calc(100%-1.5rem)] sm:w-auto glass-panel-glow p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl border border-white/15 flex items-center justify-between gap-2 sm:gap-3 shadow-2xl backdrop-blur-3xl">
          {/* Mute Mic */}
          <button
            onClick={toggleMute}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-surfaceLight hover:bg-white/10 text-gray-200 border border-white/10'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Deafen Audio */}
          <button
            onClick={toggleDeafen}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              isDeafened
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-surfaceLight hover:bg-white/10 text-gray-200 border border-white/10'
            }`}
            title={isDeafened ? 'Enable Speaker' : 'Deafen Audio'}
          >
            {isDeafened ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Friend Request */}
          <button
            onClick={handleSendFriendRequest}
            disabled={friendRequested}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              friendRequested
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'bg-surfaceLight hover:bg-white/10 text-white border border-white/10'
            }`}
            title={friendRequested ? 'Friend Added' : 'Add Friend'}
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </button>

          {/* Launch In-Call Game */}
          <button
            onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              isGameMenuOpen
                ? 'bg-accent-pink/30 text-accent-pink border border-accent-pink/50 shadow-lg shadow-pink-500/20'
                : 'bg-surfaceLight hover:bg-white/10 text-gray-200 border border-white/10'
            }`}
            title="Launch Mini-Game"
          >
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-accent-pink" />
          </button>

          {/* Skip / Next Match */}
          <button
            onClick={handleNextMatch}
            className="flex-1 h-11 sm:h-12 min-w-[100px] flex items-center justify-center gap-1.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-primary via-indigo-500 to-secondary text-white text-xs sm:text-sm font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <SkipForward className="w-4 h-4" />
            <span>Next</span>
          </button>

          {/* Report & Block */}
          <button
            onClick={() => setIsSafetyOpen(true)}
            className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center bg-surfaceLight hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 border border-white/10 transition-colors"
            title="Safety Report & Block"
          >
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* End Call */}
          <button
            onClick={handleLeaveCall}
            className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition-all"
            title="End Call"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
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
