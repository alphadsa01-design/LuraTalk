'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallStore } from '@/stores/useCallStore';
import { webrtcEngine } from '@/lib/webrtc';
import { socketClient } from '@/lib/socket';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Maximize2,
  Radio,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingCallOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    status,
    peer,
    isMuted,
    isDeafened,
    isSpeaking,
    peerSpeaking,
    callDuration,
    toggleMute,
    toggleDeafen,
    resetCall,
  } = useCallStore();

  // Only render floating overlay when in an active call and NOT on the /match full-screen view
  const isMatchPage = pathname?.startsWith('/match');
  const isCallActive = status === 'matched' && !isMatchPage;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const handleEndCall = () => {
    webrtcEngine.cleanup();
    socketClient.send('call:end', {});
    socketClient.leaveQueue();
    resetCall();
    useCallStore.getState().setStatus('idle');
  };

  const handleExpandCall = () => {
    router.push('/match?mode=voice');
  };

  return (
    <AnimatePresence>
      {isCallActive && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-24 sm:bottom-6 right-3 sm:right-6 z-[60] max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] sm:w-auto glass-panel-glow border border-primary/40 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-3"
        >
          {/* Peer & Call Info */}
          <div
            onClick={handleExpandCall}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            title="Click to return to call screen"
          >
            <div className="relative">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-tr from-primary/40 to-secondary/40 border flex items-center justify-center text-lg transition-all ${
                  peerSpeaking
                    ? 'border-emerald-400 shadow-md shadow-emerald-500/40 scale-105'
                    : 'border-white/10'
                }`}
              >
                🎭
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[140px]">
                  {peer?.username || 'Call Partner'}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                  {formatDuration(callDuration)}
                </span>
              </div>
              <p className="text-[10px] text-indigo-300 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Voice Call</span>
              </p>
            </div>
          </div>

          {/* Quick Floating Controls */}
          <div className="flex items-center gap-1.5">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-rose-500 text-white border-rose-500/50 shadow-md shadow-rose-500/20'
                  : 'bg-surfaceLight hover:bg-white/10 text-gray-200 border-white/10'
              }`}
              title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Deafen Audio */}
            <button
              onClick={toggleDeafen}
              className={`p-2 rounded-xl border transition-all ${
                isDeafened
                  ? 'bg-amber-500 text-white border-amber-500/50 shadow-md shadow-amber-500/20'
                  : 'bg-surfaceLight hover:bg-white/10 text-gray-200 border-white/10'
              }`}
              title={isDeafened ? 'Enable Speaker' : 'Deafen Audio'}
            >
              {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Expand / Return to Call */}
            <button
              onClick={handleExpandCall}
              className="p-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/40 text-secondary hover:text-white transition-all"
              title="Expand Call Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition-all"
              title="End Call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
