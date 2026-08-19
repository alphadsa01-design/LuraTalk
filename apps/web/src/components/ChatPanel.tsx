'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/stores/useCallStore';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  isPeerTyping: boolean;
  onSendMessage: (content: string) => void;
  onTyping: () => void;
}

export default function ChatPanel({
  messages,
  currentUserId,
  isPeerTyping,
  onSendMessage,
  onTyping,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickEmojis = ['👋', '🔥', '😂', '✨', '🎮', '❤️', '🙌', '💯'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-3xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-secondary" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            In-Call Text Channel
          </span>
        </div>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Encrypted
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs px-4">
            <Sparkles className="w-8 h-8 text-primary mb-2 opacity-50" />
            <p className="font-medium text-gray-300">Start the conversation!</p>
            <p className="text-[11px] mt-1 text-gray-500">
              Send a text message or pick an icebreaker suggestion.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              msg.senderId === currentUserId ||
              msg.senderId === 'me' ||
              msg.senderName === 'You' ||
              (currentUserId && msg.senderId === currentUserId);
            const displayName = isMe ? 'You' : msg.senderName || 'Peer';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className={`text-[10px] font-semibold ${isMe ? 'text-indigo-300' : 'text-gray-400'}`}>
                    {displayName}
                  </span>
                  <span className="text-[9px] text-gray-500">
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

                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-normal leading-relaxed ${
                    isMe
                      ? 'bg-gradient-to-tr from-primary to-primary-hover text-white rounded-br-none shadow-md shadow-primary/20'
                      : 'bg-surfaceLight text-gray-100 border border-white/10 rounded-bl-none'
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.isTranslated && msg.translatedContent && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[11px] text-cyan-300 italic">
                      🌐 {msg.translatedContent}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-gray-400 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
            <span>Peer is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick emoji bar */}
      <div className="px-3 py-1.5 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto bg-black/20">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendMessage(emoji)}
            className="px-2 py-1 rounded-lg hover:bg-white/10 text-sm transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onTyping();
          }}
          placeholder="Type a message..."
          className="flex-1 bg-surfaceLight border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
