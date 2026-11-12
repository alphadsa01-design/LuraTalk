'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, X, RefreshCw, CheckCircle2, Sparkles, Trophy, MessageCircleQuestion } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore, launchGame, GameType } from '@/stores/useGameStore';
import {
  generateAIDarkQuestion,
  generateAIWYRCard,
  getNextCuratedDarkQuestion,
  getNextCuratedWYRCard,
  ALL_DARK_QUESTIONS,
  ALL_WYR_CARDS,
} from '@/lib/aiQuestions';
import { sounds } from '@/lib/sounds';

interface GameOverlayProps {
  currentUserId?: string;
  peerName?: string;
  isInitiator?: boolean;
  onSendAction: (actionType: string, gameType: GameType, data?: any) => void;
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winningLine(board: string[]): number[] | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return combo;
  }
  return null;
}

/** Must match the server's allowed reactions (services/api/internal/games/engine.go). */
const REACTION_EMOJIS = ['🔥', '😂', '😱', '🤔', '🤯', '❤️'];

const TABS: { id: GameType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'tictactoe', label: 'Tic-Tac-Toe', icon: Gamepad2 },
  { id: 'dark_questions', label: 'Questions', icon: MessageCircleQuestion },
  { id: 'would_you_rather', label: 'Would You', icon: Sparkles },
];

const btnBase =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-50';
const btnSecondary = `${btnBase} border border-white/25 text-white hover:bg-white/10`;
const btnPrimary = `${btnBase} bg-white text-black hover:bg-neutral-200`;

