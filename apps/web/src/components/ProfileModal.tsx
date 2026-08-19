'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Tag,
  Check,
  Lock,
  Sparkles,
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

  const [bio, setBio] = useState(user?.bio || 'Curious about tech, late-night chats, and good music.');
  const [questionAnswer, setQuestionAnswer] = useState(oneQuestionAnswer || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentAvatar =
    AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0];

  const handleSave = () => {
    updatePreferences({
      user: { ...(user || {}), bio },
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
                  {user?.username || 'Anonymous User'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-400 text-[10px] font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Locked
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">System-Assigned Anonymous Identity</p>
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-primary/30 border-primary text-white font-bold shadow-sm'
                        : 'bg-surfaceLight border-white/5 text-gray-400 hover:text-white hover:border-white/15'
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
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Icebreaker Prompt</span>
            </label>
            <input
              type="text"
              value={questionAnswer}
              onChange={(e) => setQuestionAnswer(e.target.value)}
              placeholder="Where would you travel tomorrow if money didn't matter?"
              className="w-full bg-surfaceLight border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
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
            className="px-6 py-2 rounded-xl bg-white/15 hover:bg-white/20 border border-white/10 text-white text-xs font-bold transition-all shadow-md"
          >
            {savedSuccess ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
