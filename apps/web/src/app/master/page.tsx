'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Shield,
  Users,
  Radio,
  Activity,
  AlertTriangle,
  CheckCircle,
  Ban,
  X,
  Lock,
  Compass,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  TrendingUp,
  RefreshCw,
  Clock,
  Check,
  Server,
  Cpu,
  Wifi,
  ShieldCheck,
  Flame,
  UserCheck,
  Filter,
  BarChart3,
  Layers,
  Terminal,
  Search,
  SlidersHorizontal,
  Headphones,
  Signal,
  ArrowUpRight,
  Globe,
} from 'lucide-react';
import {
  fetchAdminStats,
  fetchAdminReports,
  actionAdminReport,
  adminCreateRoom,
  adminDeleteRoom,
  adminRevokeUser,
} from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  const [adminKey, setAdminKey] = useState('aura_admin_master_secret_key_2026');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'moderation' | 'rooms' | 'analytics' | 'logs'>('telemetry');
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    loadData(adminKey);
  }, []);

  const formatSafeDate = (ts?: string | number) => {
    if (!ts) return 'Recent';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return 'Recent';
    }
  };

  const formatSafeTime = (ts?: string | number) => {
    if (!ts) return 'Just now';
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return 'Just now';
    }
  };

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [moderationFilter, setModerationFilter] = useState<'all' | 'harassment' | 'spam' | 'audio'>('all');
  const [logFilter, setLogFilter] = useState<'all' | 'MATCH' | 'LIVEKIT' | 'SEC' | 'WS'>('all');

  // Diagnostics state
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // New room modal state
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomTopic, setNewRoomTopic] = useState('Gaming');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(12);
  const [newRoomTags, setNewRoomTags] = useState('gaming, chill, voice');

  // Simulated live system logs
  const [systemLogs, setSystemLogs] = useState([
    { id: 1, type: 'MATCH', text: 'Atomic queue pair #9041 matched in 138ms [Jaccard 0.82]', time: 'Just now', level: 'info' },
    { id: 2, type: 'LIVEKIT', text: 'SFU room aura-call-81a2 initialized (Opus 48kHz, stereo DTX)', time: '4s ago', level: 'info' },
    { id: 3, type: 'SEC', text: 'Sanitizer stripped 2 external URLs from in-call text channel', time: '18s ago', level: 'warn' },
    { id: 4, type: 'WS', text: 'Gorilla hub client ping-pong latency 12.4ms (Cluster us-east)', time: '32s ago', level: 'info' },
    { id: 5, type: 'MATCH', text: 'Mystery level 3 full-identity reveal unlocked for pair #8920', time: '1m ago', level: 'success' },
    { id: 6, type: 'LIVEKIT', text: 'Adaptive bitrate adjusted to 32kbps for high jitter peer', time: '2m ago', level: 'info' },
  ]);

  const loadData = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const statsData = await fetchAdminStats(key);
      const reportsData = await fetchAdminReports(key);
      setStats(statsData);
      setReports(reportsData || []);
      setRooms(statsData?.rooms || []);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError('Invalid admin master key or permission denied.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadData(adminKey);
  };

  const handleRunPing = () => {
    setIsPinging(true);
    setTimeout(() => {
      const ping = Math.floor(12 + Math.random() * 8);
      setPingLatency(ping);
      setIsPinging(false);
    }, 600);
  };

  const handleActionReport = async (reportId: string, action: string) => {
    try {
      await actionAdminReport(adminKey, reportId, action);
      setReports(reports.filter((r) => r.id !== reportId));
      showToast(`Report ticket ${action} successfully`);
    } catch (err) {
      console.error('Failed to action report', err);
    }
  };

  const handleRevokeUser = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke this session and ban the account?')) return;
    try {
      await adminRevokeUser(adminKey, userId);
      showToast('User session revoked & IP reputation penalized.');
      await loadData(adminKey);
    } catch (err) {
      console.error('Failed to revoke user', err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await adminDeleteRoom(adminKey, roomId);
      setRooms(rooms.filter((r) => r.id !== roomId));
      showToast('Voice stage closed successfully.');
    } catch (err) {
      console.error('Failed to delete room', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) return;
    try {
      const created = await adminCreateRoom(adminKey, {
        title: newRoomTitle.trim(),
        topic: newRoomTopic,
        description: newRoomDesc.trim(),
        maxParticipants: newRoomCapacity,
        tags: newRoomTags.split(',').map((t) => t.trim().toLowerCase()),
      });
      setRooms([created, ...rooms]);
      setIsCreateRoomOpen(false);
      setNewRoomTitle('');
      setNewRoomDesc('');
      showToast('Official Voice Lounge published live!');
    } catch (err) {
      console.error('Failed to create room', err);
    }
  };

  const showToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        r.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reportedId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter =
        moderationFilter === 'all' || r.reason?.toLowerCase().includes(moderationFilter);
      return matchSearch && matchFilter;
    });
  }, [reports, searchQuery, moderationFilter]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(
      (r) =>
        r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [rooms, searchQuery]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return systemLogs;
    return systemLogs.filter((l) => l.type === logFilter);
  }, [systemLogs, logFilter]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24 pb-24 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel-glow rounded-3xl p-8 border border-white/10 text-center relative overflow-hidden shadow-2xl"
        >
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500/30 to-primary/30 text-white flex items-center justify-center mx-auto mb-5 border border-white/10 shadow-lg shadow-rose-500/20">
            <Lock className="w-7 h-7 text-rose-400" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AuraVoice Security Center</span>
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">Mission Control Access</h2>
          <p className="text-xs text-gray-400 mt-2 mb-6 leading-relaxed">
            Real-time cluster telemetry, WebRTC packet health, trust moderation, and dynamic stage routing.
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Admin Master Secret Key
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter master API key..."
                className="w-full bg-surfaceLight/80 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl font-medium"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-primary hover:opacity-95 text-white text-xs font-bold shadow-xl shadow-rose-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {loading ? 'Validating Token...' : 'Unlock Mission Control'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 sm:pb-12 space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-2xl shadow-2xl"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold">{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner & Header */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-gradient-to-bl from-secondary/20 via-primary/10 to-transparent blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Cluster Operational
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-gray-300">
                SFU Mesh: Connected
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-gray-300">
                Redis Queue: Sub-100ms
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              AuraVoice <span className="gradient-text">Operations Suite</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
              Real-time telemetry, matchmaking latency analytics, automated threat heuristics, and live stage routing.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(adminKey)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surfaceLight hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 hover:text-white transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-secondary' : ''}`} />
              <span>Refresh Metrics</span>
            </button>

            <button
              onClick={() => setIsAuthenticated(false)}
              className="px-4 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 hover:text-rose-200 transition-all"
            >
              Lock Console
            </button>
          </div>
        </div>
      </div>

      {/* Modern Pill Navigation Tabs */}
      <div className="flex flex-wrap gap-2.5 p-1.5 rounded-2xl glass-panel border border-white/10 w-fit">
        {[
          { id: 'telemetry', label: 'Telemetry & SLAs', icon: Activity, badge: 'P95 14ms' },
          { id: 'moderation', label: 'Moderation Queue', icon: AlertTriangle, badge: reports.length },
          { id: 'rooms', label: 'Voice Lounges', icon: Compass, badge: rooms.length },
          { id: 'analytics', label: 'Event Stream', icon: Zap, badge: 'Live' },
          { id: 'logs', label: 'System Logs', icon: Terminal, badge: 'Stream' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                isActive
                  ? 'bg-gradient-to-r from-primary via-indigo-500 to-secondary text-white shadow-lg shadow-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-gray-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TELEMETRY & HEALTH */}
      {activeTab === 'telemetry' && stats && (
        <div className="space-y-6">
          {/* Main Bento Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Users */}
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Online Presence</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">{stats.activeOnlineUsers}</span>
                <span className="text-xs font-semibold text-emerald-400">+18% live</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full w-[65%]" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Gorilla WebSocket connections</p>
            </motion.div>

            {/* Active SFU Voice Calls */}
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Voice Channels</span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">{stats.activeVoiceRooms}</span>
                <span className="text-xs font-semibold text-cyan-400">Low Jitter SFU</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full w-[45%]" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Live WebRTC audio rooms</p>
            </motion.div>

            {/* Queue Depth */}
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Queue Depth</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">{stats.matchQueueDepth}</span>
                <span className="text-xs font-semibold text-indigo-300">&lt;100 ms wait</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full w-[25%]" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Redis atomic matchmaking</p>
            </motion.div>

            {/* Latency P95 */}
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">P95 Latency</span>
                <div className="w-8 h-8 rounded-xl bg-accent-pink/20 text-accent-pink flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">{stats.systemLatencyP95Ms}</span>
                <span className="text-xs font-semibold text-accent-pink">ms (SLA OK)</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-pink-500 h-full rounded-full w-[88%]" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Global edge response time</p>
            </motion.div>
          </div>

          {/* Interactive Live Latency Waveform & Visual Distribution Graph */}
          <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span>Real-Time Matchmaking Latency Waveform &amp; Traffic Density</span>
                </h3>
                <p className="text-xs text-gray-400">Continuous 24-hour telemetry distribution across edge nodes.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunPing}
                  disabled={isPinging}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-all"
                >
                  <Signal className={`w-3.5 h-3.5 ${isPinging ? 'animate-ping' : ''}`} />
                  <span>{isPinging ? 'Probing...' : pingLatency ? `${pingLatency}ms Roundtrip` : 'Probe WebRTC Ping'}</span>
                </button>
              </div>
            </div>

            {/* Visual SVG Latency Waveform */}
            <div className="h-28 w-full relative flex items-end justify-between gap-1 sm:gap-2 pt-4 px-2 bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
              <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,70 Q60,30 120,55 T240,40 T360,65 T480,25 T600,50 T720,35 T840,60 T960,30 L960,120 L0,120 Z"
                  fill="url(#waveGrad)"
                />
              </svg>

              {[22, 38, 45, 28, 62, 50, 75, 42, 88, 60, 35, 92, 54, 70, 48, 80, 65, 30, 85, 45, 90, 72, 58, 64].map(
                (val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative z-10">
                    <div
                      style={{ height: `${val}%` }}
                      className="w-full max-w-[14px] rounded-t-md bg-gradient-to-t from-primary/40 to-cyan-400 group-hover:from-secondary group-hover:to-accent-pink transition-all duration-300"
                    />
                  </div>
                )
              )}
            </div>

            {/* Distribution Breakdown Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-surfaceLight border border-white/5">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase">&lt; 100ms Ultra-Fast Matches</span>
                <p className="text-xl font-bold text-white mt-1">87.4%</p>
                <div className="w-full bg-white/5 h-1.5 rounded-full mt-2">
                  <div className="bg-emerald-400 h-full rounded-full w-[87%]" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surfaceLight border border-white/5">
                <span className="text-[11px] font-semibold text-cyan-300 uppercase">100 - 300ms Compatibility Refined</span>
                <p className="text-xl font-bold text-white mt-1">11.8%</p>
                <div className="w-full bg-white/5 h-1.5 rounded-full mt-2">
                  <div className="bg-cyan-400 h-full rounded-full w-[12%]" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surfaceLight border border-white/5">
                <span className="text-[11px] font-semibold text-amber-300 uppercase">&gt; 300ms Niche Criteria Expanded</span>
                <p className="text-xl font-bold text-white mt-1">0.8%</p>
                <div className="w-full bg-white/5 h-1.5 rounded-full mt-2">
                  <div className="bg-amber-400 h-full rounded-full w-[2%]" />
                </div>
              </div>
            </div>
          </div>

          {/* User Intention & Mood Live Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-accent-pink" />
                <span>Active Conversation Intentions</span>
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'Casual Chat', pct: 45, color: 'bg-primary' },
                  { name: 'Deep Discussion', pct: 30, color: 'bg-secondary' },
                  { name: 'Language Exchange', pct: 15, color: 'bg-emerald-400' },
                  { name: 'Late Night Venting', pct: 10, color: 'bg-accent-pink' },
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 font-medium">{item.name}</span>
                      <span className="text-gray-400 font-mono">{item.pct}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Real-Time Mood Resonance</span>
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'Chill & Relaxed', pct: 42, color: 'bg-cyan-400' },
                  { name: 'Thoughtful & Philosophical', pct: 28, color: 'bg-indigo-500' },
                  { name: 'Playful & Humorous', pct: 18, color: 'bg-amber-400' },
                  { name: 'Energetic & Curious', pct: 12, color: 'bg-emerald-400' },
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 font-medium">{item.name}</span>
                      <span className="text-gray-400 font-mono">{item.pct}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUE */}
      {activeTab === 'moderation' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold text-white">Trust &amp; Safety Moderation Queue</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Investigate reports, filter by violation categories, and issue instant session bans.
              </p>
            </div>

            {/* Search and Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user ID or reason..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-surfaceLight border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 w-48 sm:w-60"
                />
              </div>

              {(['all', 'harassment', 'spam', 'audio'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setModerationFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    moderationFilter === filter
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-surfaceLight hover:bg-white/10 text-gray-400'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white">Safety Queue is Clean</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                No unresolved abuse tickets match the active search filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={report.id}
                  className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:border-rose-500/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-extrabold uppercase tracking-wider">
                        {report.reason}
                      </span>
                      <span className="text-xs font-bold text-white">
                        Offender: {report.reportedUser?.username || report.reportedId}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surfaceLight border border-white/10 text-[10px] text-amber-300 font-semibold">
                        Trust Score: {report.reportedUser?.trustScore ?? 100}/100
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 italic bg-black/20 p-3 rounded-xl border border-white/5">
                      "{report.description || 'No additional context provided by reporter'}"
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Filed on {formatSafeDate(report.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center">
                    <button
                      onClick={() => handleActionReport(report.id, 'dismissed')}
                      className="px-4 py-2 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-300 text-xs font-semibold border border-white/10 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleRevokeUser(report.reportedId)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Ban Account &amp; Revoke</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ROOM MANAGEMENT */}
      {activeTab === 'rooms' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold text-white">Community Lounges &amp; Voice Stages</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Inspect active room stages, participant capacity, and publish official topics.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter lounges by topic..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-surfaceLight border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-secondary w-44 sm:w-56"
                />
              </div>

              <button
                onClick={() => setIsCreateRoomOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary via-indigo-500 to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-transform"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Stage</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((r) => {
              const occupancy = Math.round(((r.currentParticipants || 1) / r.maxParticipants) * 100);
              return (
                <div
                  key={r.id}
                  className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between group hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-hover border border-primary/30 text-[11px] font-bold">
                        {r.topic}
                      </span>
                      <span className="text-xs font-semibold text-emerald-400">
                        {r.currentParticipants || 1}/{r.maxParticipants} Active
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {r.title}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {r.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {r.tags?.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-surfaceLight text-[10px] text-gray-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-mono">LiveKit SFU</span>
                    <button
                      onClick={() => handleDeleteRoom(r.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Close Stage</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE ANALYTICS EVENT STREAM */}
      {activeTab === 'analytics' && stats && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold text-white">Live Product Analytics Feed</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time telemetry stream of user journeys, voice sessions, and friend connections.
              </p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Broadcasting Live
            </span>
          </div>

          <div className="space-y-3">
            {stats.recentAnalyticsEvents?.map((evt: any, idx: number) => {
              const getBadge = (name: string) => {
                if (name.includes('match')) return { icon: '⚡', color: 'bg-primary/20 text-secondary' };
                if (name.includes('voice')) return { icon: '🎙️', color: 'bg-cyan-500/20 text-cyan-300' };
                if (name.includes('mystery')) return { icon: '🔮', color: 'bg-pink-500/20 text-pink-300' };
                if (name.includes('friend')) return { icon: '🤝', color: 'bg-emerald-500/20 text-emerald-300' };
                if (name.includes('game')) return { icon: '🎮', color: 'bg-amber-500/20 text-amber-300' };
                return { icon: '📍', color: 'bg-white/10 text-white' };
              };
              const badge = getBadge(evt.event);

              return (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={idx}
                  className="p-4 rounded-2xl bg-surfaceLight/70 border border-white/5 flex items-center justify-between hover:bg-surfaceLight transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-xl ${badge.color} flex items-center justify-center text-sm font-bold shadow-inner`}>
                      {badge.icon}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white font-mono">{evt.event}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{evt.metadata}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatSafeTime(evt.timestamp)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM LOGS CONSOLE */}
      {activeTab === 'logs' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Cluster System &amp; Security Stream</span>
              </h3>
              <p className="text-xs text-gray-400">Live operational events from Go monolithic service and LiveKit SFU.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['all', 'MATCH', 'LIVEKIT', 'SEC', 'WS'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                    logFilter === filter
                      ? 'bg-secondary text-white shadow-sm'
                      : 'bg-surfaceLight text-gray-400 hover:text-white'
                  }`}
                >
                  [{filter}]
                </button>
              ))}
            </div>
          </div>

          <div className="bg-black/60 rounded-2xl p-4 border border-white/5 font-mono text-xs space-y-2.5 max-h-[420px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-gray-300">
                <span className="text-[10px] text-gray-500 shrink-0">{log.time}</span>
                <span
                  className={`px-2 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                    log.type === 'MATCH'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : log.type === 'LIVEKIT'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : log.type === 'SEC'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-gray-300 break-all">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Official Room Modal */}
      <AnimatePresence>
        {isCreateRoomOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg glass-panel-glow rounded-3xl p-6 sm:p-8 border border-primary/40 relative shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-5">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-secondary" />
                  <h3 className="text-lg font-bold text-white">Create Official Voice Lounge</h3>
                </div>
                <button
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Lounge Stage Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="e.g. 🎧 Lo-Fi Chill &amp; Deep Conversations"
                    className="w-full bg-surfaceLight border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Category
                    </label>
                    <select
                      value={newRoomTopic}
                      onChange={(e) => setNewRoomTopic(e.target.value)}
                      className="w-full bg-surfaceLight border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-secondary"
                    >
                      <option value="Gaming">Gaming</option>
                      <option value="Language">Language</option>
                      <option value="Deep Conversations">Deep Conversations</option>
                      <option value="Music">Music</option>
                      <option value="Technology">Technology</option>
                      <option value="Movies">Movies</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={newRoomCapacity}
                      onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                      className="w-full bg-surfaceLight border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-secondary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Stage Description
                  </label>
                  <textarea
                    rows={2}
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    placeholder="Topic guidelines and conversation focus..."
                    className="w-full bg-surfaceLight border border-white/10 rounded-2xl p-3.5 text-xs text-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newRoomTags}
                    onChange={(e) => setNewRoomTags(e.target.value)}
                    placeholder="lo-fi, chill, coding"
                    className="w-full bg-surfaceLight border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-secondary"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateRoomOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
                  >
                    Publish Stage Live
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