export default function GameOverlay({
  currentUserId = '',
  peerName = 'Partner',
  isInitiator = true,
  onSendAction,
}: GameOverlayProps) {
  const { isOpen, gameType, board, players, turn, status, winner, customData, scores, closeGame } = useGameStore();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const reduceMotion = useReducedMotion();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const me = currentUserId || 'me';

  // Keyboard: Escape closes; focus moves into the dialog when it opens
  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGame();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [isOpen, closeGame]);

  if (!isOpen) return null;

  const activeQuestion = customData?.question || ALL_DARK_QUESTIONS[0];
  const activeCard = customData?.card || ALL_WYR_CARDS[0];

  // --- Tic-Tac-Toe: the server assigns symbols and turns; fall back to call roles until it answers ---
  const symbols: Record<string, string> = customData?.symbols || {};
  const mySymbol = (symbols[me] as 'X' | 'O') || (isInitiator ? 'X' : 'O');
  const peerSymbol = mySymbol === 'X' ? 'O' : 'X';
  const filled = board.filter((c) => c !== '').length;
  const isMyTurn =
    status === 'in_progress' && (turn ? turn === me : (filled % 2 === 0 ? 'X' : 'O') === mySymbol);
  const line = winningLine(board);
  const iWon = status === 'won' && (winner === me || (!!line && board[line[0]] === mySymbol));
  const peerId = players.find((p) => p !== me);
  const myScore = scores?.[me] ?? 0;
  const peerScore = peerId ? scores?.[peerId] ?? 0 : 0;

  const send = (action: string, type: GameType, data?: any) => onSendAction(action, type, data);

  const handleMove = (idx: number) => {
    if (!isMyTurn || board[idx] !== '') return;
    sounds.playClick();
    const next = [...board];
    next[idx] = mySymbol;
    // Optimistic: show the move and hand the turn over; the server's update is authoritative
    useGameStore.setState({ board: next, turn: peerId || null });
    send('move', 'tictactoe', { cell: idx });
  };

  const handleReset = () => {
    sounds.playClick();
    useGameStore.setState({ board: Array(9).fill(''), status: 'in_progress', winner: null });
    send('reset', 'tictactoe');
  };

  // --- Questions ---
  const showQuestion = (question: any) => {
    useGameStore.setState({ customData: { ...customData, question, reactions: {} }, status: 'in_progress' });
    send('next', 'dark_questions', { question });
  };
  const handleNextQuestion = () => {
    sounds.playClick();
    showQuestion(getNextCuratedDarkQuestion());
  };
  const handleAIQuestion = async () => {
    sounds.playClick();
    setIsGeneratingAI(true);
    try {
      showQuestion(await generateAIDarkQuestion());
    } finally {
      setIsGeneratingAI(false);
    }
  };
  const handleReact = (emoji: string) => {
    sounds.playClick();
    useGameStore.setState({ customData: { ...customData, reactions: { ...(customData?.reactions || {}), [me]: emoji } } });
    send('react', 'dark_questions', { reaction: emoji });
  };

  // --- Would You Rather ---
  const votes: Record<string, string> = customData?.votes || {};
  const myVote = votes[me];
  const peerVote = peerId ? votes[peerId] : undefined;
  const revealed = status === 'completed' && !!myVote && !!peerVote;

  const handleVote = (option: 'optionA' | 'optionB') => {
    if (status === 'completed') return;
    sounds.playClick();
    useGameStore.setState({ customData: { ...customData, votes: { ...votes, [me]: option } } });
    send('vote', 'would_you_rather', { option });
  };
  const showCard = (card: any) => {
    useGameStore.setState({ customData: { ...customData, card, votes: {} }, status: 'in_progress' });
    send('next', 'would_you_rather', { card });
  };
  const handleNextCard = () => {
    sounds.playClick();
    showCard(getNextCuratedWYRCard());
  };
  const handleAICard = async () => {
    sounds.playClick();
    setIsGeneratingAI(true);
    try {
      showCard(await generateAIWYRCard());
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSwitchGame = (type: GameType) => {
    if (type === gameType) return;
    sounds.playClick();
    launchGame(type, send);
  };

  const pop = reduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeGame();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-dialog-title"
        {...pop}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full sm:max-w-lg bg-zinc-950 border border-white/15 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 flex flex-col gap-4 max-h-[92dvh] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="game-dialog-title" className="text-base font-bold text-white">Play together</h2>
            <p className="text-xs text-neutral-400 truncate">Live with {peerName}</p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={() => {
              sounds.playClick();
              closeGame();
            }}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-white/15 text-neutral-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
            aria-label="Close games"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game tabs */}
        <div role="tablist" aria-label="Games" className="grid grid-cols-3 gap-1 p-1 rounded-2xl border border-white/15">
          {TABS.map((tab) => {
            const active = gameType === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => handleSwitchGame(tab.id)}
                className={`min-h-[44px] px-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                  active ? 'bg-white text-black' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 hidden xs:block" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===== Tic-Tac-Toe ===== */}
        {gameType === 'tictactoe' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
              <div className={`min-w-0 px-3 py-2 rounded-xl border ${isMyTurn ? 'border-cyan-400/70' : 'border-white/10'}`}>
                <p className="font-semibold text-white truncate">You · <span className="text-cyan-300">{mySymbol}</span></p>
                <p className="text-xs text-neutral-400">{myScore} {myScore === 1 ? 'win' : 'wins'}</p>
              </div>
              <span className="text-xs font-bold text-neutral-500">VS</span>
              <div className={`min-w-0 px-3 py-2 rounded-xl border text-right ${!isMyTurn && status === 'in_progress' ? 'border-rose-400/70' : 'border-white/10'}`}>
                <p className="font-semibold text-white truncate">{peerName} · <span className="text-rose-300">{peerSymbol}</span></p>
                <p className="text-xs text-neutral-400">{peerScore} {peerScore === 1 ? 'win' : 'wins'}</p>
              </div>
            </div>

            <p className="text-sm font-semibold text-center min-h-[1.25rem]" aria-live="polite">
              {status === 'won' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {iWon ? 'You won!' : `${peerName} won!`}
                </span>
              ) : status === 'draw' ? (
                <span className="text-amber-300">It&rsquo;s a draw</span>
              ) : isMyTurn ? (
                <span className="text-cyan-300">Your turn, place {mySymbol}</span>
              ) : (
                <span className="text-neutral-400">Waiting for {peerName}&hellip;</span>
              )}
            </p>

            <div className="grid grid-cols-3 gap-2 w-full max-w-[17rem] aspect-square" role="grid" aria-label="Tic-Tac-Toe board">
              {board.map((cell, idx) => {
                const isWin = line?.includes(idx);
                const canClick = isMyTurn && cell === '';
                return (
                  <button
                    key={idx}
                    onClick={() => handleMove(idx)}
                    disabled={!canClick}
                    aria-label={`Row ${Math.floor(idx / 3) + 1}, column ${(idx % 3) + 1}: ${cell || 'empty'}`}
                    className={`rounded-2xl text-3xl sm:text-4xl font-black flex items-center justify-center border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                      isWin
                        ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10'
                        : cell === 'X'
                        ? 'border-cyan-400/40 text-cyan-300'
                        : cell === 'O'
                        ? 'border-rose-400/40 text-rose-300'
                        : canClick
                        ? 'border-white/20 hover:bg-white/5 hover:border-white/40'
                        : 'border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {cell}
                  </button>
                );
              })}
            </div>

            {(status === 'won' || status === 'draw') && (
              <button onClick={handleReset} className={btnPrimary}>
                <RefreshCw className="w-4 h-4" />
                Play again
              </button>
            )}
            {(status === 'won' || status === 'draw') && (
              <p className="text-xs text-neutral-500 -mt-2">You swap X and O each round.</p>
            )}
          </div>
        )}

        {/* ===== Questions ===== */}
        {gameType === 'dark_questions' && (
          <div className="flex flex-col gap-4">
            <motion.div
              key={activeQuestion?.question}
              {...pop}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/15 p-4 sm:p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full border border-white/20 text-neutral-200 font-semibold">
                  {activeQuestion?.category || 'Deep Talk'}
                </span>
                {activeQuestion?.tag && <span className="text-neutral-500 truncate">{activeQuestion.tag}</span>}
              </div>
              <p className="text-base sm:text-lg font-semibold text-white leading-snug text-balance" aria-live="polite">
                {activeQuestion?.question}
              </p>
              <p className="text-xs text-neutral-500">Take turns answering out loud. Skip anything you&rsquo;d rather not answer.</p>
            </motion.div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-neutral-400">React</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {REACTION_EMOJIS.map((emoji) => {
                  const selected = customData?.reactions?.[me] === emoji;
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      aria-pressed={selected}
                      aria-label={`React ${emoji}`}
                      className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                        selected ? 'border-white bg-white/10' : 'border-white/15 hover:bg-white/5'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
              {Object.keys(customData?.reactions || {}).length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-xs text-neutral-300">
                  {Object.entries(customData.reactions as Record<string, string>).map(([uid, r]) => (
                    <span key={uid} className="px-2.5 py-1 rounded-lg border border-white/10">
                      {uid === me ? 'You' : peerName} {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={handleNextQuestion} className={btnPrimary}>
                <RefreshCw className="w-4 h-4" />
                Next question
              </button>
              <button onClick={handleAIQuestion} disabled={isGeneratingAI} className={btnSecondary}>
                <Sparkles className={`w-4 h-4 ${isGeneratingAI ? 'motion-safe:animate-spin' : ''}`} />
                {isGeneratingAI ? 'Thinking…' : 'Surprise me'}
              </button>
            </div>
          </div>
        )}

        {/* ===== Would You Rather ===== */}
        {gameType === 'would_you_rather' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-white text-center">Would you rather&hellip;</p>
            <div className="flex flex-col gap-2">
              {(['optionA', 'optionB'] as const).map((opt, i) => {
                const mine = myVote === opt;
                const theirs = revealed && peerVote === opt;
                return (
                  <React.Fragment key={opt}>
                    {i === 1 && <p className="text-center text-xs font-bold text-neutral-500">OR</p>}
                    <button
                      onClick={() => handleVote(opt)}
                      disabled={status === 'completed'}
                      aria-pressed={mine}
                      className={`w-full min-h-[56px] p-4 rounded-2xl text-left text-sm sm:text-base font-semibold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 disabled:cursor-default ${
                        mine ? 'border-cyan-400 bg-cyan-400/10 text-white' : 'border-white/15 text-neutral-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>{(activeCard as any)?.[opt]}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                          {mine && (
                            <span className="inline-flex items-center gap-1 text-cyan-300">
                              <CheckCircle2 className="w-4 h-4" /> You
                            </span>
                          )}
                          {theirs && <span className="text-rose-300">{peerName}</span>}
                        </span>
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <p className="text-sm text-center min-h-[1.25rem]" aria-live="polite">
              {revealed ? (
                myVote === peerVote ? (
                  <span className="text-emerald-300 font-semibold">Same pick! You two think alike.</span>
                ) : (
                  <span className="text-amber-300 font-semibold">Different picks. Time to explain yourselves!</span>
                )
              ) : myVote ? (
                <span className="text-neutral-400">Waiting for {peerName} to choose&hellip;</span>
              ) : peerVote ? (
                <span className="text-neutral-400">{peerName} has chosen. Your turn!</span>
              ) : (
                <span className="text-neutral-500">Both pick, then the answers are revealed.</span>
              )}
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={handleNextCard} className={btnPrimary}>
                <RefreshCw className="w-4 h-4" />
                Next dilemma
              </button>
              <button onClick={handleAICard} disabled={isGeneratingAI} className={btnSecondary}>
                <Sparkles className={`w-4 h-4 ${isGeneratingAI ? 'motion-safe:animate-spin' : ''}`} />
                {isGeneratingAI ? 'Thinking…' : 'Surprise me'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
