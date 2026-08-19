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
import { fetchTopicRooms, createTopicRoom, fetchRoomToken, getOrCreateAnonymousSession } from '@/lib/api';
import { useUserStore, getDicebearAvatarUrl } from '@/stores/useUserStore';
import { socketClient } from '@/lib/socket';
import { webrtcEngine } from '@/lib/webrtc';
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

interface StagePeer {
  id: string;
  username: string;
  avatarId?: string;
  isMuted?: boolean;
  isSpeaking?: boolean;
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
  const [activeStage, setActiveStage] = useState<{ room: RoomItem; token: string; roomName: string } | null>(null);
  const [stagePeers, setStagePeers] = useState<StagePeer[]>([]);
  const [isStageMuted, setIsStageMuted] = useState(false);
  const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);
  const [isPeerSpeaking, setIsPeerSpeaking] = useState(false);
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

  // Sync mute state with WebRTC audio engine
  useEffect(() => {
    webrtcEngine.setMuted(isStageMuted);
  }, [isStageMuted]);

  // Auto-resume audio context when entering stage
  useEffect(() => {
    if (activeStage) {
      webrtcEngine.resumeAudio();
      const resume = () => webrtcEngine.resumeAudio();
      window.addEventListener('click', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
      return () => {
        window.removeEventListener('click', resume);
        window.removeEventListener('touchstart', resume);
      };
    }
  }, [activeStage]);

  // Listen to WebSocket lounge events continuously on mount
  useEffect(() => {
    const unsubPeers = socketClient.on('lounge:peers', (data: { roomName: string; peers: StagePeer[] }) => {
      console.log('[Lounge] Received stage peers:', data);
      if (data?.peers) {
        setStagePeers(data.peers);
        if (data.peers.length > 0) {
          // Initiate WebRTC call with existing peers in the lounge
          webrtcEngine.startCall({
            isInitiator: true,
            onSpeakingChange: (speaking) => setIsSelfSpeaking(speaking),
            onPeerSpeakingChange: (speaking) => setIsPeerSpeaking(speaking),
            onError: (err) => console.warn('[Lounge] WebRTC call error:', err),
          });
        }
      }
    });

    const unsubPeerJoined = socketClient.on('lounge:peer_joined', (peer: StagePeer) => {
      console.log('[Lounge] New peer joined stage:', peer);
      if (!peer || !peer.id) return;
      sounds.playMatchFound();
      setStagePeers((prev) => {
        if (prev.some((p) => p.id === peer.id)) return prev;
        return [...prev, peer];
      });

      // Answer incoming WebRTC call from new joining peer
      webrtcEngine.startCall({
        isInitiator: false,
        onSpeakingChange: (speaking) => setIsSelfSpeaking(speaking),
        onPeerSpeakingChange: (speaking) => setIsPeerSpeaking(speaking),
        onError: (err) => console.warn('[Lounge] WebRTC call error:', err),
      });
    });

    const unsubPeerLeft = socketClient.on('lounge:peer_left', (data: { userId: string; username: string }) => {
      console.log('[Lounge] Peer left stage:', data);
      if (!data?.userId) return;
      setStagePeers((prev) => {
        const remaining = prev.filter((p) => p.id !== data.userId);
        if (remaining.length === 0) {
          webrtcEngine.cleanup();
        }
        return remaining;
      });
    });

    const unsubReaction = socketClient.on('lounge:reaction', (data: { emoji: string; userId: string; username: string }) => {
      if (!data?.emoji) return;
      const newReaction: ReactionParticle = {
        id: Math.random().toString(),
        emoji: data.emoji,
        x: 20 + Math.random() * 60,
      };
      setReactions((curr) => [...curr.slice(-15), newReaction]);
      setTimeout(() => {
        setReactions((curr) => curr.filter((r) => r.id !== newReaction.id));
      }, 2000);
    });

    return () => {
      unsubPeers();
      unsubPeerJoined();
      unsubPeerLeft();
      unsubReaction();
    };
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

    const roomName = `lounge_${room.id.slice(0, 8)}`;
    setActiveStage({ room, token: 'connecting', roomName });
    setIsHandRaised(false);
    setStagePeers([]);

    // Pre-warm microphone for instant stage voice
    webrtcEngine.warmupMicrophone().catch(() => {});

    socketClient.connect(activeToken);
    socketClient.joinLounge(room.id, roomName);

    try {
      const stageData = await fetchRoomToken(activeToken, room.id);
      setActiveStage({ room, token: stageData.livekitToken || 'live', roomName: stageData.roomName || roomName });
    } catch (err) {
      console.warn('Failed to fetch stage livekit token, using realtime fallback', err);
    }
  };

  const handleLeaveStage = () => {
    sounds.playEndCall();
    webrtcEngine.cleanup();
    socketClient.leaveLounge();
    setActiveStage(null);
    setStagePeers([]);
    setIsHandRaised(false);
    setIsSelfSpeaking(false);
    setIsPeerSpeaking(false);
  };

  const handleTriggerReaction = (emoji: string) => {
    sounds.playClick();
    socketClient.sendLoungeReaction(emoji);
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

  const handleCreateLounge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    sounds.playMatchFound();
    let activeToken = token;
    if (!activeToken) {
      try {
        const authData = await getOrCreateAnonymousSession();
        setAuth(authData.token, authData.user);
        activeToken = authData.token;
      } catch (err) {
        console.error('Failed to authenticate for creating lounge', err);
      }
    }

    const payload = {
      title: newTitle.trim(),
      topic: newTopic,
      description: newDesc.trim() || 'Welcome to our voice hangout!',
      maxParticipants: 15,
      tags: newTag ? newTag.split(',').map((t) => t.trim()) : [newTopic.toLowerCase()],
    };

    try {
      if (activeToken) {
        const dbRoom = await createTopicRoom(activeToken, payload);
        setRooms((prev) => [dbRoom, ...prev]);
        handleJoinStage(dbRoom);
      } else {
        const localRoom: RoomItem = {
          id: Math.random().toString(),
          ...payload,
          currentParticipants: 1,
        };
        setRooms((prev) => [localRoom, ...prev]);
        handleJoinStage(localRoom);
      }
    } catch (err) {
      console.warn('Fallback to local lounge creation', err);
      const fallbackRoom: RoomItem = {
        id: Math.random().toString(),
        ...payload,
        currentParticipants: 1,
      };
      setRooms((prev) => [fallbackRoom, ...prev]);
      handleJoinStage(fallbackRoom);
    }

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewTag('');
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

            {/* Speakers Stage (Real Dynamic Avatars) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Live Speakers On Stage ({stagePeers.length + 1})
                </h4>
                <button
                  onClick={() => {
                    sounds.playClick();
                    if (typeof navigator !== 'undefined') {
                      navigator.clipboard?.writeText(window.location.href);
                    }
                    alert('Lounge link copied to clipboard!');
                  }}
                  className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-all flex items-center gap-1 active:scale-95"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Share Lounge</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Active Current User on Stage */}
                <div className="p-4 rounded-2xl bg-surfaceLight/80 border border-secondary/40 flex flex-col items-center text-center space-y-2 relative shadow-lg shadow-secondary/5">
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full bg-surface border-2 transition-all duration-200 ${
                      isStageMuted
                        ? 'border-gray-500 opacity-80'
                        : isSelfSpeaking
                        ? 'border-emerald-400 ring-4 ring-emerald-400/50 scale-105 shadow-lg shadow-emerald-500/20'
                        : 'border-secondary ring-2 ring-secondary/20'
                    } overflow-hidden flex items-center justify-center`}>
                      <img
                        src={getDicebearAvatarUrl(user?.avatarId || user?.username || 'Host')}
                        alt="You"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className={`absolute -bottom-1 -right-1 p-1 rounded-full text-[9px] font-bold shadow ${isStageMuted ? 'bg-rose-500 text-white' : isSelfSpeaking ? 'bg-emerald-400 text-black animate-bounce' : 'bg-secondary text-black'}`}>
                      {isStageMuted ? '🔇' : '🎙️'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center justify-center gap-1">
                      <span className="truncate max-w-[90px]">{user?.username || 'You'}</span>
                      <span className="text-[10px] text-secondary font-normal">(You)</span>
                    </p>
                    <span className={`text-[10px] font-mono font-medium ${
                      isStageMuted
                        ? 'text-gray-400'
                        : isSelfSpeaking
                        ? 'text-emerald-400 animate-pulse font-bold'
                        : 'text-emerald-300/80'
                    }`}>
                      {isStageMuted ? 'Muted' : isSelfSpeaking ? 'Speaking...' : 'Mic Ready'}
                    </span>
                  </div>
                </div>

                {/* Real Connected Peers on Stage */}
                {stagePeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="p-4 rounded-2xl bg-surfaceLight/60 border border-cyan-500/30 flex flex-col items-center text-center space-y-2 relative shadow-lg animate-fadeIn"
                  >
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-full bg-surface border-2 transition-all duration-200 ${
                        isPeerSpeaking
                          ? 'border-cyan-400 ring-4 ring-cyan-400/50 scale-105 shadow-lg shadow-cyan-500/25'
                          : 'border-cyan-400/80 ring-2 ring-cyan-400/20'
                      } overflow-hidden flex items-center justify-center`}>
                        <img
                          src={getDicebearAvatarUrl(peer.avatarId || peer.username)}
                          alt={peer.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 p-1 rounded-full text-[9px] font-bold shadow ${isPeerSpeaking ? 'bg-cyan-300 text-black animate-bounce' : 'bg-cyan-500 text-black'}`}>
                        🎙️
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[100px]">{peer.username}</p>
                      <span className={`text-[10px] font-mono ${isPeerSpeaking ? 'text-cyan-300 font-bold animate-pulse' : 'text-gray-400'}`}>
                        {isPeerSpeaking ? 'Speaking...' : 'Listening'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Invite Card if only 1 user */}
                {stagePeers.length === 0 && (
                  <div className="col-span-1 sm:col-span-3 p-4 rounded-2xl bg-surfaceLight/30 border border-dashed border-white/20 flex flex-col justify-center items-center text-center space-y-2">
                    <p className="text-xs font-semibold text-gray-200">
                      You are on stage! Waiting for others to join...
                    </p>
                    <p className="text-[11px] text-gray-400 max-w-sm">
                      Share this lounge link with a friend or open it in a second tab to talk in real-time.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Room Info & Live Topic Tags */}
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-gray-300 font-medium">
                  {activeStage.room.description}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeStage.room.tags?.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-400 font-mono">
                    #{tag}
                  </span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredRooms.map((room) => {
          const isCurrentActive = activeStage?.room.id === room.id;

          return (
            <div
              key={room.id}
              className={`rounded-3xl p-5 sm:p-6 glass-card border transition-all duration-300 flex flex-col justify-between space-y-4 ${
                isCurrentActive
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-xl shadow-cyan-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                    {room.topic}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {room.currentParticipants}/{room.maxParticipants}
                    </span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{room.title}</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">
                  {room.description}
                </p>

                {/* Tag Pills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(room.tags || []).slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white/5 text-gray-400 text-[10px] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Enter Stage Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleJoinStage(room)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    isCurrentActive
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25 animate-pulse'
                      : 'bg-surfaceLight hover:bg-white/10 text-white border border-white/10'
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
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto glass-panel-glow border border-primary/40 rounded-3xl p-5 sm:p-6 shadow-2xl bg-surface/95 space-y-5"
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
