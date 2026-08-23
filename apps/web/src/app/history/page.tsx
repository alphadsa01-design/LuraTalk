'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  History,
  PhoneCall,
  Clock,
  Calendar,
  UserPlus,
  Trash2,
  Radio,
  Check,
} from 'lucide-react';
import { useUserStore, getDicebearAvatarUrl, AVATAR_PRESETS } from '@/stores/useUserStore';
import { fetchCallHistory, deleteCallHistory, addFriend, getOrCreateAnonymousSession } from '@/lib/api';
import {
  getLocalCallHistory,
  saveLocalCallHistoryItem,
  deleteLocalCallHistoryItem,
  saveLocalFriend,
} from '@/lib/storage';
import { motion, AnimatePresence } from 'framer-motion';

interface HistoryItem {
  id: string;
  conversationId: string;
  roomName: string;
  durationSeconds: number;
  createdAt: string;
  partner: {
    id: string;
    username: string;
    avatarId: string;
    avatarSeed?: string;
    mood?: string;
    interests?: string[];
  };
  isPartnerOnline: boolean;
  isFriend: boolean;
}

export default function HistoryPage() {
  const router = useRouter();
  const { token, setAuth } = useUserStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'long'>('all');
  const [callingId, setCallingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    // 1. Instantly load from client local storage (zero DB latency)
    const local = getLocalCallHistory();
    if (local && local.length > 0) {
      setHistory(local as any);
      setLoading(false);
    }

    async function loadData() {
      let activeToken = token;
      if (!activeToken) {
        try {
          const authData = await getOrCreateAnonymousSession();
          setAuth(authData.token, authData.user);
          activeToken = authData.token;
        } catch (err) {
          console.error('Auth error', err);
          setLoading(false);
          return;
        }
      }

      if (activeToken) {
        try {
          const remote = await fetchCallHistory(activeToken);
          // Merge local and remote without duplicates
          const mergedMap = new Map();
          [...(remote || []), ...local].forEach((item) => {
            const key = item.conversationId || item.id;
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item);
            }
          });
          const merged = Array.from(mergedMap.values());
          setHistory(merged as any);
          merged.forEach((m) => saveLocalCallHistoryItem(m));
        } catch (err) {
          console.warn('Using offline cached call history', err);
        } finally {
          setLoading(false);
        }
      }
    }
    loadData();
  }, [token, setAuth]);

  const handleDelete = async (id: string) => {
    deleteLocalCallHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id && item.conversationId !== id));
    showToast('Call removed from history');
    if (token) {
      deleteCallHistory(token, id).catch(() => {});
    }
  };

  const handleAddFriend = async (partnerId: string) => {
    const targetItem = history.find((h) => h.partner?.id === partnerId);
    saveLocalFriend({
      id: `friend_${partnerId}`,
      friend: {
        id: partnerId,
        username: targetItem?.partner?.username || 'Partner',
        avatarId: targetItem?.partner?.avatarId || 'aura_1',
        mood: 'chill',
        intention: 'casual',
        interests: targetItem?.partner?.interests || [],
      },
      status: 'pending',
      isOnline: true,
      isIncoming: false,
    });

    setHistory((prev) =>
      prev.map((item) =>
        item.partner.id === partnerId ? { ...item, isFriend: true } : item
      )
    );
    showToast('Friend added successfully!');

    if (token) {
      addFriend(token, partnerId).catch((err) => {
        console.warn('Friend request saved locally; DB sync failed', err);
      });
    }
  };

  const handleCallBack = (item: HistoryItem) => {
    setCallingId(item.id);
    router.push(`/match?mode=voice&callPartnerId=${item.partner.id}&partnerName=${encodeURIComponent(item.partner.username)}`);
  };

  const showToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Under 10s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return 'Earlier';
    }
  };

  const isToday = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    } catch {
      return false;
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filter === 'today') return isToday(item.createdAt);
    if (filter === 'long') return item.durationSeconds >= 120;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-28 sm:pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-emerald-500/90 text-white text-xs font-bold shadow-2xl backdrop-blur-xl flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-xs font-semibold text-secondary mb-2">
            <History className="w-3.5 h-3.5" />
            <span>Recent Conversations</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Call History</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review previous talks, duration, and call past conversation partners back.
          </p>
        </div>

        <Link
          href="/match?mode=voice"
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all self-start sm:self-center"
        >
          <Radio className="w-4 h-4" />
          <span>New Voice Match</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filter === 'all'
              ? 'bg-white/15 text-white shadow-sm border border-white/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          All Calls ({history.length})
        </button>
        <button
          onClick={() => setFilter('today')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filter === 'today'
              ? 'bg-white/15 text-white shadow-sm border border-white/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Today ({history.filter((h) => isToday(h.createdAt)).length})
        </button>
        <button
          onClick={() => setFilter('long')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filter === 'long'
              ? 'bg-white/15 text-white shadow-sm border border-white/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Long Conversations (&gt;2m) ({history.filter((h) => h.durationSeconds >= 120).length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-panel rounded-2xl p-5 border border-white/5 animate-pulse flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="w-32 h-4 rounded bg-white/10" />
                  <div className="w-20 h-3 rounded bg-white/10" />
                </div>
              </div>
              <div className="w-24 h-8 rounded-xl bg-white/10" />
            </div>
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 sm:p-14 text-center border border-white/10 max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center mx-auto shadow-inner">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No Call History Found</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            {filter === 'today'
              ? "You haven't had any voice conversations yet today."
              : 'Your previous conversations and duration will be saved here automatically.'}
          </p>
          <Link
            href="/match?mode=voice"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surfaceLight hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all"
          >
            <Radio className="w-4 h-4 text-primary" />
            <span>Start Matching Now</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHistory.map((item) => {
            const avatarPreset = AVATAR_PRESETS.find((a) => a.id === item.partner?.avatarId) || AVATAR_PRESETS[0];

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Partner Info & Call Metadata */}
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary/30 to-secondary/30 border border-white/15 flex items-center justify-center text-xl overflow-hidden shadow-md">
                      <img
                        src={getDicebearAvatarUrl(item.partner?.avatarSeed || item.partner?.username || 'user')}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    {item.isPartnerOnline && (
                      <span
                        className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-background"
                        title="Online now"
                      />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">
                        {item.partner?.username || 'Anonymous Conversationalist'}
                      </h4>
                      {item.isFriend && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 text-indigo-300 text-[10px] font-bold">
                          Friend
                        </span>
                      )}
                      {item.isPartnerOnline && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                          Online
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span className="flex items-center gap-1 font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                        <Clock className="w-3 h-3" />
                        {formatDuration(item.durationSeconds)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        {formatTimeAgo(item.createdAt)}
                      </span>
                      {item.partner?.mood && (
                        <>
                          <span>•</span>
                          <span className="capitalize text-gray-400">{item.partner.mood}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Call Back, Add Friend, Delete */}
                <div className="w-full sm:w-auto flex items-center justify-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                  <button
                    onClick={() => handleCallBack(item)}
                    disabled={callingId === item.id}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
                    title="Call back this user"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Call Back</span>
                  </button>

                  {!item.isFriend && (
                    <button
                      onClick={() => handleAddFriend(item.partner.id)}
                      className="p-2.5 sm:p-2 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all"
                      title="Add to Friends"
                    >
                      <UserPlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2.5 sm:p-2 rounded-xl bg-surfaceLight hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-bold transition-all"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
