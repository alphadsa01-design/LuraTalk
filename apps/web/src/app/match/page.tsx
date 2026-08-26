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
  Phone,
  Flame,
  Loader2,
  Languages,
  Radio,
  Sliders,
  Users,
  ScreenShare,
  ScreenShareOff,
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
import {
  saveLocalCallHistoryItem,
  saveLocalFriend,
  acceptLocalFriendRequest,
} from '@/lib/storage';
import AudioVisualizer from '@/components/AudioVisualizer';
import ScreenShareView from '@/components/ScreenShareView';
import { getNextCuratedDarkQuestion, getNextCuratedWYRCard } from '@/lib/aiQuestions';
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
    isInitiator,
    isMuted,
    isDeafened,
    isSpeaking,
    peerSpeaking,
    callDuration,
    messages,
    isPeerTyping,
    icebreakerSuggestion,
    liveTranslationCaption,
    isLocalScreenSharing,
    isRemoteScreenSharing,
    localScreenStream,
    remoteScreenStream,
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

  const { openGame, updateGameState, closeGame, resetGame } = useGameStore();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const friendRequestedRef = useRef(false);
  const [screenShareToast, setScreenShareToast] = useState<string | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const updateFriendRequested = (val: boolean) => {
    friendRequestedRef.current = val;
    setFriendRequested(val);
  };

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
      const currentCallState = useCallStore.getState();

      // If user is returning to an already matched active call (e.g. from Floating Overlay), resume view seamlessly without interrupting call
      if (currentCallState.status === 'matched' || currentCallState.status === 'in_call') {
        webrtcEngine.setSpeakingCallbacks(
          (spk) => setSpeaking(spk),
          (peerSpk) => setPeerSpeaking(peerSpk)
        );
        return;
      }

      // If accepted direct call, immediately start WebRTC audio
      if (acceptedCall) {
        if (currentCallState.roomName) {
          webrtcEngine.startCall({
            isInitiator: false,
            roomName: currentCallState.roomName,
            onSpeakingChange: (spk) => setSpeaking(spk),
            onPeerSpeakingChange: (peerSpk) => setPeerSpeaking(peerSpk),
            onDisconnected: () => {
              console.log('[Match] WebRTC audio disconnected');
            },
            onError: (err) => {
              if (err?.name === 'NotAllowedError') {
                console.warn('[Match] Microphone permission was not granted by user');
                setMicPermissionDenied(true);
              } else {
                console.warn('[Match] Handled WebRTC Call Error:', err);
              }
            },
          });
        }
      } else {
        if (callPartnerId) {
          setStatus('searching');
          setDirectCallState('ringing');
          socketClient.directCall(callPartnerId);
        } else {
          resetCall();
          handleStartQueue(initialMode);
        }
      }
    }

    const recordCallToLocalStorage = () => {
      const state = useCallStore.getState();
      if (state.peer) {
        saveLocalCallHistoryItem({
          id: state.matchId || `call_${Date.now()}`,
          conversationId: state.matchId || `call_${Date.now()}`,
          roomName: state.roomName || 'voice_match',
          durationSeconds: state.callDuration || 0,
          createdAt: new Date().toISOString(),
          partner: {
            id: state.peer.id,
            username: state.peer.username,
            avatarId: state.peer.avatarId || state.peer.username,
            countryCode: state.peer.countryCode,
            mood: state.peer.mood,
            intention: state.peer.intention,
            interests: state.peer.sharedInterests || [],
          },
          isPartnerOnline: true,
          isFriend: friendRequestedRef.current,
        });
      }
    };

    const triggerAutoNextMatch = () => {
      recordCallToLocalStorage();
      webrtcEngine.cleanup();
      sounds.playEndCall();
      updateFriendRequested(false);
      resetGame();
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
      if (payload.mode === 'voice' || payload.mode === 'mystery' || initialMode !== 'text') {
        webrtcEngine.startCall({
          isInitiator: payload.isInitiator,
          livekitToken: payload.livekitToken,
          livekitUrl: payload.livekitUrl,
          roomName: payload.roomName,
          onSpeakingChange: (spk) => setSpeaking(spk),
          onPeerSpeakingChange: (peerSpk) => setPeerSpeaking(peerSpk),
          onDisconnected: () => {
            console.log('[Match] WebRTC audio disconnected');
          },
          onError: (err) => {
            if (err?.name === 'NotAllowedError') {
              console.warn('[Match] Microphone permission was not granted by user');
              setMicPermissionDenied(true);
            } else {
              console.warn('[Match] Handled WebRTC Call Error:', err);
            }
          },
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

    const unsubFriendReq = socketClient.on('friend:request_received', (payload: any) => {
      updateFriendRequested(true);
      if (payload?.fromUserId) {
        saveLocalFriend({
          id: `friend_${payload.fromUserId}`,
          friend: {
            id: payload.fromUserId,
            username: payload.fromUsername || 'Anonymous',
            avatarId: payload.fromAvatarId || payload.fromUsername || 'aura_1',
            mood: 'chill',
            intention: 'casual',
            interests: [],
          },
          status: 'pending',
          isOnline: true,
          isIncoming: true,
        });
      }
    });

    const unsubFriendSent = socketClient.on('friend:request_sent', () => {
      updateFriendRequested(true);
    });

    const unsubFriendAccepted = socketClient.on('friend:accepted', (payload: any) => {
      updateFriendRequested(true);
      if (payload?.friendId) {
        acceptLocalFriendRequest(payload.friendId);
      }
    });

    const unsubFriendUpdate = socketClient.on('friend:update', (payload: any) => {
      updateFriendRequested(true);
      if (payload?.friendId && payload?.status === 'accepted') {
        acceptLocalFriendRequest(payload.friendId);
      }
    });

    initAndConnect();

    return () => {
      isMounted = false;
      const currentStatus = useCallStore.getState().status;
      // Only tear down audio and queue if user was NOT in an active call (active calls persist in FloatingCallOverlay)
      if (currentStatus !== 'matched' && currentStatus !== 'in_call') {
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
      unsubFriendReq();
      unsubFriendSent();
      unsubFriendAccepted();
      unsubFriendUpdate();
    };
  }, [token, initialMode]);

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
    const state = useCallStore.getState();
    if (state.peer) {
      saveLocalCallHistoryItem({
        id: state.matchId || `call_${Date.now()}`,
        conversationId: state.matchId || `call_${Date.now()}`,
        roomName: state.roomName || 'voice_match',
        durationSeconds: state.callDuration || 0,
        createdAt: new Date().toISOString(),
        partner: {
          id: state.peer.id,
          username: state.peer.username,
          avatarId: state.peer.avatarId || state.peer.username,
          countryCode: state.peer.countryCode,
          mood: state.peer.mood,
          intention: state.peer.intention,
          interests: state.peer.sharedInterests || [],
        },
        isPartnerOnline: true,
        isFriend: friendRequestedRef.current,
      });
    }
    sounds.playSkip();
    webrtcEngine.cleanup();
    updateFriendRequested(false);
    resetGame();
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
    const state = useCallStore.getState();
    if (state.peer) {
      saveLocalCallHistoryItem({
        id: state.matchId || `call_${Date.now()}`,
        conversationId: state.matchId || `call_${Date.now()}`,
        roomName: state.roomName || 'voice_match',
        durationSeconds: state.callDuration || 0,
        createdAt: new Date().toISOString(),
        partner: {
          id: state.peer.id,
          username: state.peer.username,
          avatarId: state.peer.avatarId || state.peer.username,
          countryCode: state.peer.countryCode,
          mood: state.peer.mood,
          intention: state.peer.intention,
          interests: state.peer.sharedInterests || [],
        },
        isPartnerOnline: true,
        isFriend: friendRequestedRef.current,
      });
    }
    sounds.playEndCall();
    webrtcEngine.cleanup();
    socketClient.send('call:end', {});
    socketClient.leaveQueue();
    updateFriendRequested(false);
    resetGame();
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
    resetGame();
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

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    toggleMute();
    webrtcEngine.setMuted(nextMuted);
  };

  const handleToggleDeafen = () => {
    const nextDeafened = !isDeafened;
    toggleDeafen();
    webrtcEngine.setDeafened(nextDeafened);
  };

  const handleToggleScreenShare = async () => {
    setScreenShareToast(null);
    if (isLocalScreenSharing) {
      await webrtcEngine.stopScreenShare();
    } else {
      try {
        await webrtcEngine.startScreenShare();
      } catch (err: any) {
        if (err.message === 'UNSUPPORTED_BROWSER') {
          setScreenShareToast(
            'Screen sharing is not supported by mobile Safari / WebKit. You can still view incoming screen shares from others!'
          );
          setTimeout(() => setScreenShareToast(null), 6000);
        } else {
          console.warn('[ScreenShare] Error or dismissed:', err);
        }
      }
    }
  };

  const handleRequestReveal = () => {
    socketClient.requestReveal();
  };

  const handleSendFriendRequest = () => {
    if (peer) {
      socketClient.sendFriendRequest(peer.id);
      saveLocalFriend({
        id: `friend_${peer.id}`,
        friend: {
          id: peer.id,
          username: peer.username,
          avatarId: peer.avatarId || peer.username,
          countryCode: peer.countryCode,
          mood: peer.mood || 'chill',
          intention: peer.intention || 'casual',
          interests: peer.sharedInterests || [],
        },
        status: 'pending',
        isOnline: true,
        isIncoming: false,
      });
      updateFriendRequested(true);
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
      <div className="flex items-center justify-between glass-panel px-3 sm:px-4 py-2.5 rounded-2xl border border-white/10 mb-4 sm:mb-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {status === 'matched' ? (
            <>
              <button
                onClick={() => router.push('/')}
                className="text-xs font-semibold text-neutral-300 hover:text-white transition-colors flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                title="Minimize call to floating window"
              >
                <span>← Minimize</span>
              </button>

              <button
                onClick={() => router.push('/friends')}
                className="text-xs font-semibold text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                title="View Friends while staying in call"
              >
                <Users className="w-3.5 h-3.5 text-secondary" />
                <span>Friends</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleCancelSearch}
              className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors flex items-center gap-1 p-1 rounded-lg hover:bg-white/5"
              title="Cancel and return home"
            >
              <span>← Cancel</span>
            </button>
          )}

          <span className="h-3.5 w-px bg-white/10" />

          {status === 'matched' ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 border-2 border-background animate-pulse flex items-center justify-center">
                <Phone className="w-3 h-3 text-slate-950" />
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
                className="px-5 py-2.5 rounded-xl bg-transparent hover:bg-white/10 text-white border border-white/40 hover:border-white text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Random Voice Match</span>
              </button>

              <button
                onClick={() => router.push('/history')}
                className="px-5 py-2.5 rounded-xl bg-transparent hover:bg-white/10 text-neutral-300 hover:text-white border border-white/20 hover:border-white/40 text-xs font-bold transition-all"
              >
                Back to History
              </button>
            </div>
          </div>
        ) : status === 'searching' ? (
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center text-center p-6 relative overflow-hidden border border-white/15 shadow-2xl">
            {/* Concentric Radar Rings & Glowing Halo */}
            <div className="absolute w-48 h-48 sm:w-72 sm:h-72 rounded-full border border-cyan-400/30 animate-ping opacity-40" />
            <div className="absolute w-64 h-64 sm:w-96 sm:h-96 rounded-full border border-purple-500/25 animate-pulse opacity-30" />

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-transparent border border-cyan-400/40 p-1 shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-4 relative z-10 flex items-center justify-center">
              <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300 animate-pulse" />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white z-10 tracking-wide">
              Connecting voice channel...
            </h3>
            <p className="text-xs text-neutral-300 mt-1.5 max-w-xs z-10">
              Matching with a live partner worldwide.
            </p>

            {/* Dynamic Connecting Soundwave Equalizer Bars */}
            <div className="flex items-center justify-center gap-1.5 mt-4 z-10 h-7">
              {[0.6, 1.0, 0.4, 0.9, 0.3, 0.8, 0.5, 1.0, 0.7].map((scale, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-cyan-400 to-purple-400 animate-pulse"
                  style={{
                    height: `${Math.round(scale * 24)}px`,
                    animationDelay: `${i * 120}ms`,
                    animationDuration: '800ms',
                  }}
                />
              ))}
            </div>

            <button
              onClick={handleCancelSearch}
              className="mt-5 px-6 py-2 rounded-xl bg-transparent hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-bold border border-white/20 hover:border-white/40 transition-all active:scale-95 flex items-center gap-1.5 z-10"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        ) : status === 'disconnected' ? (
          <div className="w-full h-[260px] sm:h-[340px] rounded-3xl glass-panel flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-transparent border border-white/20 text-white flex items-center justify-center">
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
                className="px-5 py-3 rounded-2xl bg-transparent hover:bg-white/10 text-white text-xs sm:text-sm font-semibold border border-white/20 hover:border-white/40 transition-all"
              >
                ← Back to Home
              </button>

              <button
                onClick={handleNextMatch}
                className="px-6 py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs sm:text-sm font-extrabold shadow-lg shadow-white/20 hover:scale-105 active:scale-95 transition-all"
              >
                Find Next Match ➔
              </button>
            </div>
          </div>
        ) : peer ? (
          <div className="space-y-3">
            {isRemoteScreenSharing || isLocalScreenSharing ? (
              <div className="space-y-2">
                <ScreenShareView
                  stream={isRemoteScreenSharing ? remoteScreenStream : localScreenStream}
                  isLocal={isLocalScreenSharing}
                  peerName={peer.username}
                  onStopShare={() => webrtcEngine.stopScreenShare()}
                />
                <div className="glass-panel px-3 py-1.5 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${peerSpeaking ? 'bg-cyan-400 animate-pulse' : 'bg-neutral-500'}`} />
                    <span className="text-neutral-300 font-medium">
                      {peer.username} {peerSpeaking ? 'is speaking' : 'is connected'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                    <span>{isMuted ? 'Mic Muted' : 'Mic Live'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <AudioVisualizer
                isSpeaking={isSpeaking}
                peerSpeaking={peerSpeaking}
                isMuted={isMuted}
                isDeafened={isDeafened}
                peerName={peer.username}
                peerAvatar={peer.avatarId}
                onEndCall={handleLeaveCall}
              />
            )}

            {/* AI Icebreaker Card (Clean, Unobtrusive, Single-Line Strip) */}
            {icebreakerSuggestion && (
              <div className="glass-panel px-4 py-2.5 rounded-2xl border border-white/15 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-white min-w-0">
                  <Sparkles className="w-4 h-4 text-white shrink-0" />
                  <span className="truncate text-neutral-300">{icebreakerSuggestion}</span>
                </div>
                <button
                  onClick={() => handleSendMessage(icebreakerSuggestion)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-transparent hover:bg-white/10 text-white border border-white/20 hover:border-white/50 text-[11px] font-semibold transition-all"
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
            <div className="w-16 h-16 rounded-2xl bg-transparent border border-white/30 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-transparent flex items-center justify-center text-white">
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
              className="px-6 py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black text-sm font-extrabold shadow-lg shadow-white/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
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
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-transparent hover:bg-white/10 text-neutral-300 hover:text-white border border-white/20"
            >
              <X className="w-4 h-4" />
            </button>
            <ChatPanel
              messages={messages}
              currentUserId={user?.id || 'me'}
              peerUsername={peer?.username || 'Peer'}
              peerId={peer?.id || 'peer'}
              peerAvatarId={peer?.avatarId || peer?.username}
              peerMood={peer?.mood}
              isPeerTyping={isPeerTyping}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Clean Floating Bottom In-Call Dock */}
      {status === 'matched' && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-1.5rem)] sm:w-auto glass-panel-glow p-1.5 sm:p-2 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-3xl flex items-center justify-between sm:justify-center gap-1.5 sm:gap-2 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
              isMuted
                ? 'bg-transparent text-rose-300 border border-rose-400'
                : 'bg-transparent hover:bg-white/10 text-white border border-white/20 hover:border-white/40'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-rose-300" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
          </button>

          {/* Chat Button with Badge */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center relative transition-all active:scale-95 ${
              isChatOpen
                ? 'bg-transparent text-white border-2 border-white'
                : 'bg-transparent hover:bg-white/10 text-neutral-200 border border-white/20 hover:border-white/40'
            }`}
            title="Open In-Call Chat"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            {messages.length > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-transparent border border-white text-white text-[9px] font-bold flex items-center justify-center shadow">
                {messages.length}
              </span>
            )}
          </button>

          {/* Screen Share Button */}
          <button
            onClick={handleToggleScreenShare}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
              isLocalScreenSharing
                ? 'bg-transparent text-secondary border-2 border-secondary scale-105 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-transparent hover:bg-white/10 text-neutral-200 border border-white/20 hover:border-white/40'
            }`}
            title={isLocalScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            {isLocalScreenSharing ? (
              <ScreenShareOff className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            ) : (
              <ScreenShare className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {/* In-Call Games Launcher Button */}
          <button
            onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
              isGameMenuOpen
                ? 'bg-transparent text-white border-2 border-white scale-105'
                : 'bg-transparent hover:bg-white/10 text-neutral-200 border border-white/20 hover:border-white/40'
            }`}
            title="Play In-Call Mini-Games (Tic-Tac-Toe, Would You Rather, Dark Truths)"
          >
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Next Match Button (Primary & Prominent - White with Black Text) */}
          <button
            onClick={handleNextMatch}
            className="flex-1 sm:flex-initial h-10 sm:h-11 min-w-[105px] sm:min-w-[125px] px-3.5 sm:px-5 rounded-2xl bg-white text-black text-xs sm:text-sm font-extrabold shadow-lg shadow-white/20 hover:bg-neutral-200 hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
            title="Find Next Match"
          >
            <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
            <span>Next</span>
          </button>

          {/* Add Friend Button */}
          <button
            onClick={handleSendFriendRequest}
            disabled={friendRequested}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
              friendRequested
                ? 'bg-transparent text-emerald-300 border border-emerald-400'
                : 'bg-transparent hover:bg-white/10 text-white border border-white/20 hover:border-white/40'
            }`}
            title={friendRequested ? 'Friend Added' : 'Add Friend'}
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </button>

          {/* Safety / Report Button */}
          <button
            onClick={() => setIsSafetyOpen(true)}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-transparent hover:bg-white/10 text-neutral-400 hover:text-white border border-white/20 hover:border-white/40 flex items-center justify-center transition-all active:scale-95"
            title="Safety & Moderation"
          >
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* End Call Button */}
          <button
            onClick={handleLeaveCall}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-transparent hover:bg-rose-500/20 text-white hover:text-rose-300 border border-white/20 hover:border-rose-400 flex items-center justify-center transition-all active:scale-95"
            title="End Conversation"
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
            { id: 'tictactoe', name: 'Tic-Tac-Toe (Turn by Turn)', icon: Gamepad2 },
            { id: 'dark_questions', name: 'Dark & Deep Truths', icon: Flame },
            { id: 'would_you_rather', name: 'Would You Rather', icon: Sparkles },
          ].map((game) => {
            const GameIcon = game.icon;
            return (
              <button
                key={game.id}
                onClick={() => {
                  let initialData: Record<string, any> = {};
                  if (game.id === 'dark_questions') {
                    const q = getNextCuratedDarkQuestion();
                    initialData = { question: q };
                    useGameStore.setState({ customData: { question: q, reactions: {} } });
                  } else if (game.id === 'would_you_rather') {
                    const c = getNextCuratedWYRCard();
                    initialData = { card: c };
                    useGameStore.setState({ customData: { card: c, votes: {} } });
                  }
                  socketClient.sendGameAction('start', game.id, initialData);
                  openGame(game.id as any);
                  setIsGameMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 text-xs font-semibold text-white transition-colors"
              >
                <GameIcon className="w-4 h-4 text-cyan-400" />
                <span>{game.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Synchronized Multiplayer Game Modal */}
      <GameOverlay
        currentUserId={user?.id || ''}
        peerName={peer?.username || 'Partner'}
        isInitiator={isInitiator ?? true}
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

      {/* Screen Share Notice Toast - Responsive Mobile Centered */}
      {screenShareToast && (
        <div className="fixed bottom-28 sm:bottom-24 left-0 right-0 mx-auto z-50 w-[calc(100%-2rem)] max-w-sm px-4 py-3 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-white/20 text-white text-xs font-medium shadow-2xl flex items-center justify-between gap-3 animate-fade-in">
          <span className="leading-snug text-left">{screenShareToast}</span>
          <button
            onClick={() => setScreenShareToast(null)}
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-neutral-400 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Microphone Permission Required Banner - Responsive Mobile Centered */}
      {micPermissionDenied && (
        <div className="fixed top-16 sm:top-20 left-0 right-0 mx-auto z-50 w-[calc(100%-2rem)] max-w-md px-4 py-3 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-rose-500/50 text-white text-xs font-medium shadow-2xl flex items-center gap-3 animate-fade-in">
          <MicOff className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="leading-snug text-left flex-1">
            Microphone access was blocked. Please click the lock or camera icon in your address bar to allow permissions and refresh.
          </span>
          <button
            onClick={() => setMicPermissionDenied(false)}
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-neutral-400 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
