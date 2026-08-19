'use client';

import React from 'react';
import { Languages, Globe, Check } from 'lucide-react';

interface TranslationBarProps {
  isEnabled: boolean;
  onToggle: () => void;
  targetLang: string;
  onSelectLang: (lang: string) => void;
  currentCaption: string | null;
}

export default function TranslationBar({
  isEnabled,
  onToggle,
  targetLang,
  onSelectLang,
  currentCaption,
}: TranslationBarProps) {
  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'ja', name: 'Japanese' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'hi', name: 'Hindi' },
    { code: 'zh', name: 'Mandarin' },
    { code: 'en', name: 'English' },
  ];

  return (
    <div className="w-full glass-panel rounded-2xl p-3 border border-white/10 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Real-Time Neural Translation</h4>
            <p className="text-[10px] text-gray-400">Live bilingual speech & text captions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEnabled && (
            <select
              value={targetLang}
              onChange={(e) => onSelectLang(e.target.value)}
              className="bg-surfaceLight border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-secondary"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  Translate to {l.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={onToggle}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
              isEnabled
                ? 'bg-secondary/20 text-secondary border-secondary/40'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {isEnabled ? 'Active' : 'Turn On'}
          </button>
        </div>
      </div>

      {isEnabled && currentCaption && (
        <div className="mt-1 bg-black/40 border border-cyan-500/30 rounded-xl p-2.5 text-xs text-cyan-300 animate-pulse">
          <span className="font-semibold text-secondary mr-1">Live Subtitle:</span>
          <span>{currentCaption}</span>
        </div>
      )}
    </div>
  );
}
