'use client';

import React, { useState } from 'react';
import { ShieldAlert, UserX, AlertTriangle, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface SafetyModalProps {
  isOpen: boolean;
  peerName: string;
  onClose: () => void;
  onBlock: () => void;
  onReport: (reason: string, description: string) => void;
}

export default function SafetyModal({
  isOpen,
  peerName,
  onClose,
  onBlock,
  onReport,
}: SafetyModalProps) {
  const [tab, setTab] = useState<'block' | 'report'>('report');
  const [reason, setReason] = useState('harassment');
  const [description, setDescription] = useState('');
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReport(reason, description);
    setIsDone(true);
    setTimeout(() => {
      setIsDone(false);
      onClose();
    }, 1500);
  };

  const handleBlockConfirm = () => {
    onBlock();
    setIsDone(true);
    setTimeout(() => {
      setIsDone(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass-panel-glow rounded-3xl p-6 border border-rose-500/30 relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Trust & Safety Actions</h3>
              <p className="text-xs text-gray-400">Action against: {peerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isDone ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Action Taken</h4>
            <p className="text-xs text-gray-400 mt-1">
              Your safety request was processed. You are disconnected immediately.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-transparent border border-white/10 mb-4">
              <button
                onClick={() => setTab('report')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all bg-transparent ${
                  tab === 'report' ? 'border border-rose-400 text-rose-300' : 'text-gray-400 hover:text-white'
                }`}
              >
                Report User
              </button>
              <button
                onClick={() => setTab('block')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all bg-transparent ${
                  tab === 'block' ? 'border border-rose-400 text-rose-300' : 'text-gray-400 hover:text-white'
                }`}
              >
                Block User
              </button>
            </div>

            {tab === 'report' ? (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Reason for report
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-surfaceLight border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="harassment">Harassment / Bullying</option>
                    <option value="hate_speech">Hate Speech / Toxicity</option>
                    <option value="inappropriate_audio">Inappropriate Audio / Noise</option>
                    <option value="spam">Spam / Advertising</option>
                    <option value="scam">Scam / Phishing</option>
                    <option value="other">Other Violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Additional Context (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide brief details for our safety moderators..."
                    className="w-full bg-surfaceLight border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-transparent hover:bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:border-rose-400 text-xs font-bold transition-all"
                  >
                    Submit Report &amp; Disconnect
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-transparent border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                  <p>
                    Blocking will immediately end this call and prevent either of you from ever
                    matching again in random chat or topic rooms.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/30"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBlockConfirm}
                    className="px-4 py-2 rounded-xl bg-transparent hover:bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:border-rose-400 text-xs font-bold transition-all"
                  >
                    Block User Permanently
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
