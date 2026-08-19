'use client';

import React, { useEffect, useState } from 'react';
import {
  Compass,
  Users,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Plus,
  Hand,
  Volume2,
  X,
  Search,
  Flame,
  Heart,
  Lightbulb,
  Rocket,
  Check,
} from 'lucide-react';
import { fetchTopicRooms, fetchRoomToken, getOrCreateAnonymousSession } from '@/lib/api';
import { useUserStore, getDicebearAvatarUrl } from '@/stores/useUserStore';
import { sounds } from '@/lib/sounds';
import { motion, AnimatePresence } from 'framer-motion';

interface RoomItem {
  id: string;
  title: string;
  topic: string;
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  tags: string[];
}

interface ReactionParticle {
  id: string;
  emoji: string;
  x: number;
}

const CATEGORIES = ['All', 'Late Night', 'Gaming', 'Tech', 'Music', 'Deep Talk', 'Chill'];

export default function RoomsPage() {
  const { token, user, setAuth } = useUserStore();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Stage state
  const [activeStage, setActiveStage] = useState<{ room: RoomItem; token: string } | null>(null);
  const [isStageMuted, setIsStageMuted] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [reactions, setReactions] = useState<ReactionParticle[]>([]);

  // Create lounge modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('Late Night');
  const [newDesc, setNewDesc] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    async function loadRooms() {
      try {
        const data = await fetchTopicRooms();
        setRooms(data || []);
      } catch (err) {
        console.error('Failed to load rooms', err);
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, []);

  const handleJoinStage = async (room: RoomItem) => {
    sounds.playMatchFound();
    let activeToken = token;
    if (!activeToken) {
      try {
        const authData = await getOrCreateAnonymousSession();
        setAuth(authData.token, authData.user);
        activeToken = authData.token;
      } catch (err) {
        console.error('Failed to authenticate for lounge', err);
        return;
      }
    }
    if (!activeToken) return;

    try {
      const stageData = await fetchRoomToken(activeToken, room.id);
      setActiveStage({ room, token: stageData.livekitToken });
      setIsHandRaised(false);
    } catch (err) {
      console.error('Failed to join stage', err);
      // Fallback for local demo preview
      setActiveStage({ room, token: 'demo-token' });
    }
  };

  const handleLeaveStage = () => {
    sounds.playEndCall();
    setActiveStage(null);
    setIsHandRaised(false);
  };

  const handleTriggerReaction = (emoji: string) => {
    sounds.playClick();
    const newReaction: ReactionParticle = {
      id: Math.random().toString(),
      emoji,
      x: 20 + Math.random() * 60,
    };
    setReactions((curr) => [...curr.slice(-15), newReaction]);
    setTimeout(() => {
      setReactions((curr) => curr.filter((r) => r.id !== newReaction.id));
    }, 2000);
  };

  const handleCreateLounge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    sounds.playMatchFound();
    const created: RoomItem = {
      id: Math.random().toString(),
      title: newTitle.trim(),
      topic: newTopic,
      description: newDesc.trim() || 'Welcome to our voice hangout!',
      maxParticipants: 15,
      currentParticipants: 1,
      tags: newTag ? newTag.split(',').map((t) => t.trim()) : [newTopic.toLowerCase()],
    };

    setRooms([created, ...rooms]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewTag('');
    handleJoinStage(created);
  };

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' ||
      r.topic.toLowerCase().includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 sm:pb-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-300 mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Community Voice Lounges</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Explore Topic Lounges</h1>
          <p className="text-sm text-gray-400 mt-1">
            Drop into moderated small-group voice stages by topic and passion.
          </p>
        </div>

        <button
          onClick={() => {
            sounds.playClick();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Host a Lounge</span>
        </button>
      </div>

      {/* Floating Reaction Emojis Container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 1, y: '80vh', x: `${r.x}vw`, scale: 0.8 }}
            animate={{ opacity: 0, y: '20vh', scale: 1.6 }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
            className="absolute text-4xl"
          >
            {r.emoji}
          </motion.div>
        ))}
      </div>

      {/* Active Stage Live View (If connected) */}
      <AnimatePresence>
        {activeStage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-panel-glow rounded-3xl p-5 sm:p-7 border border-cyan-500/40 relative overflow-hidden space-y-6"
          >
            {/* Top Stage Info Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase">
                      Live Stage
                    </span>
                    <span className="text-xs text-gray-400">{activeStage.room.topic}</span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-0.5">{activeStage.room.title}</h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLeaveStage}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition-all active:scale-95"
                >
                  Leave Stage
                </button>
              </div>
            </div>

            {/* Speakers Stage (Center Avatars) */}
            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Speakers On Stage (3)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Host User */}
                <div className="p-4 rounded-2xl bg-surfaceLight/80 border border-secondary/40 flex flex-col items-center text-center space-y-2 relative shadow-lg shadow-secondary/5">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-surface border-2 border-secondary overflow-hidden flex items-center justify-center ring-4 ring-secondary/20 animate-pulse">
                      <img
                        src={getDicebearAvatarUrl(user?.username || 'Host')}
                        alt="You"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-secondary text-black text-[9px] font-bold shadow">
                      🎙️
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center justify-center gap-1">
                      <span>{user?.username || 'You'}</span>
                      <span className="text-[10px] text-secondary font-normal">(Host)</span>
                    </p>
                    <span className="text-[10px] text-emerald-400 font-mono">Speaking...</span>
                  </div>
                </div>

                {/* Co-Speaker 1 */}
                <div className="p-4 rounded-2xl bg-surfaceLight/40 border border-white/10 flex flex-col items-center text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-surface border border-white/20 overflow-hidden flex items-center justify-center">
                    <img
                      src={getDicebearAvatarUrl('Alex_Chill')}
                      alt="Alex"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Alex</p>
                    <span className="text-[10px] text-gray-400 font-mono">Listening</span>
                  </div>
                </div>

                {/* Co-Speaker 2 */}
                <div className="p-4 rounded-2xl bg-surfaceLight/40 border border-white/10 flex flex-col items-center text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-surface border border-white/20 overflow-hidden flex items-center justify-center">
                    <img
                      src={getDicebearAvatarUrl('Maya_Night')}
                      alt="Maya"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Maya</p>
                    <span className="text-[10px] text-gray-400 font-mono">Listening</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audience Section */}
            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Audience &amp; Listeners ({activeStage.room.currentParticipants + 4})
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {['Jordan', 'Sam', 'Taylor', 'Casey', 'Riley', 'Morgan'].map((name) => (
                  <div
                    key={name}
                    className="px-3 py-1.5 rounded-xl bg-surfaceLight/60 border border-white/5 flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10">
                      <img
                        src={getDicebearAvatarUrl(name)}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-xs text-gray-300">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage Controls & Reaction Toolbar */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sounds.playClick();
                    setIsStageMuted(!isStageMuted);
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    isStageMuted
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-primary/20 border-primary/40 text-white'
                  }`}
                >
                  {isStageMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isStageMuted ? 'Muted' : 'Unmuted'}</span>
                </button>

                <button
                  onClick={() => {
                    sounds.playClick();
                    setIsHandRaised(!isHandRaised);
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    isHandRaised
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-surfaceLight hover:bg-white/10 text-gray-300 border-white/10'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>{isHandRaised ? 'Hand Raised ✋' : 'Raise Hand'}</span>
                </button>
              </div>

              {/* Floating Reaction Emojis Bar */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surfaceLight/80 border border-white/10">
                {[
                  { emoji: '🔥', label: 'Fire' },
                  { emoji: '👏', label: 'Clap' },
                  { emoji: '❤️', label: 'Love' },
                  { emoji: '💡', label: 'Idea' },
                  { emoji: '🚀', label: 'Rocket' },
                ].map((item) => (
                  <button
                    key={item.emoji}
                    onClick={() => handleTriggerReaction(item.emoji)}
                    className="w-8 h-8 rounded-xl hover:bg-white/15 flex items-center justify-center text-base transition-transform active:scale-125"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Topic Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                sounds.playClick();
                setSelectedCategory(cat);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-white shadow-md shadow-primary/25 font-bold'
                  : 'bg-surfaceLight hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lounges or #tags..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surfaceLight border border-white/10 text-white text-xs placeholder:text-gray-500 focus:border-secondary outline-none transition-colors"
          />
        </div>
      </div>

      {/* Lounges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => {
          const isCurrentActive = activeStage?.room.id === room.id;

          return (
            <div
              key={room.id}
              className={`glass-card rounded-3xl p-6 flex flex-col justify-between border transition-all group ${
                isCurrentActive
                  ? 'border-cyan-500/60 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                  : 'border-white/10 hover:border-primary/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-hover border border-primary/30 text-xs font-semibold">
                    {room.topic}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {room.currentParticipants}/{room.maxParticipants}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {room.title}
                </h3>
                <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                  {room.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {room.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-lg bg-surfaceLight border border-white/5 text-[10px] text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Join Action */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] text-emerald-400 font-medium">Stage Active</span>
                </div>

                <button
                  onClick={() => handleJoinStage(room)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                    isCurrentActive
                      ? 'bg-cyan-500 text-black shadow-cyan-500/25'
                      : 'bg-gradient-to-r from-primary to-secondary text-white shadow-primary/20 hover:scale-105'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isCurrentActive ? 'On Stage' : 'Join Stage'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Host a Lounge Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md glass-panel-glow border border-primary/40 rounded-3xl p-6 shadow-2xl bg-surface/95 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 flex items-center justify-center shadow-md">
                    <Radio className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Host a Community Lounge</h3>
                    <p className="text-[11px] text-gray-400">Open a live group voice stage</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateLounge} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Lounge Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Midnight Lo-Fi & Philosophy"
                    className="w-full p-3 rounded-xl bg-surfaceLight border border-white/10 text-white text-xs placeholder:text-gray-500 focus:border-secondary outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Category Topic
                  </label>
                  <select
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surfaceLight border border-white/10 text-white text-xs focus:border-secondary outline-none"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c} className="bg-slate-900 text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="What is this lounge about?"
                    className="w-full p-3 rounded-xl bg-surfaceLight border border-white/10 text-white text-xs placeholder:text-gray-500 focus:border-secondary outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="chill, tech, music"
                    className="w-full p-3 rounded-xl bg-surfaceLight border border-white/10 text-white text-xs placeholder:text-gray-500 focus:border-secondary outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-surfaceLight text-gray-300 text-xs font-semibold hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    Launch Stage
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
