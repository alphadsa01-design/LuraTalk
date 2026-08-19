'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, ShieldCheck, PhoneOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDicebearAvatarUrl } from '@/stores/useUserStore';

interface AudioVisualizerProps {
  isSpeaking: boolean;
  peerSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  peerName: string;
  peerAvatar: string;
  sharedInterestsCount: number;
  onEndCall?: () => void;
}

export default function AudioVisualizer({
  isSpeaking,
  peerSpeaking,
  isMuted,
  isDeafened,
  peerName,
  peerAvatar,
  sharedInterestsCount,
  onEndCall,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Draw subtle circular aura rings around the center
      const energy = peerSpeaking ? 1.6 : isSpeaking ? 1.2 : 0.4;
      const radius = 60 + Math.sin(phase * 2) * 8 * energy;

      const gradient = ctx.createRadialGradient(width / 2, centerY, 30, width / 2, centerY, radius + 30);
      gradient.addColorStop(0, peerSpeaking ? 'rgba(6, 182, 212, 0.25)' : 'rgba(99, 102, 241, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(width / 2, centerY, radius + 30, 0, Math.PI * 2);
      ctx.fill();

      // Draw active multi-layer audio frequency waves
      const waveCount = 3;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        ctx.lineWidth = 2 - w * 0.4;
        ctx.strokeStyle =
          w === 0
            ? peerSpeaking
              ? 'rgba(6, 182, 212, 0.85)'
              : 'rgba(99, 102, 241, 0.8)'
            : w === 1
            ? 'rgba(236, 72, 153, 0.6)'
            : 'rgba(255, 255, 255, 0.2)';

        for (let x = 0; x < width; x += 4) {
          const distanceToCenter = Math.abs(x - width / 2) / (width / 2);
          const envelope = Math.max(0, 1 - Math.pow(distanceToCenter, 1.8));

          const freq = 0.02 + w * 0.01;
          const amp = (peerSpeaking || isSpeaking ? 30 : 6) * energy * envelope;
          const y = centerY + Math.sin(x * freq + phase + w * 1.5) * amp;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      phase += (peerSpeaking || isSpeaking ? 0.08 : 0.025);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSpeaking, peerSpeaking]);

  return (
    <div className="relative w-full h-[200px] sm:h-[280px] rounded-3xl glass-panel-glow flex flex-col items-center justify-center overflow-hidden">
      {/* Background visualizer canvas */}
      <canvas
        ref={canvasRef}
        width={500}
        height={300}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Top security tag */}
      <div className="absolute top-2.5 left-3 sm:top-4 sm:left-4 flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/40 border border-white/10 text-[10px] sm:text-[11px] text-gray-300 backdrop-blur-md">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>Voice SFU</span>
      </div>

      {/* Top Right Action & Shared Info */}
      <div className="absolute top-2.5 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
        {sharedInterestsCount > 0 && (
          <div className="hidden xs:flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/20 border border-primary/40 text-[10px] sm:text-[11px] text-indigo-300 font-medium backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-secondary" />
            <span>{sharedInterestsCount} Shared</span>
          </div>
        )}

        {onEndCall && (
          <button
            onClick={onEndCall}
            className="flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] sm:text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer backdrop-blur-md"
            title="End Conversation"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        )}
      </div>

      {/* Central Avatar with Animated Glowing Pulse */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          {/* Speaking Ripple rings */}
          {peerSpeaking && (
            <>
              <span className="absolute -inset-3 rounded-full bg-secondary/30 animate-ping opacity-60 pointer-events-none" />
              <span className="absolute -inset-5 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
            </>
          )}

          <div
            className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full p-1 transition-all duration-300 ${
              peerSpeaking
                ? 'bg-gradient-to-tr from-secondary via-primary to-accent-pink shadow-xl shadow-secondary/50 scale-105'
                : 'bg-gradient-to-tr from-white/10 to-white/5 border border-white/15'
            }`}
          >
            <div className="w-full h-full rounded-full bg-surfaceLight flex items-center justify-center shadow-inner overflow-hidden">
              <img
                src={getDicebearAvatarUrl(peerAvatar || peerName || 'Peer')}
                alt={peerName}
                className="w-full h-full object-cover bg-slate-900/60"
              />
            </div>
          </div>

          {/* Speaking indicator dot */}
          <div
            className={`absolute bottom-0 right-0 w-4 h-4 sm:w-6 sm:h-6 rounded-full border-2 border-background flex items-center justify-center shadow-md transition-colors ${
              peerSpeaking ? 'bg-secondary' : isDeafened ? 'bg-rose-500' : 'bg-gray-600'
            }`}
          >
            {peerSpeaking ? (
              <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-black animate-pulse" />
            ) : (
              <VolumeX className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            )}
          </div>
        </div>

        {/* Peer name and state */}
        <h3 className="mt-2 text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
          {peerName}
        </h3>
        <p className="text-[10px] sm:text-xs text-gray-400">
          {peerSpeaking ? 'Speaking...' : isSpeaking ? 'Listening to you' : 'Connected'}
        </p>
      </div>

      {/* Bottom status badges */}
      <div className="absolute bottom-2 sm:bottom-3 flex items-center gap-2">
        <div
          className={`flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-medium border backdrop-blur-md ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          }`}
        >
          {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          <span>{isMuted ? 'Muted' : 'Mic Active'}</span>
        </div>

        <div
          className={`flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-medium border backdrop-blur-md ${
            isDeafened
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
          }`}
        >
          {isDeafened ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          <span>{isDeafened ? 'Deafened' : 'Audio On'}</span>
        </div>
      </div>
    </div>
  );
}
