'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Camera, Maximize2, Minimize2, StopCircle, RefreshCw } from 'lucide-react';

interface ScreenShareViewProps {
  stream: MediaStream | null;
  isLocal: boolean;
  isCameraMode?: boolean;
  peerName: string;
  onStopShare: () => void;
  onFlipCamera?: () => void;
}

export default function ScreenShareView({
  stream,
  isLocal,
  isCameraMode = false,
  peerName,
  onStopShare,
  onFlipCamera,
}: ScreenShareViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('[ScreenShareView] Video play error:', err);
      });
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.warn('Fullscreen error:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen error:', err);
      }
    }
  };

  const handleFlip = async () => {
    if (onFlipCamera && !isFlipping) {
      setIsFlipping(true);
      await onFlipCamera();
      setTimeout(() => setIsFlipping(false), 500);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-3xl overflow-hidden glass-panel border border-white/15 shadow-2xl bg-black flex flex-col items-center justify-center min-h-[300px] sm:min-h-[420px] max-h-[64vh]"
    >
      {/* Video Stream Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-contain max-h-[58vh] sm:max-h-[64vh] rounded-2xl bg-black"
      />

      {/* Floating Top Control Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Stream Status Badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isLocal ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg">
              {isCameraMode ? (
                <>
                  <Camera className="w-3.5 h-3.5 text-white" />
                  <span>Sharing Live Camera</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3.5 h-3.5 text-white" />
                  <span>Sharing Screen</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{peerName}&apos;s Live Video (HD)</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isLocal && isCameraMode && onFlipCamera && (
            <button
              onClick={handleFlip}
              className="p-2 rounded-xl bg-transparent hover:bg-white/10 text-white border border-white/20 transition-all shadow-lg active:scale-95 flex items-center gap-1"
              title="Flip Front / Back Camera"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFlipping ? 'animate-spin' : ''}`} />
            </button>
          )}

          {isLocal && (
            <button
              onClick={onStopShare}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg active:scale-95"
              title="Stop Sharing"
            >
              <StopCircle className="w-3.5 h-3.5 text-rose-300" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-transparent hover:bg-white/10 text-white border border-white/20 transition-all shadow-lg active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
