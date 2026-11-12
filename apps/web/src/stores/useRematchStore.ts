import { create } from 'zustand';

export interface RematchPeer {
  id: string;
  username: string;
  avatarId?: string;
}

export type RematchPhase = 'ask' | 'waiting' | 'mutual';

interface RematchState {
  peer: RematchPeer | null;
  phase: RematchPhase;
  /** Ask "Talk again?" about the person you just talked to. */
  offer: (peer: RematchPeer) => void;
  setPhase: (phase: RematchPhase) => void;
  /** Show the "It's a match!" celebration (may arrive after the prompt was dismissed). */
  celebrate: (peer: RematchPeer) => void;
  dismiss: () => void;
}

export const useRematchStore = create<RematchState>((set) => ({
  peer: null,
  phase: 'ask',
  offer: (peer) => set({ peer, phase: 'ask' }),
  setPhase: (phase) => set({ phase }),
  celebrate: (peer) => set({ peer, phase: 'mutual' }),
  dismiss: () => set({ peer: null, phase: 'ask' }),
}));

/** Calls shorter than this never ask "Talk again?" (quick skips aren't a signal). */
export const REMATCH_MIN_CALL_SECONDS = 20;

/**
 * Offer the "Talk again?" prompt for a call that just ended, if it qualifies:
 * a random (non-friend) match that lasted long enough.
 */
export function offerRematchForEndedCall(
  peer: { id: string; username: string; avatarId?: string } | null | undefined,
  roomName: string | null | undefined,
  callDurationSeconds: number,
  alreadyRequestedFriend: boolean
) {
  if (!peer?.id || alreadyRequestedFriend) return;
  // Direct calls are between people who already know each other
  if (!roomName || roomName.startsWith('direct_')) return;
  if (callDurationSeconds < REMATCH_MIN_CALL_SECONDS) return;
  useRematchStore.getState().offer({ id: peer.id, username: peer.username, avatarId: peer.avatarId });
}
