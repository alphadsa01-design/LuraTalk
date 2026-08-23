'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Tag,
  Check,
  Lock,
  Sparkles,
  Shuffle,
} from 'lucide-react';
import { useUserStore, AVATAR_PRESETS, getDicebearAvatarUrl } from '@/stores/useUserStore';
import { motion, AnimatePresence } from 'framer-motion';

const CURATED_TOPICS = [
  'Gaming', 'Tech & AI', 'Indie Music', 'Movies', 'Anime', 'Philosophy',
  'Fitness', 'Travel', 'Startups', 'Reading', 'Sci-Fi', 'Languages',
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const {
    user,
    avatarId,
    avatarSeed,
    interests,
    addInterest,
    removeInterest,
    oneQuestionAnswer,
    updatePreferences,
  } = useUserStore();

  const [username, setUsername] = useState(user?.username || 'NeonExplorer');
  const [bio, setBio] = useState(user?.bio || 'Curious about tech, late-night chats, and good music.');
  const [questionAnswer, setQuestionAnswer] = useState(oneQuestionAnswer || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentAvatar =
    AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0];

  const rollNewUsername = () => {
    const prefixes = ['Radiant', 'Starlit', 'Neon', 'Cosmic', 'Solar', 'Velvet', 'Lunar', 'Echo', 'Shadow', 'Mystic', 'Nova', 'Vivid'];
    const nouns = ['Drifter', 'Voyager', 'Phoenix', 'Beacon', 'Nomad', 'Whisper', 'Rider', 'Pulse', 'Cipher', 'Vibe', 'Spark', 'Wanderer'];
    const num = Math.floor(Math.random() * 900) + 100;
    const newName = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
    setUsername(newName);
  };

  const handleSave = () => {
    updatePreferences({
      user: { ...(user || {}), username, bio },
      oneQuestionAnswer: questionAnswer,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-7 border border-white/10 relative shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${currentAvatar.gradient} p-0.5 shadow-md overflow-hidden shrink-0`}>
              <img
                src={getDicebearAvatarUrl(avatarSeed)}
                alt="Avatar"
                className="w-full h-full object-cover rounded-[13px] bg-slate-900/50"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white leading-none">
                  {username || user?.username || 'Anonymous User'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Active
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Customize your voice persona &amp; match identity</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          {/* Custom Username / Alias */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                Display Name / Alias
              </label>
              <button
                type="button"
                onClick={rollNewUsername}
                className="text-[11px] font-semibold text-secondary hover:text-secondary-hover transition-colors flex items-center gap-1.5"
              >
                <Shuffle className="w-3 h-3" />
                <span>Roll Random Alias</span>
              </button>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. RadiantDrifter42"
              maxLength={24}
              className="w-full bg-surfaceLight border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          {/* Mystery Bio */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Mystery Bio
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What are you curious or passionate about? (Revealed in Stage 3)"
              className="w-full bg-surfaceLight border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          {/* Topic Pills */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              Passions &amp; Match Signals
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CURATED_TOPICS.map((tag) => {
                const normalized = tag.toLowerCase();
                const isSelected = interests.some((i) => i.toLowerCase() === normalized);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        removeInterest(normalized);
                      } else {
                        addInterest(normalized);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all bg-transparent ${
                      isSelected
                        ? 'border-white text-white font-bold'
                        : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimal Icebreaker Starter */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Icebreaker Prompt</span>
            </label>
            <input
              type="text"
              value={questionAnswer}
              onChange={(e) => setQuestionAnswer(e.target.value)}
              placeholder="Where would you travel tomorrow if money didn't matter?"
              className="w-full bg-surfaceLight border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>100 Trust Score</span>
          </span>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-transparent hover:bg-white/10 border border-white/40 hover:border-white text-white text-xs font-bold transition-all"
          >
            {savedSuccess ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
