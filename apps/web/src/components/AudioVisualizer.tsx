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
      gradient.addColorStop(0, peerSpeaking ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)');
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
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(255, 255, 255, 0.7)'
            : w === 1
            ? 'rgba(161, 161, 170, 0.5)'
            : 'rgba(255, 255, 255, 0.15)';

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
    <div className="relative w-full h-[240px] sm:h-[320px] rounded-3xl glass-panel-glow border border-white/10 flex flex-col items-center justify-center overflow-hidden">
      {/* Dynamic Background Audio Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={360}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
      />

      {/* Top Left Shared Vibe Info (Minimalist) */}
      {sharedInterestsCount > 0 && (
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white font-medium backdrop-blur-md">
          <Sparkles className="w-3 h-3 text-white" />
          <span>{sharedInterestsCount} Shared Interests</span>
        </div>
      )}

      {/* Central Hero Avatar with Glowing Speaking Rings */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          {/* Speaking Halo Animation */}
          {peerSpeaking && (
            <>
              <span className="absolute -inset-4 rounded-full bg-white/20 animate-ping opacity-60 pointer-events-none" />
              <span className="absolute -inset-8 rounded-full bg-white/10 animate-pulse pointer-events-none" />
            </>
          )}

          <div
            className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full p-1 transition-all duration-300 ${
              peerSpeaking
                ? 'bg-white shadow-2xl shadow-white/30 scale-105'
                : isSpeaking
                ? 'bg-neutral-300 shadow-xl shadow-white/20'
                : 'bg-white/10 border border-white/20'
            }`}
          >
            <div className="w-full h-full rounded-full bg-surfaceLight flex items-center justify-center overflow-hidden shadow-inner">
              <img
                src={getDicebearAvatarUrl(peerAvatar || peerName || 'Peer')}
                alt={peerName}
                className="w-full h-full object-cover bg-neutral-900"
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
            <span className="text-white font-medium">Speaking...</span>
          ) : isSpeaking ? (
            <span className="text-neutral-300 font-medium">Listening to you</span>
          ) : (
            'Connected'
          )}
        </p>
      </div>
    </div>
  );
}
