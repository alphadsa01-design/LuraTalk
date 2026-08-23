'use client';

import React from 'react';
import { Bot, Sparkles, RefreshCw, Send, X, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface AIWidgetProps {
  suggestion: string | null;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onSendToChat: (text: string) => void;
}

export default function AIWidget({
  suggestion,
  isEnabled,
  onToggleEnabled,
  onSendToChat,
}: AIWidgetProps) {
  if (!isEnabled) {
    return (
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-surface/60 border border-white/5 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <EyeOff className="w-3.5 h-3.5" />
          <span>AI Conversation Assistant Disabled</span>
        </div>
        <button
          onClick={onToggleEnabled}
          className="text-primary hover:underline text-xs font-medium"
        >
          Enable
        </button>
      </div>
    );
  }

  if (!suggestion) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-3.5 border border-primary/30 relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-primary to-accent-pink text-white shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              Quiet AI Icebreaker
            </span>
          </div>
        </div>

        <button
          onClick={onToggleEnabled}
          title="Turn off AI assistance"
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="mt-2 text-xs sm:text-sm text-gray-200 font-medium leading-snug">
        "{suggestion}"
      </p>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={() => onSendToChat(suggestion)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 transition-colors"
        >
          <Send className="w-3 h-3 text-secondary" />
          <span>Send as Topic</span>
        </button>
      </div>
    </motion.div>
  );
}
