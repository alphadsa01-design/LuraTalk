'use client';

import React, { useEffect, useState } from 'react';
import { Users, Radio, Trash2, Plus, Brain, Sparkles, UserCheck, PhoneCall, UserMinus, UserPlus, Clock, Check, X } from 'lucide-react';
import { fetchFriends, fetchMemories, saveMemory, deleteMemory, removeFriend, acceptFriendRequest, addFriend, getOrCreateAnonymousSession } from '@/lib/api';
import {
  getLocalFriends,
  saveLocalFriend,
  acceptLocalFriendRequest,
  removeLocalFriend,
  getLocalMemories,
  saveLocalMemory,
  deleteLocalMemory,
} from '@/lib/storage';
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
  status: 'accepted' | 'pending';
  isOnline: boolean;
  isIncoming?: boolean;
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
  const [searchUsername, setSearchUsername] = useState('');
  const [addFriendStatus, setAddFriendStatus] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async (activeToken: string) => {
    // 1. Initial fast local storage sync
    const localFriends = getLocalFriends();
    if (localFriends && localFriends.length > 0 && friends.length === 0) {
      setFriends(localFriends as FriendItem[]);
      const acceptedList = localFriends.filter((f) => f.status === 'accepted');
      if (acceptedList.length > 0) {
        setSelectedFriend(acceptedList[0] as FriendItem);
        const localMems = getLocalMemories(acceptedList[0].friend.id);
        setMemories(localMems);
      }
    }

    try {
      const list = await fetchFriends(activeToken);
      // Merge remote list with local cache
      const mergedMap = new Map<string, FriendItem>();
      (list || []).forEach((f: FriendItem) => {
        mergedMap.set(f.friend?.id || f.id, f);
        saveLocalFriend(f as any);
      });
      localFriends.forEach((lf) => {
        const id = lf.friend?.id || lf.id;
        if (!mergedMap.has(id)) {
          mergedMap.set(id, lf as FriendItem);
        }
      });
      const finalList = Array.from(mergedMap.values());
      setFriends(finalList);

      const acceptedList = finalList.filter((f) => f.status === 'accepted');
      if (acceptedList.length > 0) {
        setSelectedFriend((prev) => {
          if (prev && acceptedList.some((f) => f.friend.id === prev.friend.id)) {
            return prev;
          }
          return acceptedList[0];
        });
        loadFriendMemories(acceptedList[0].friend.id, activeToken);
      } else {
        setSelectedFriend(null);
        setMemories([]);
      }
    } catch (err) {
      console.warn('Using client cached friends list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Instant local render
    const cached = getLocalFriends();
    if (cached && cached.length > 0) {
      setFriends(cached as FriendItem[]);
      const accepted = cached.filter((f) => f.status === 'accepted');
      if (accepted.length > 0) {
        setSelectedFriend(accepted[0] as FriendItem);
        setMemories(getLocalMemories(accepted[0].friend.id));
      }
      setLoading(false);
    }

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
    // Read local memories first
    const localMems = getLocalMemories(friendId);
    setMemories(localMems);

    const t = activeToken || token;
    if (!t) return;
    try {
      const remote = await fetchMemories(t, friendId);
      if (remote && remote.length > 0) {
        setMemories(remote);
      }
    } catch (err) {
      console.warn('Loaded memories from client storage', err);
    }
  };

  const handleSelectFriend = (friend: FriendItem) => {
    setSelectedFriend(friend);
    loadFriendMemories(friend.friend.id);
  };

  const handleAcceptRequest = async (friendId: string) => {
    acceptLocalFriendRequest(friendId);
    setFriends((prev) =>
      prev.map((f) =>
        f.friend.id === friendId || f.id === friendId
          ? { ...f, status: 'accepted' as const, isIncoming: false }
          : f
      )
    );
    if (!token) return;
    try {
      await acceptFriendRequest(token, friendId);
      await loadData(token);
    } catch (err) {
      console.warn('Accepted locally; sync failed', err);
    }
  };

  const handleDeclineRequest = async (friendId: string) => {
    removeLocalFriend(friendId);
    setFriends((prev) => prev.filter((f) => f.friend.id !== friendId && f.id !== friendId));
    if (!token) return;
    try {
      await removeFriend(token, friendId);
    } catch (err) {
      console.warn('Declined locally; sync failed', err);
    }
  };

  const handleAddFriendByUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !searchUsername.trim()) return;
    setIsAddingFriend(true);
    setAddFriendStatus(null);
    try {
      await addFriend(token, searchUsername.trim());
      setAddFriendStatus('Friend request sent!');
      setSearchUsername('');
      await loadData(token);
      setTimeout(() => setAddFriendStatus(null), 3000);
    } catch (err: any) {
      setAddFriendStatus(err?.message || 'User not found');
      setTimeout(() => setAddFriendStatus(null), 3000);
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    removeLocalFriend(friendId);
    const updatedFriends = friends.filter((f) => f.friend.id !== friendId && f.id !== friendId);
    setFriends(updatedFriends);

    if (selectedFriend?.friend.id === friendId) {
      const nextFriend = updatedFriends.find((f) => f.status === 'accepted') || null;
      setSelectedFriend(nextFriend);
      if (nextFriend) {
        loadFriendMemories(nextFriend.friend.id);
      } else {
        setMemories([]);
      }
    }

    if (token) {
      removeFriend(token, friendId).catch(() => {});
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !newMemory.trim()) return;
    const friendId = selectedFriend.friend.id;
    const localSaved = saveLocalMemory(friendId, newMemory.trim());
    setMemories([localSaved, ...memories]);
    setNewMemory('');

    if (token) {
      saveMemory(token, friendId, newMemory.trim()).catch(() => {});
    }
  };

  const handleDeleteMemory = async (memId: string) => {
    deleteLocalMemory(memId);
    setMemories(memories.filter((m) => m.id !== memId));
    if (token) {
      deleteMemory(token, memId).catch(() => {});
    }
  };

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const incomingRequests = friends.filter((f) => f.status === 'pending' && f.isIncoming);
  const outgoingRequests = friends.filter((f) => f.status === 'pending' && !f.isIncoming);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 sm:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary-light mb-2">
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all self-start"
        >
          <Radio className="w-4 h-4" />
          <span>Find New People</span>
        </Link>
      </div>

      {/* Pending Incoming Friend Requests Banner */}
      {incomingRequests.length > 0 && (
        <div className="mb-8 p-4 sm:p-5 rounded-2xl glass-panel-glow border border-primary/40 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-light uppercase tracking-wider">
              <UserPlus className="w-4 h-4" />
              <span>Incoming Friend Requests ({incomingRequests.length})</span>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surfaceLight/80 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surfaceLight border border-white/15 overflow-hidden flex items-center justify-center">
                    <img
                      src={getDicebearAvatarUrl(req.friend.avatarId || req.friend.username)}
                      alt={req.friend.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{req.friend.username}</h4>
                    <p className="text-[11px] text-gray-400">
                      {req.isOnline ? '🟢 Online' : 'Offline'} • Sent you a request
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptRequest(req.friend.id)}
                    className="px-3 py-1.5 rounded-xl gradient-bg text-white text-xs font-bold shadow-md shadow-primary/25 hover:scale-105 transition-all flex items-center gap-1 active:scale-95"
                    title="Accept Request"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(req.friend.id)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 transition-colors"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Friends List Column */}
        <div className="lg:col-span-5 space-y-4">
          {/* Add Friend by Username Input */}
          <form onSubmit={handleAddFriendByUsername} className="flex gap-2">
            <input
              type="text"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              placeholder="Add friend by username..."
              className="flex-1 bg-surfaceLight border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={isAddingFriend || !searchUsername.trim()}
              className="px-3.5 py-2 rounded-xl bg-primary/20 hover:bg-primary border border-primary/30 text-primary-light hover:text-white text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
          {addFriendStatus && (
            <p className="text-[11px] font-medium text-primary-light px-1">{addFriendStatus}</p>
          )}

          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Your Friends ({acceptedFriends.length})
            </h3>
            <span className="text-[11px] text-gray-500">
              {acceptedFriends.filter((f) => f.isOnline).length} Online
            </span>
          </div>

          {acceptedFriends.length === 0 ? (
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
            acceptedFriends.map((item) => {
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
                        {item.isOnline ? '🟢 Online' : 'Offline'} • {item.friend.mood || 'Chill'}
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

          {/* Outgoing Pending Requests indicator if any */}
          {outgoingRequests.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <Clock className="w-3 h-3" />
                <span>Sent Requests ({outgoingRequests.length})</span>
              </div>
              {outgoingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surfaceLight/40 border border-white/5 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-surfaceLight">
                      <img src={getDicebearAvatarUrl(req.friend.avatarId || req.friend.username)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-semibold text-gray-300">{req.friend.username}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 italic">Pending...</span>
                </div>
              ))}
            </div>
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
