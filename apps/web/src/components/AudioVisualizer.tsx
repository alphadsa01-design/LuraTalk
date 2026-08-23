'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, ShieldCheck, PhoneOff, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDicebearAvatarUrl } from '@/stores/useUserStore';

interface AudioVisualizerProps {
  isSpeaking: boolean;
  peerSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  peerName: string;
  peerAvatar: string;
  sharedInterestsCount?: number;
  sharedInterests?: string[];
  onEndCall?: () => void;
  onOpenGames?: () => void;
}

export default function AudioVisualizer({
  isSpeaking,
  peerSpeaking,
  isMuted,
  isDeafened,
  peerName,
  peerAvatar,
  sharedInterestsCount = 0,
  sharedInterests = [],
  onEndCall,
  onOpenGames,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const count = (sharedInterests && sharedInterests.length > 0) ? sharedInterests.length : sharedInterestsCount;

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
      gradient.addColorStop(0, peerSpeaking ? 'rgba(139, 92, 246, 0.25)' : 'rgba(6, 182, 212, 0.15)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(width / 2, centerY, radius + 30, 0, Math.PI * 2);
      ctx.fill();

      // Flowing dynamic sine wave layers
      const waves = [
        { amplitude: (peerSpeaking ? 30 : isSpeaking ? 18 : 6), frequency: 0.015, color: 'rgba(139, 92, 246, 0.4)', offset: 0 },
        { amplitude: (peerSpeaking ? 20 : isSpeaking ? 12 : 4), frequency: 0.02, color: 'rgba(6, 182, 212, 0.35)', offset: 2 },
        { amplitude: (peerSpeaking ? 12 : isSpeaking ? 8 : 3), frequency: 0.025, color: 'rgba(244, 63, 94, 0.25)', offset: 4 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        for (let x = 0; x < width; x += 4) {
          const y =
            centerY +
            Math.sin(x * wave.frequency + phase + wave.offset) *
              wave.amplitude *
              Math.sin((x / width) * Math.PI);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      phase += (peerSpeaking || isSpeaking ? 0.08 : 0.025);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSpeaking, peerSpeaking]);

  return (
    <div className="relative w-full min-h-[260px] sm:min-h-[320px] py-6 px-4 rounded-3xl glass-panel-glow border border-white/10 flex flex-col items-center justify-center overflow-hidden">
      {/* Dynamic Background Audio Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={360}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
      />

      {/* Top Left Shared Vibe Info Pill */}
      {count > 0 && (
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] text-white font-medium backdrop-blur-md shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
          <span>{count} Shared {count === 1 ? 'Interest' : 'Interests'}</span>
        </div>
      )}

      {/* Top Right Quick Games Trigger Pill */}
      {onOpenGames && (
        <button
          onClick={onOpenGames}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/40 text-[11px] text-white font-semibold backdrop-blur-md shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          title="Play In-Call Games (Tic-Tac-Toe, Trivia, Would You Rather)"
        >
          <Gamepad2 className="w-3.5 h-3.5 text-primary-light" />
          <span>Games</span>
        </button>
      )}

      {/* Central Hero Avatar with Glowing Speaking Rings */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          {/* Speaking Halo Animation */}
          {peerSpeaking && (
            <>
              <span className="absolute -inset-4 rounded-full bg-primary/30 animate-ping opacity-60 pointer-events-none" />
              <span className="absolute -inset-8 rounded-full bg-secondary/20 animate-pulse pointer-events-none" />
            </>
          )}

          <div
            className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full p-1 transition-all duration-300 ${
              peerSpeaking
                ? 'bg-gradient-to-tr from-primary to-secondary shadow-2xl shadow-primary/40 scale-105'
                : isSpeaking
                ? 'bg-primary/50 shadow-xl shadow-primary/20'
                : 'bg-white/10 border border-white/20'
            }`}
          >
            <div className="w-full h-full rounded-full bg-surfaceLight flex items-center justify-center overflow-hidden shadow-inner">
              <img
                src={getDicebearAvatarUrl(peerAvatar || peerName || 'Peer')}
                alt={peerName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          
          {/* Mini Live Status Indicator */}
          <div
            className={`absolute bottom-0 right-0 w-5 h-5 sm:w-7 sm:h-7 rounded-full border-2 border-background flex items-center justify-center shadow-lg transition-colors ${
              peerSpeaking ? 'bg-white text-black' : isDeafened ? 'bg-neutral-800 text-white' : 'bg-surfaceLight text-neutral-400 border-white/20'
            }`}
          >
            {peerSpeaking ? (
              <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
            ) : isDeafened ? (
              <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
        </div>

        {/* Peer Name & Subtitle */}
        <h3 className="mt-3 text-base sm:text-xl font-bold text-white tracking-wide">
          {peerName}
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          {peerSpeaking ? (
            <span className="text-emerald-400 font-medium animate-pulse">● Speaking...</span>
          ) : isSpeaking ? (
            <span className="text-purple-300 font-medium">Listening to you</span>
          ) : (
            <span className="text-neutral-400">Connected</span>
          )}
        </p>

        {/* Matched Shared Interests Pills */}
        {sharedInterests && sharedInterests.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-sm px-2">
            {sharedInterests.map((interest) => (
              <span
                key={interest}
                className="px-2.5 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[10px] font-medium text-white/90 capitalize shadow-sm backdrop-blur-md transition-all flex items-center gap-1"
              >
                <span className="text-cyan-300">•</span>
                <span>{interest}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
