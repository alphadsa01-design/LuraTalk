'use client';

import React, { useEffect, useState } from 'react';
import { fetchTodayTopic, DailyTopic } from '@/lib/api';
import { useUserStore } from '@/stores/useUserStore';

/**
 * Topic of the day card for the landing page. Opting in makes matchmaking prefer
 * people who chose the same topic; it never blocks matching with anyone else.
 */
export default function TopicOfTheDay() {
  const [topic, setTopic] = useState<DailyTopic | null>(null);
  const topicOptInId = useUserStore((s) => s.topicOptInId);
  const updatePreferences = useUserStore((s) => s.updatePreferences);

  useEffect(() => {
    let cancelled = false;
    fetchTodayTopic().then((t) => {
      if (!cancelled) setTopic(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely if the API is unreachable: no broken card on the landing page
  if (!topic) return null;

  const optedIn = topicOptInId === topic.id;
  const toggle = () => updatePreferences({ topicOptInId: optedIn ? null : topic.id });

  return (
    <section
      aria-labelledby="topic-of-the-day-title"
      className="mt-8 w-full max-w-md p-4 sm:p-5 rounded-2xl bg-zinc-950/60 border border-white/10 text-left"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Topic of the day</p>
      <h2 id="topic-of-the-day-title" className="mt-1 text-base font-bold text-white flex items-center gap-2">
        <span aria-hidden="true">{topic.emoji}</span>
        {topic.title}
      </h2>
      <p className="mt-1 text-sm text-neutral-400">{topic.prompt}</p>

      <label className="mt-4 flex items-center justify-between gap-4 cursor-pointer select-none">
        <span className="text-sm text-neutral-200">Match me with people on this topic</span>
        <button
          type="button"
          role="switch"
          aria-checked={optedIn}
          onClick={toggle}
          className={`relative shrink-0 w-11 h-6 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
            optedIn ? 'bg-white border-white' : 'bg-zinc-800 border-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full transition-transform motion-reduce:transition-none ${
              optedIn ? 'translate-x-5 bg-black' : 'translate-x-0 bg-neutral-400'
            }`}
          />
        </button>
      </label>
    </section>
  );
}
