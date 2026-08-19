'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radio,
  MessageSquare,
  Compass,
  ShieldCheck,
  Sparkles,
  Zap,
  ArrowRight,
  Globe,
  Gamepad2,
  Lock,
  Headphones,
  Users,
  EyeOff,
  Flame,
  Volume2,
  CheckCircle2,
  Clock,
  Check,
} from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { getOrCreateAnonymousSession } from '@/lib/api';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();
  const { token, user, setAuth, mood, intention, nativeLanguage, targetLanguages, interests, oneQuestionAnswer } =
    useUserStore();
  const [loadingMode, setLoadingMode] = useState<string | null>(null);

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
  }, [token, setAuth]);

  const handleStartMatch = (mode: 'voice' | 'text' | 'mystery') => {
    setLoadingMode(mode);
    router.push(`/match?mode=${mode}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-16 pb-28 sm:pb-20 space-y-12 sm:space-y-24">
      {/* HERO SECTION */}
      <div className="text-center max-w-4xl mx-auto pt-2 sm:pt-6 relative">
        {/* Clean Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-surfaceLight/80 border border-white/10 text-xs font-semibold text-gray-300 mb-4 sm:mb-6 shadow-lg backdrop-blur-xl"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span className="text-gray-200 font-medium text-[11px] sm:text-xs">Anonymous Voice Conversations</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.15] font-sans px-2"
        >
          Meet someone <br />
          <span className="gradient-text">worth talking to.</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 sm:mt-6 text-sm sm:text-lg lg:text-xl text-gray-400 font-normal leading-relaxed max-w-2xl mx-auto px-3"
        >
          Spontaneous voice conversations matched by shared interests and mood with no awkward silences.
        </motion.p>

        {/* Animated Hero Audio Spectrum */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="my-6 sm:my-8 flex items-center justify-center gap-1 sm:gap-1.5 h-11 sm:h-12 py-2 px-4 sm:px-6 rounded-2xl glass-panel border border-white/10 w-fit max-w-full mx-auto shadow-inner overflow-hidden"
        >
          <Headphones className="w-4 h-4 text-cyan-400 mr-1.5 sm:mr-2 shrink-0" />
          {[40, 75, 100, 55, 85, 30, 95, 60, 80, 45, 90, 65, 35, 85, 50, 70, 90, 40].map((h, idx) => (
            <motion.div
              key={idx}
              animate={{ height: ['20%', `${h}%`, '30%'] }}
              transition={{ repeat: Infinity, duration: 1.2 + (idx % 4) * 0.2, ease: 'easeInOut' }}
              className="w-1 rounded-full bg-gradient-to-t from-primary via-secondary to-accent-pink"
            />
          ))}
        </motion.div>

        {/* Simple & Clean Action Cards */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 max-w-3xl mx-auto"
        >
          {/* Card 1: Voice Chat */}
          <button
            onClick={() => handleStartMatch('voice')}
            disabled={!!loadingMode}
            className="p-4 sm:p-6 rounded-2xl bg-surfaceLight/80 hover:bg-surfaceLight border border-white/10 hover:border-primary/50 text-left transition-all duration-200 flex flex-col justify-between group shadow-sm active:scale-[0.98]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-hover flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-primary-hover transition-colors">
                Voice Chat
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Instant real-time voice call with strangers.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center gap-1.5 text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
              <span>{loadingMode === 'voice' ? 'Connecting...' : 'Start Voice'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Mystery Match */}
          <button
            onClick={() => handleStartMatch('mystery')}
            disabled={!!loadingMode}
            className="p-4 sm:p-6 rounded-2xl bg-surfaceLight/80 hover:bg-surfaceLight border border-white/10 hover:border-pink-500/50 text-left transition-all duration-200 flex flex-col justify-between group shadow-sm active:scale-[0.98]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-pink-400 transition-colors">
                Mystery Match
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Progressive profile reveal as you talk.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center gap-1.5 text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
              <span>{loadingMode === 'mystery' ? 'Unlocking...' : 'Try Mystery'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 3: Text Chat */}
          <button
            onClick={() => handleStartMatch('text')}
            disabled={!!loadingMode}
            className="p-4 sm:p-6 rounded-2xl bg-surfaceLight/80 hover:bg-surfaceLight border border-white/10 hover:border-cyan-400/50 text-left transition-all duration-200 flex flex-col justify-between group shadow-sm active:scale-[0.98]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                Text Chat
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Quiet messaging with live translation.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center gap-1.5 text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
              <span>{loadingMode === 'text' ? 'Entering...' : 'Start Text'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </motion.div>
      </div>

      {/* HOW MYSTERY MATCH WORKS: SLEEK BENTO GRID */}
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs font-bold text-pink-400">
            <EyeOff className="w-3.5 h-3.5" />
            <span>Progressive Discovery Protocol</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">How Mystery Match Works</h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
            A progressive 3-stage unlock designed for genuine chemistry without visual superficiality.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Bento Card 1 (Hero Large: 7 cols) - The 3 Milestone Flow */}
          <div className="md:col-span-7 glass-panel rounded-[28px] p-6 sm:p-7 border border-white/10 flex flex-col justify-between hover:border-pink-500/30 transition-all space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold uppercase tracking-wider">
                  The Protocol
                </span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live Sync
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">3-Stage Progressive Unlock</h3>
              <p className="text-xs text-gray-400 mt-1">
                Your identity reveals gradually as conversation milestones are reached.
              </p>
            </div>

            {/* 3 Step List with Progress Bars */}
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="p-3 rounded-2xl bg-surfaceLight/60 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center justify-center shrink-0">
                    01
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Blind Voice Start</p>
                    <p className="text-[11px] text-gray-400">Anonymous pseudonym &amp; frosted avatar only</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-gray-500">0:00</span>
              </div>

              {/* Step 2 */}
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-primary/25 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                    02
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Shared Topics Decrypted</p>
                    <p className="text-[11px] text-indigo-300/80">Reveals #Gaming, #Music &amp; match score</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-indigo-300">1:00</span>
              </div>

              {/* Step 3 */}
              <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-pink-500/25 text-pink-300 text-xs font-bold flex items-center justify-center shrink-0">
                    03
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Mutual Profile Reveal</p>
                    <p className="text-[11px] text-pink-300/80">Bio unlocks &amp; adds friend to your lounge</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-pink-300">Opt-In</span>
              </div>
            </div>
          </div>

          {/* Right Column Stack (5 cols) */}
          <div className="md:col-span-5 grid grid-cols-1 gap-5">
            {/* Bento Card 2: 60-Second Resonance */}
            <div className="glass-panel rounded-[28px] p-5 sm:p-6 border border-white/10 flex flex-col justify-between hover:border-cyan-500/30 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">60-Second Resonance</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Giving real conversations a genuine chance before quick exits.
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono font-bold shrink-0">
                  0:60
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-cyan-400 font-semibold flex items-center justify-between">
                <span>Anti-Ghosting</span>
                <span>Quality First</span>
              </div>
            </div>

            {/* Bento Card 3: Mutual Consent Shield */}
            <div className="glass-panel rounded-[28px] p-5 sm:p-6 border border-white/10 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Bilateral Consent Shield</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Full profiles reveal only if both peers opt in. Zero unilateral leaks.
                  </p>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase shrink-0">
                  Secure
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-emerald-400 font-semibold flex items-center justify-between">
                <span>Opt-In Reveal</span>
                <span>Protected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE BENTO SHOWCASE */}
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">Engineered for Better Chemistry</h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
            Everything you need for effortless, high-trust stranger conversations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-pink/20 text-accent-pink flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Quiet AI Assistant</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Subtle conversation prompts when awkward silences arise, disabled whenever you prefer.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Live Translation</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Real-time bilingual subtitles during voice calls across Spanish, French, Japanese, and more.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">In-Call Mini-Games</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Synchronized Tic-Tac-Toe, Would You Rather, and Speed Trivia built straight into active calls.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Zero-Trace Privacy</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              No phone numbers, no tracking, and automated trust heuristics to prevent bad actors.
            </p>
          </div>
        </div>
      </div>

      {/* TOPIC LOUNGES CALLOUT */}
      <div className="max-w-5xl mx-auto glass-panel rounded-3xl p-8 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-bold text-cyan-300 mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Community Voice Stages</span>
          </div>
          <h3 className="text-2xl font-extrabold text-white">Prefer Group Discussions?</h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-lg">
            Explore dedicated topic lounges for Late Night Gaming, English Exchange, 3 AM Philosophy, and Indie Music.
          </p>
        </div>

        <button
          onClick={() => router.push('/rooms')}
          className="px-6 py-3.5 rounded-2xl bg-surfaceLight hover:bg-white/10 border border-white/15 text-white text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-center shrink-0 hover:scale-105"
        >
          <Compass className="w-4 h-4 text-cyan-400" />
          <span>Explore All Lounges</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
