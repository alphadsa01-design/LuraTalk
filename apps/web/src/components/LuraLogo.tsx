'use client';

import React from 'react';

interface LuraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function LuraLogo({
  size = 'md',
  showText = true,
  className = '',
}: LuraLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl sm:text-4xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 group select-none ${className}`}>
      {/* Sleek LuraTalk Vector Icon */}
      <div className={`relative ${iconSizes[size]} shrink-0`}>
        {/* Ambient Glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary via-secondary to-accent-pink opacity-75 blur-md group-hover:opacity-100 group-hover:blur-lg transition-all duration-300 animate-pulse-slow" />

        {/* Icon Container */}
        <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-indigo-600 via-primary to-secondary p-0.5 shadow-xl flex items-center justify-center overflow-hidden border border-white/20 group-hover:scale-105 transition-transform duration-300">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-[85%] h-[85%] drop-shadow-md"
          >
            {/* Background Dark Inset */}
            <rect width="40" height="40" rx="10" fill="#0c0d14" fillOpacity="0.85" />

            {/* Glowing Sound Waveform "L" Icon */}
            <defs>
              <linearGradient id="luraGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>

            {/* Stylized Futuristic "L" Wave Curve */}
            <path
              d="M11 9V26C11 28.7614 13.2386 31 16 31H29"
              stroke="url(#luraGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Realtime Audio Equalizer Bars */}
            <rect x="18" y="16" width="3" height="10" rx="1.5" fill="url(#barGrad)">
              <animate attributeName="height" values="10;14;6;12;10" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="y" values="16;12;20;14;16" dur="1.2s" repeatCount="indefinite" />
            </rect>

            <rect x="23" y="12" width="3" height="14" rx="1.5" fill="url(#luraGrad)">
              <animate attributeName="height" values="14;8;16;10;14" dur="0.9s" repeatCount="indefinite" />
              <animate attributeName="y" values="12;18;10;16;12" dur="0.9s" repeatCount="indefinite" />
            </rect>

            <rect x="28" y="18" width="3" height="8" rx="1.5" fill="#ec4899">
              <animate attributeName="height" values="8;13;5;11;8" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="y" values="18;13;21;15;18" dur="1.4s" repeatCount="indefinite" />
            </rect>

            {/* Live Audio Beacon Dot */}
            <circle cx="11" cy="9" r="2.5" fill="#38bdf8" className="animate-ping" opacity="0.8" />
            <circle cx="11" cy="9" r="2" fill="#ffffff" />
          </svg>
        </div>
      </div>

      {/* Typography Brand Name */}
      {showText && (
        <div className="flex flex-col">
          <span className={`${textSizes[size]} font-black tracking-tight text-white font-sans flex items-center leading-none`}>
            Lura<span className="gradient-text">Talk</span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary ml-1 shadow-sm shadow-secondary animate-pulse" />
          </span>
          {size === 'lg' || size === 'xl' ? (
            <span className="text-[10px] sm:text-xs font-semibold text-gray-400 tracking-wider uppercase mt-1">
              Spontaneous Voice &amp; Chat
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
