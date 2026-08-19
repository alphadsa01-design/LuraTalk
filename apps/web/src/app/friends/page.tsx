'use client';

import React, { useEffect, useState } from 'react';
import { Users, Radio, Trash2, Plus, Brain, Sparkles, UserCheck, PhoneCall, UserMinus } from 'lucide-react';
import { fetchFriends, fetchMemories, saveMemory, deleteMemory, removeFriend, getOrCreateAnonymousSession } from '@/lib/api';
import { useUserStore, getDicebearAvatarUrl } from '@/stores/useUserStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FriendItem {
  id: string;
  friend: {
    id: string;
    username: string;
    avatarId: string;
    countryCode?: string;
    mood: string;
    intention: string;
    interests: string[];
    bio?: string;
  };
  isOnline: boolean;
}

interface MemoryItem {
  id: string;
  topicSummary: string;
  createdAt: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const { token, user, setAuth } = useUserStore();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async (activeToken: string) => {
    try {
      const list = await fetchFriends(activeToken);
      setFriends(list || []);
      if (list && list.length > 0) {
        setSelectedFriend(list[0]);
        loadFriendMemories(list[0].friend.id, activeToken);
      } else {
        setSelectedFriend(null);
        setMemories([]);
      }
    } catch (err) {
      console.error('Failed to load friends', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function initSessionAndFriends() {
      let activeToken = token;
      if (!activeToken) {
        try {
          const authData = await getOrCreateAnonymousSession();
          setAuth(authData.token, authData.user);
          activeToken = authData.token;
        } catch (err) {
          console.error('Failed to get session for friends', err);
          setLoading(false);
          return;
        }
      }
      if (activeToken) {
        await loadData(activeToken);
      }
    }
    initSessionAndFriends();
  }, [token]);

  const loadFriendMemories = async (friendId: string, activeToken?: string) => {
    const t = activeToken || token;
    if (!t) return;
    try {
      const data = await fetchMemories(t, friendId);
      setMemories(data || []);
    } catch (err) {
      console.error('Failed to load memories', err);
    }
  };

  const handleSelectFriend = (friend: FriendItem) => {
    setSelectedFriend(friend);
    loadFriendMemories(friend.friend.id);
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      await removeFriend(token, friendId);
      const updatedFriends = friends.filter((f) => f.friend.id !== friendId);
      setFriends(updatedFriends);
      if (selectedFriend?.friend.id === friendId) {
        const nextFriend = updatedFriends.length > 0 ? updatedFriends[0] : null;
        setSelectedFriend(nextFriend);
        if (nextFriend) {
          loadFriendMemories(nextFriend.friend.id);
        } else {
          setMemories([]);
        }
      }
    } catch (err) {
      console.error('Failed to remove friend', err);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedFriend || !newMemory.trim()) return;
    try {
      const saved = await saveMemory(token, selectedFriend.friend.id, newMemory.trim());
      setMemories([saved, ...memories]);
      setNewMemory('');
    } catch (err) {
      console.error('Failed to save memory', err);
    }
  };

