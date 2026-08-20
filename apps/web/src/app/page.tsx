'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, ArrowRight, ShieldCheck, Zap, Lock } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { getOrCreateAnonymousSession, fetchLiveOnlineStats } from '@/lib/api';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();
  const { token, setAuth } = useUserStore();
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
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
  }, [token, setAuth]);

  const handleStartCall = () => {
    setIsConnecting(true);
    router.push('/match?mode=voice');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 min-h-[calc(100dvh-5rem)] flex flex-col justify-center items-center text-center py-12">
      {/* Live Online Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-gray-300 backdrop-blur-md mb-6 sm:mb-8"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-mono text-emerald-400 font-semibold">{onlineCount.toLocaleString()}</span>
        <span className="text-gray-400">people talking right now</span>
      </motion.div>

      {/* Main Title & Value Proposition */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-4xl xs:text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] font-sans"
      >
        Real conversations <br />
        <span className="gradient-text">with real people.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-5 sm:mt-6 text-base sm:text-lg text-gray-400 font-normal leading-relaxed max-w-lg mx-auto"
      >
        Spontaneous, private 1-on-1 voice calls with strangers worldwide. No sign-ups, no profiles, no tracking.
      </motion.p>

      {/* Primary Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 sm:mt-10 w-full max-w-xs flex flex-col items-center gap-4"
      >
        <button
          onClick={handleStartCall}
          disabled={isConnecting}
          className="w-full py-4 px-8 rounded-2xl bg-white text-black text-base font-bold shadow-2xl shadow-white/20 hover:bg-neutral-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
        >
          <Radio className="w-5 h-5 text-black" />
          <span>{isConnecting ? 'Connecting...' : 'Start Talking'}</span>
          <ArrowRight className="w-4 h-4 ml-0.5" />
        </button>

        <button
          onClick={() => router.push('/rooms')}
          className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors flex items-center gap-1 py-1"
        >
          <span>or join a Community Lounge</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </motion.div>

      {/* Minimalist Trust Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-16 sm:mt-20 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-neutral-400"
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
