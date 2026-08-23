'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Lock,
  MessageSquare,
  Smile,
  Globe,
  CheckCheck,
} from 'lucide-react';
import { ChatMessage } from '@/stores/useCallStore';
import { getDicebearAvatarUrl } from '@/stores/useUserStore';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  peerUsername?: string;
  peerId?: string;
  peerAvatarId?: string;
  peerMood?: string;
  isPeerTyping: boolean;
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onClose?: () => void;
}

const QUICK_EMOJIS = ['👋', '🔥', '😂', '✨', '🎮', '❤️', '🙌', '💯', '🚀', '💡'];

const ICEBREAKER_PROMPTS = [
  'What is your favorite travel destination? ✈️',
  'What music are you listening to lately? 🎵',
  'Coffee or tea person? ☕',
  'What is the best movie you have seen? 🎬',
  'If you had one superpower, what would it be? 🦸',
];

export default function ChatPanel({
  messages,
  currentUserId,
  peerUsername = 'Partner',
  peerId,
  peerAvatarId = 'Felix',
  peerMood,
  isPeerTyping,
  onSendMessage,
  onTyping,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handlePromptClick = (prompt: string) => {
    onSendMessage(prompt);
  };

  const isPureEmoji = (text: string) => {
    const trimmed = text.trim();
    return /^(\p{Extended_Pictographic}|\s)+$/u.test(trimmed) && trimmed.length <= 12;
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0C14]/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl shadow-purple-950/40 overflow-hidden text-white select-text">
      {/* 1. Header with Partner Profile & Privacy Badge */}
      <div className="px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={getDicebearAvatarUrl(peerAvatarId || peerUsername)}
              alt={peerUsername}
              className="w-9 h-9 rounded-full bg-surfaceLight border border-white/20 object-cover shadow-sm"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0A0C14] shadow-sm shadow-emerald-400/50" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">
                {peerUsername}
              </span>
              {peerMood && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary-light font-medium capitalize">
                  {peerMood}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected & Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-medium text-emerald-400 shadow-inner">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Encrypted</span>
        </div>
      </div>

      {/* 2. Messages Viewport */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2.5 scrollbar-none">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary/20 via-secondary/20 to-pink-500/20 border border-white/10 flex items-center justify-center mb-3 shadow-lg shadow-primary/10">
              <Sparkles className="w-6 h-6 text-primary-light animate-pulse" />
            </div>
            <h4 className="text-sm font-semibold text-white">Break the ice!</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              Send a quick message or tap one of the conversation starters below.
            </p>

            {/* Quick Conversation Starter Pills */}
            <div className="mt-4 flex flex-col gap-2 w-full max-w-sm">
              {ICEBREAKER_PROMPTS.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full text-left px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-primary/40 text-xs text-gray-300 hover:text-white transition-all transform active:scale-[0.98] shadow-sm flex items-center justify-between group"
                >
                  <span className="truncate">{prompt}</span>
                  <Send className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe =
              msg.senderId === 'me' ||
              (Boolean(currentUserId) && msg.senderId === currentUserId) ||
              (Boolean(peerId) && msg.senderId !== peerId && msg.senderId !== 'peer');
            const displayName = isMe ? 'You' : msg.senderName || peerUsername;

            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isFirstInGroup =
              !prevMsg ||
              prevMsg.senderId !== msg.senderId ||
              Math.abs(msg.timestamp - prevMsg.timestamp) > 60000;

            const emojiOnly = isPureEmoji(msg.content);

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
                  isFirstInGroup ? 'mt-3.5' : 'mt-1'
                }`}
              >
                {isFirstInGroup && (
                  <div className="flex items-center gap-1.5 mb-1 px-1.5">
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        isMe ? 'text-purple-300' : 'text-cyan-300'
                      }`}
                    >
                      {displayName}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">
                      {(() => {
                        try {
                          return new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        } catch {
                          return 'Just now';
                        }
                      })()}
                    </span>
                  </div>
                )}

                {emojiOnly ? (
                  <div
                    className={`text-3xl sm:text-4xl py-1 px-2 select-none transform transition-transform hover:scale-125 duration-150 ${
                      isMe ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={`relative max-w-[82%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow-lg ${
                      isMe
                        ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-primary text-white rounded-br-sm border border-purple-400/20 shadow-purple-900/30'
                        : 'bg-white/[0.07] text-gray-100 border border-white/10 rounded-bl-sm shadow-black/40'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.isTranslated && msg.translatedContent && (
                      <div className="mt-2 pt-2 border-t border-white/15 text-[11px] text-cyan-200 italic flex items-start gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{msg.translatedContent}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {/* 3. iMessage-Style Animated Typing Indicator */}
        <AnimatePresence>
          {isPeerTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-2 pt-1 pl-1"
            >
              <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-white/[0.08] border border-white/10 rounded-bl-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
              </div>
              <span className="text-[10px] text-gray-400 italic">
                {peerUsername} is typing...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Reaction Floating Emoji Bar */}
      <div className="px-3 py-1.5 border-t border-white/[0.06] bg-white/[0.015] flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendMessage(emoji)}
              type="button"
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-sm transition-transform hover:scale-125 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Modern Pill Input Bar with Glowing Focus */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 bg-[#070910]/80 flex items-center gap-2"
      >
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              onTyping();
            }}
            placeholder="Type your message..."
            maxLength={1000}
            className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!input.trim()}
          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center transition-all shadow-md shadow-primary/25 disabled:opacity-40 disabled:scale-95 active:scale-90 hover:opacity-90 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