  const handleDeleteMemory = async (memId: string) => {
    if (!token) return;
    try {
      await deleteMemory(token, memId);
      setMemories(memories.filter((m) => m.id !== memId));
    } catch (err) {
      console.error('Failed to delete memory', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 sm:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-indigo-300 mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Persistent Friendships</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Friends & Conversation Memory</h1>
          <p className="text-sm text-gray-400 mt-1">
            Reconnect with people you've connected with during voice calls.
          </p>
        </div>

        <Link
          href="/match?mode=voice"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all self-start"
        >
          <Radio className="w-4 h-4" />
          <span>Find New People</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Friends List Column */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Your Friends ({friends.length})
            </h3>
            <span className="text-[11px] text-gray-500">
              {friends.filter((f) => f.isOnline).length} Online
            </span>
          </div>

          {friends.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center border border-white/10 space-y-3">
              <span className="text-4xl block">🤝</span>
              <h4 className="text-base font-bold text-white">No Friends Yet</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                Friendships in LuraTalk are made naturally during calls! While talking to someone in random match, click <strong>"Add Friend"</strong> to connect.
              </p>
              <Link
                href="/match?mode=voice"
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surfaceLight border border-white/10 hover:border-primary/40 text-xs font-semibold text-white transition-all"
              >
                <Radio className="w-3.5 h-3.5 text-primary" />
                <span>Start Matching</span>
              </Link>
            </div>
          ) : (
            friends.map((item) => {
              const isSelected = selectedFriend?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectFriend(item)}
                  className={`p-3.5 sm:p-4 rounded-2xl glass-card flex items-center justify-between cursor-pointer border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/15 shadow-lg shadow-primary/10'
                      : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-surfaceLight border border-white/15 overflow-hidden flex items-center justify-center shadow-inner">
                        <img
                          src={getDicebearAvatarUrl(item.friend.avatarId || item.friend.username)}
                          alt={item.friend.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                          item.isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.friend.username}</h4>
                      <p className="text-[11px] text-gray-400">
                        {item.isOnline ? 'Online' : 'Offline'} • {item.friend.mood || 'Chill'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/match?mode=voice&callPartnerId=${item.friend.id}&partnerName=${encodeURIComponent(
                            item.friend.username
                          )}`
                        );
                      }}
                      className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-primary/20 hover:bg-primary text-secondary hover:text-white border border-primary/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      title="Direct Call Friend"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Call</span>
                    </button>
                    <span className="text-xs text-gray-500">→</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Friend & Memories Column */}
        <div className="lg:col-span-7">
          {selectedFriend ? (
            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
              {/* Friend Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surfaceLight border border-white/15 overflow-hidden flex items-center justify-center shadow-inner">
                    <img
                      src={getDicebearAvatarUrl(selectedFriend.friend.avatarId || selectedFriend.friend.username)}
                      alt={selectedFriend.friend.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white">
                        {selectedFriend.friend.username}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        Mutual Friend
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedFriend.friend.bio || 'Connected in voice call'} • {selectedFriend.friend.intention || 'Casual'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveFriend(selectedFriend.friend.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surfaceLight hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-white/10 text-xs font-semibold transition-all"
                    title="Remove Friend"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Unfriend</span>
                  </button>

                  <button
                    onClick={() =>
                      router.push(
                        `/match?mode=voice&callPartnerId=${selectedFriend.friend.id}&partnerName=${encodeURIComponent(
                          selectedFriend.friend.username
                        )}`
                      )
                    }
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-md shadow-primary/20 hover:scale-105 transition-transform"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Friend</span>
                  </button>
                </div>
              </div>

              {/* Conversation Memories Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Conversation Memory ("What we talked about")
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Private notes for this friend from your calls. Fully editable and deletable by you.
                    </p>
                  </div>
                </div>

                {/* Add new memory prompt */}
                <form onSubmit={handleAddMemory} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="e.g. Recommended the sci-fi movie Arrival, plays guitar..."
                    className="flex-1 bg-surfaceLight border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-secondary"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-primary/25 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </button>
                </form>

                {/* Memory list */}
                <div className="space-y-2.5">
                  {memories.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-surfaceLight/50 border border-white/5 text-center text-xs text-gray-400">
                      No memories recorded yet. Add notes to remember fun topics from your calls!
                    </div>
                  ) : (
                    memories.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-3.5 rounded-2xl bg-surfaceLight border border-white/5 flex items-center justify-between group hover:border-white/15 transition-all"
                      >
                        <div className="flex items-start gap-2.5">
                          <Sparkles className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-200 font-medium">{mem.topicSummary}</p>
                            <span className="text-[10px] text-gray-500">
                              {(() => {
                                try {
                                  return new Date(mem.createdAt).toLocaleDateString();
                                } catch {
                                  return 'Recent';
                                }
                              })()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMemory(mem.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-12 text-center border border-white/10 text-gray-400 text-sm">
              Select a friend to view conversation memories and direct call actions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
