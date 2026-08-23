'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, ArrowRight, ShieldCheck, Zap, Lock, Quote } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { useCallStore } from '@/stores/useCallStore';
import { getOrCreateAnonymousSession, fetchLiveOnlineStats } from '@/lib/api';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();
  const { token, setAuth } = useUserStore();
  const { resetCall } = useCallStore();
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setIsConnecting(false);
    resetCall();

    async function initSession() {
      if (!token) {
        try {
          const authData = await getOrCreateAnonymousSession();
          setAuth(authData.token, authData.user);
        } catch (err) {
          console.error('Session init error', err);
        }
      }
    }
    initSession();

    // Query real-time active online stats immediately and on interval
    async function updateStats() {
      try {
        const stats = await fetchLiveOnlineStats();
        if (stats && typeof stats.onlineCount === 'number') {
          setOnlineCount(stats.onlineCount);
        }
      } catch {}
    }

    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => clearInterval(interval);
  }, [token, setAuth, resetCall]);

  const handleStartCall = () => {
    resetCall();
    setIsConnecting(true);
    router.push('/match?mode=voice');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 min-h-[calc(100dvh-5rem)] flex flex-col justify-center items-center text-center py-8 sm:py-14">
      {/* Live Online Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-white/10 text-xs text-neutral-300 backdrop-blur-md mb-6 sm:mb-8 shadow-sm"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        <span className="font-mono text-white font-bold">{onlineCount.toLocaleString()}</span>
        <span className="text-neutral-400">people talking right now</span>
      </motion.div>

      {/* Main Title & Value Proposition - Black & White Metallic */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-4xl xs:text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] font-sans"
      >
        Real conversations. <br />
        <span className="gradient-text">Zero filters.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 sm:mt-6 text-base sm:text-lg text-neutral-400 font-normal leading-relaxed max-w-lg mx-auto"
      >
        Spontaneous, private 1-on-1 voice calls with strangers worldwide. No sign-ups, no profiles, no tracking.
      </motion.p>

      {/* Primary Action Button - High Contrast Monochromatic */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 sm:mt-10 w-full max-w-xs flex flex-col items-center gap-4"
      >
        <button
          onClick={handleStartCall}
          disabled={isConnecting}
          className="w-full py-4 px-8 rounded-2xl bg-white hover:bg-neutral-200 text-black text-base font-extrabold shadow-[0_0_30px_rgba(255,255,255,0.18)] hover:shadow-[0_0_40px_rgba(255,255,255,0.30)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
        >
          <Radio className="w-5 h-5 text-black" />
          <span>{isConnecting ? 'Connecting...' : 'Start Talking'}</span>
          <ArrowRight className="w-4 h-4 ml-0.5 text-black" />
        </button>
      </motion.div>

      {/* Thoughtful, Inspiring Quote Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="mt-10 sm:mt-12 w-full max-w-md p-5 sm:p-6 rounded-3xl bg-zinc-950/60 border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-white/20 transition-all duration-300 shadow-lg"
      >
        <div className="flex items-center justify-center mb-2.5 text-neutral-600">
          <Quote className="w-4 h-4 text-neutral-500 opacity-60 rotate-180" />
        </div>
        <p className="text-xs sm:text-sm text-neutral-300 font-serif italic leading-relaxed text-center">
          &ldquo;Behind every voice is a world waiting to be heard. The most honest conversations happen with someone you&rsquo;ve never met.&rdquo;
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="h-[1px] w-6 bg-white/15" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 font-semibold">
            The Art of Listening
          </span>
          <span className="h-[1px] w-6 bg-white/15" />
        </div>
      </motion.div>

      {/* Minimalist Trust Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="mt-10 sm:mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-neutral-400 w-full"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-white" />
          <span>100% Anonymous</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-white" />
          <span>Sub-100ms Low Latency</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-white" />
          <span>Private &amp; Secure</span>
        </div>
      </motion.div>
    </div>
  );
}
