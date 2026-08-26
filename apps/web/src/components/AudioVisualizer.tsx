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
  onEndCall,
  onOpenGames,
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
      const energy = peerSpeaking ? 2.2 : isSpeaking ? 1.8 : 0.8;
      const radius = 70 + Math.sin(phase * 2) * 12 * energy;

      const gradient = ctx.createRadialGradient(width / 2, centerY, 20, width / 2, centerY, radius + 45);
      gradient.addColorStop(0, peerSpeaking ? 'rgba(168, 85, 247, 0.35)' : isSpeaking ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(width / 2, centerY, radius + 45, 0, Math.PI * 2);
      ctx.fill();

      // Flowing dynamic sine wave layers (Clearly visible & alive at all times)
      const waves = [
        { amplitude: (peerSpeaking ? 45 : isSpeaking ? 32 : 14), frequency: 0.016, color: peerSpeaking ? 'rgba(192, 132, 252, 0.8)' : isSpeaking ? 'rgba(34, 211, 238, 0.8)' : 'rgba(255, 255, 255, 0.4)', offset: 0, lineWidth: 3 },
        { amplitude: (peerSpeaking ? 32 : isSpeaking ? 24 : 10), frequency: 0.022, color: peerSpeaking ? 'rgba(147, 51, 234, 0.6)' : isSpeaking ? 'rgba(6, 182, 212, 0.6)' : 'rgba(255, 255, 255, 0.25)', offset: 2.2, lineWidth: 2 },
        { amplitude: (peerSpeaking ? 22 : isSpeaking ? 16 : 8), frequency: 0.028, color: peerSpeaking ? 'rgba(236, 72, 153, 0.5)' : isSpeaking ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.15)', offset: 4.4, lineWidth: 2 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        for (let x = 0; x < width; x += 3) {
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
        ctx.lineWidth = wave.lineWidth;
        ctx.stroke();
      });

      phase += (peerSpeaking || isSpeaking ? 0.09 : 0.04);
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
            <span className="text-emerald-400 font-medium animate-pulse">Speaking...</span>
          ) : isSpeaking ? (
            <span className="text-purple-300 font-medium">Listening to you</span>
          ) : (
            <span className="text-neutral-400">Connected</span>
          )}
        </p>
      </div>
    </div>
  );
}
