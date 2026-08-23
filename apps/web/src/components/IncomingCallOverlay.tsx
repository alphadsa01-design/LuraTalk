'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone,
  PhoneOff,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import { socketClient } from '@/lib/socket';
import { useUserStore, getDicebearAvatarUrl, AVATAR_PRESETS } from '@/stores/useUserStore';
import { motion, AnimatePresence } from 'framer-motion';

import { useCallStore } from '@/stores/useCallStore';
import { webrtcEngine } from '@/lib/webrtc';
import { sounds } from '@/lib/sounds';
import { notifications } from '@/lib/notifications';

interface IncomingCallData {
  callId: string;
  roomName: string;
  callerId: string;
  callerName: string;
  callerAvatarId: string;
}

export default function IncomingCallOverlay() {
  const router = useRouter();
  const { token } = useUserStore();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  useEffect(() => {
    // Request permission once user interacts
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      notifications.requestPermission().catch(() => {});
    }

    // Ensure socket is connected if token is present
    if (token) {
      socketClient.connect(token);
    }

    const unsubIncoming = socketClient.on('direct:incoming_call', (payload: IncomingCallData) => {
      setIncomingCall(payload);
      sounds.startIncomingRingtone();
      notifications.showIncomingCall(payload.callerName, () => {
        handleAccept();
      });
    });

    const unsubCancelled = socketClient.on('direct:call_cancelled', (payload: { callerId: string }) => {
      setIncomingCall((curr) => {
        if (curr && curr.callerId === payload.callerId) {
          sounds.stopIncomingRingtone();
          return null;
        }
        return curr;
      });
    });

    const unsubMatch = socketClient.on('match:found', (payload: any) => {
      sounds.stopIncomingRingtone();
      sounds.playMatchFound();
      // If we received a match from an accepted incoming call while not on /match
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/match')) {
        useCallStore.getState().setMatchFound(payload);
        webrtcEngine.startCall({
          isInitiator: payload.isInitiator,
          livekitToken: payload.livekitToken,
          livekitUrl: payload.livekitUrl,
          roomName: payload.roomName,
          onSpeakingChange: (spk) => useCallStore.getState().setSpeaking(spk),
          onPeerSpeakingChange: (peerSpk) => useCallStore.getState().setPeerSpeaking(peerSpk),
        });
        router.push('/match?mode=voice&acceptedCall=1');
      }
    });

    return () => {
      sounds.stopIncomingRingtone();
      unsubIncoming();
      unsubCancelled();
      unsubMatch();
    };
  }, [token, router]);

  const handleAccept = () => {
    sounds.stopIncomingRingtone();
    if (!incomingCall) return;

    // Immediately pre-populate call store and prewarm mic for instant connection
    useCallStore.getState().setMatchFound({
      matchId: incomingCall.callId,
      roomName: incomingCall.roomName,
      isInitiator: false,
      peer: {
        id: incomingCall.callerId,
        username: incomingCall.callerName,
        avatarId: incomingCall.callerAvatarId,
        mysteryLevel: 3,
      },
    });

    webrtcEngine.warmupMicrophone().catch(() => {});
    socketClient.acceptDirectCall(incomingCall.callId, incomingCall.callerId, incomingCall.roomName);
    setIncomingCall(null);
    router.push('/match?mode=voice&acceptedCall=1');
  };

  const handleReject = () => {
    sounds.stopIncomingRingtone();
    if (!incomingCall) return;
    socketClient.rejectDirectCall(incomingCall.callerId);
    setIncomingCall(null);
  };

  const handleBlock = () => {
    sounds.stopIncomingRingtone();
    if (!incomingCall) return;
    socketClient.blockDirectCall(incomingCall.callerId);
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  const avatarPreset =
    AVATAR_PRESETS.find((a) => a.id === incomingCall.callerAvatarId) || AVATAR_PRESETS[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-3 sm:pt-6 px-3 sm:px-4">
        <motion.div
          initial={{ y: -50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="pointer-events-auto max-w-lg w-full glass-panel-glow border-2 border-primary/60 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl backdrop-blur-2xl bg-surface/95"
        >
          <div className="flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Caller Info with Ringing Pulse */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-lg flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-background/80 overflow-hidden flex items-center justify-center text-xl sm:text-2xl">
                    <img
                      src={getDicebearAvatarUrl(incomingCall.callerName)}
                      alt="Caller Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-400 border-2 border-background animate-ping" />
              </div>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-indigo-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-pulse" />
                  <span>Incoming Call</span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {incomingCall.callerName}
                </h3>
                <p className="text-[11px] text-gray-400 truncate hidden xs:block">Calling back</p>
              </div>
            </div>

            {/* Actions: Accept, Reject, Block */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Accept Call */}
              <button
                onClick={handleAccept}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
                title="Accept Call"
              >
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                <span className="hidden sm:inline">Accept</span>
              </button>

              {/* Reject Call */}
              <button
                onClick={handleReject}
                className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold active:scale-95 transition-all"
                title="Decline Call"
              >
                <PhoneOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Block Caller */}
              <button
                onClick={handleBlock}
                className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-rose-900/40 text-gray-400 hover:text-rose-300 border border-white/10 text-xs font-bold active:scale-95 transition-all"
                title="Block User"
              >
                <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
