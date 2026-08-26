'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Maximize2, Minimize2, StopCircle } from 'lucide-react';

interface ScreenShareViewProps {
  stream: MediaStream | null;
  isLocal: boolean;
  peerName: string;
  onStopShare: () => void;
}

export default function ScreenShareView({
  stream,
  isLocal,
  peerName,
  onStopShare,
}: ScreenShareViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      const handleReady = () => {
        setIsVideoReady(true);
        if (video.paused) {
          video.play().catch(() => {});
        }
      };

      video.onloadedmetadata = handleReady;
      video.onloadeddata = handleReady;
      video.oncanplay = handleReady;
      video.onplaying = handleReady;
      handleReady();

      const tracks = stream.getVideoTracks();
      tracks.forEach((track) => {
        track.onunmute = handleReady;
        track.onended = () => {
          onStopShare?.();
        };
      });

      return () => {
        video.onloadedmetadata = null;
        video.onloadeddata = null;
        video.oncanplay = null;
        video.onplaying = null;
      };
    }
  }, [stream, onStopShare]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-3xl overflow-hidden glass-panel border border-white/15 shadow-2xl bg-black flex flex-col items-center justify-center min-h-[300px] sm:min-h-[420px] max-h-[64vh]"
    >
      {/* Video Stream Element */}
      <video
        ref={(el) => {
          (videoRef as any).current = el;
          if (el && stream && el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain max-h-[58vh] sm:max-h-[64vh] rounded-2xl bg-black relative z-10"
      />

      {/* Loading Overlay while waiting for remote video packets */}
      {!isVideoReady && !isLocal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-0 bg-neutral-950/90 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3" />
          <p className="text-sm font-semibold text-white">Connecting Live Screen...</p>
          <p className="text-xs text-neutral-400 mt-1">Establishing encrypted video channel</p>
        </div>
      )}

      {/* Floating Top Control Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Stream Status Badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isLocal ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg">
              <Monitor className="w-3.5 h-3.5 text-white" />
              <span>You are sharing your screen</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{peerName}&apos;s Screen (Live HD)</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isLocal && (
            <button
              onClick={onStopShare}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg active:scale-95"
              title="Stop Screen Sharing"
            >
              <StopCircle className="w-3.5 h-3.5 text-rose-300" />
              <span>Stop Sharing</span>
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
