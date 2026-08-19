'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Radio,
  Users,
  Compass,
  Shield,
  Sparkles,
  Dices,
  Check,
  ChevronDown,
  ShieldCheck,
  Zap,
  Flame,
  X,
  SlidersHorizontal,
  Sliders,
  Lock,
  History,
} from 'lucide-react';
import { useUserStore, AVATAR_PRESETS, getDicebearAvatarUrl } from '@/stores/useUserStore';
import ProfileModal from '@/components/ProfileModal';
import AudioSettingsModal from '@/components/AudioSettingsModal';
import LuraLogo from '@/components/LuraLogo';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const pathname = usePathname();
  const { user, avatarId, avatarSeed, setAvatar, rollRandomAvatar, mood, intention } = useUserStore();
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFullProfileModalOpen, setIsFullProfileModalOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAvatar =
    AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { name: 'Match', href: '/', icon: Radio },
    { name: 'Lounges', href: '/rooms', icon: Compass },
    { name: 'Friends', href: '/friends', icon: Users },
    { name: 'History', href: '/history', icon: History },
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="hover:opacity-95 transition-opacity">
            <LuraLogo size="md" />
          </Link>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden sm:flex items-center gap-1.5 p-1 rounded-2xl bg-surfaceLight/60 border border-white/5 backdrop-blur-md">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white/10 text-white shadow-sm border border-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-secondary' : ''}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile Station & Avatar Picker */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-2xl bg-surfaceLight/80 hover:bg-surfaceLight border border-white/10 hover:border-white/20 transition-all shadow-sm group"
            >
              {/* Avatar Pill with DiceBear SVG */}
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr ${currentAvatar.gradient} p-0.5 shadow-md group-hover:scale-105 transition-transform overflow-hidden`}
              >
                <img
                  src={getDicebearAvatarUrl(avatarSeed)}
                  alt="Avatar"
                  className="w-full h-full object-cover rounded-[10px] bg-slate-900/40"
                />
              </div>

              {/* Username */}
              <div className="text-left hidden xs:block">
                <p className="text-xs font-bold text-white leading-tight max-w-[90px] sm:max-w-[120px] truncate">
                  {user?.username || 'Anonymous'}
                </p>
                <p className="text-[10px] text-gray-400 font-medium leading-none mt-0.5">
                  {avatarSeed || currentAvatar.name}
                </p>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-transform ${
                  isProfileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Minimal Profile Dropdown Menu */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-12 mt-2 w-72 rounded-2xl glass-panel p-4 border border-white/10 shadow-2xl z-50 space-y-3.5"
                >
                  {/* User Identity Header */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${currentAvatar.gradient} p-0.5 shadow-md overflow-hidden shrink-0`}
                    >
                      <img
                        src={getDicebearAvatarUrl(avatarSeed)}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-[10px] bg-slate-900/50"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <span>{user?.username || 'Anonymous'}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </h4>
                      <p className="text-[11px] text-gray-400 font-mono">🔒 Locked Identity</p>
                    </div>
                  </div>

                  {/* Minimal Stat Chips */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="flex-1 px-2.5 py-1 rounded-xl bg-surfaceLight border border-white/5 text-[11px] font-semibold text-emerald-300 flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>100 Trust</span>
                    </span>
                    <span className="flex-1 px-2.5 py-1 rounded-xl bg-surfaceLight border border-white/5 text-[11px] font-semibold text-indigo-300 flex items-center justify-center gap-1 capitalize">
                      <Flame className="w-3 h-3 text-secondary" />
                      <span>{mood}</span>
                    </span>
                  </div>

                  {/* Audio & Mic Settings */}
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsAudioSettingsOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-secondary" />
                    <span>Audio &amp; Mic Settings</span>
                  </button>

                  {/* Edit Profile Trigger */}
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsFullProfileModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    <span>Edit Bio &amp; Topics</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Full Profile & Interests Modal */}
      <ProfileModal
        isOpen={isFullProfileModalOpen}
        onClose={() => setIsFullProfileModalOpen(false)}
      />

      {/* Audio & Microphone Settings Modal */}
      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar (Hidden during active calls on /match) */}
      {!pathname?.startsWith('/match') && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-2xl border-t border-white/10 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                  isActive ? 'text-secondary font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? 'bg-secondary/15 text-secondary scale-110' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.name}</span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-secondary mt-0.5" />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
