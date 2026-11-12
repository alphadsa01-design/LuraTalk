'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, X, Users } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { socketClient } from '@/lib/socket';
import { sounds } from '@/lib/sounds';
import { getDicebearAvatarUrl } from '@/stores/useUserStore';
import { useRematchStore, RematchPeer } from '@/stores/useRematchStore';

const ASK_TIMEOUT_MS = 20_000;
const WAITING_HIDE_MS = 2_500;

/**
 * "Talk again?" — shown after a random call ends. Each person votes privately;
 * only a mutual ❤️ creates a friendship, so nobody ever sees a one-sided "no".
 */
export default function RematchPrompt() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { peer, phase, setPhase, celebrate, dismiss } = useRematchStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server tells us when both sides liked each other (can arrive at any time)
  useEffect(() => {
    const unsubMutual = socketClient.on('rematch:mutual', (data: { peer?: RematchPeer }) => {
      if (!data?.peer?.id) return;
      sounds.playMatchFound();
      celebrate(data.peer);
    });
    return () => unsubMutual();
  }, [celebrate]);

  // Auto-dismiss: the question expires, "waiting" fades out, the celebration stays a bit longer
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!peer) return;
    const delay = phase === 'ask' ? ASK_TIMEOUT_MS : phase === 'waiting' ? WAITING_HIDE_MS : 8_000;
    timerRef.current = setTimeout(() => dismiss(), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [peer, phase, dismiss]);

  if (!peer) return null;

  const vote = (liked: boolean) => {
    sounds.playClick();
    socketClient.send('rematch:vote', { peerId: peer.id, liked });
    if (liked) {
      setPhase('waiting');
    } else {
      dismiss();
    }
  };

  const avatarSrc = getDicebearAvatarUrl(peer.avatarId || peer.username);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-0 z-[60] pointer-events-none flex justify-center px-4 md:pb-6"
        role="dialog"
        aria-live="polite"
        aria-label={phase === 'mutual' ? 'New friend' : 'Talk again?'}
      >
        <motion.div
          key={phase}
          initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-surface/95 backdrop-blur-xl shadow-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-background/80 border border-white/10">
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              {phase === 'ask' && (
                <>
                  <p className="text-sm font-semibold text-white">Talk to {peer.username} again?</p>
                  <p className="text-xs text-gray-400">They'll only know if you both say yes.</p>
                </>
              )}
              {phase === 'waiting' && (
                <>
                  <p className="text-sm font-semibold text-white">Saved</p>
                  <p className="text-xs text-gray-400">If {peer.username} feels the same, you'll be connected.</p>
                </>
              )}
              {phase === 'mutual' && (
                <>
                  <p className="text-sm font-semibold text-white">You both want to talk again</p>
                  <p className="text-xs text-gray-400">{peer.username} is now in your friends.</p>
                </>
              )}
            </div>

            {phase === 'ask' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => vote(false)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/15 text-gray-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 transition-colors"
                  title="Skip"
                  aria-label={`Skip ${peer.username}`}
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => vote(true)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-rose-500 text-white hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 transition-colors"
                  title="Talk again"
                  aria-label={`Talk to ${peer.username} again`}
                >
                  <Heart className="w-5 h-5 fill-current" />
                </button>
              </div>
            )}

          </div>

          {phase === 'mutual' && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  dismiss();
                  router.push('/friends');
                }}
                className="flex-1 h-11 px-4 flex items-center justify-center gap-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 transition-colors"
              >
                <Users className="w-4 h-4" />
                View friends
              </button>
              <button
                onClick={dismiss}
                className="h-11 px-4 rounded-xl border border-white/15 text-sm font-semibold text-neutral-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
