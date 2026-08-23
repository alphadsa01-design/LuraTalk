'use client';

import React, { useState } from 'react';
import {
  Gamepad2,
  X,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Trophy,
  Flame,
  SmilePlus,
} from 'lucide-react';
import {
  useGameStore,
  GameType,
  DARK_QUESTIONS,
  DEFAULT_WYR_CARDS,
} from '@/stores/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';

interface GameOverlayProps {
  currentUserId: string;
  peerName?: string;
  onSendAction: (actionType: string, gameType?: string, data?: any) => void;
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6],           // Diagonals
];

function checkWinner(board: string[]): { winner: string | null; line: number[] | null } {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  return { winner: null, line: null };
}

const REACTION_EMOJIS = ['🔥', '💀', '😱', '🤫', '🤯', '🤐'];

export default function GameOverlay({
  currentUserId,
  peerName = 'Partner',
  onSendAction,
}: GameOverlayProps) {
  const {
    isOpen,
    gameType,
    board,
    players,
    turn,
    status,
    winner,
    customData,
    scores,
    openGame,
    closeGame,
  } = useGameStore();

  const [localDarkIndex, setLocalDarkIndex] = useState(0);
  const [localCardIndex, setLocalCardIndex] = useState(0);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');

  if (!isOpen) return null;

  // Active game card data with instant fallbacks
  const activeDarkQuestion =
    customData?.question || DARK_QUESTIONS[localDarkIndex % DARK_QUESTIONS.length];
  const activeCard =
    customData?.card || DEFAULT_WYR_CARDS[localCardIndex % DEFAULT_WYR_CARDS.length];

  // --- TIC-TAC-TOE TURN & SYMBOL LOGIC ---
  const isPlayer1 = players.length >= 2 ? currentUserId === players[0] : true;
  const mySymbol: 'X' | 'O' = isPlayer1 ? 'X' : 'O';
  const peerSymbol: 'X' | 'O' = mySymbol === 'X' ? 'O' : 'X';

  const filledCount = board.filter((c) => c !== '').length;
  const currentTurnSymbol: 'X' | 'O' = filledCount % 2 === 0 ? 'X' : 'O';

  // Determine if it's currently MY turn
  const isMyTurn =
    status === 'in_progress' &&
    (turn ? turn === currentUserId : currentTurnSymbol === mySymbol);

  const { line: winningLine } = checkWinner(board);

  // Format winner banner display text
  const getWinnerText = () => {
    if (!winner) return 'Winner Declared!';
    if (winner === currentUserId || winner === mySymbol) return 'You Won the Game!';
    if (winner === 'X' || winner === 'O') {
      return winner === mySymbol ? 'You Won the Game!' : `${peerName} Won the Game!`;
    }
    if (winner.length > 20) {
      return winner === currentUserId ? 'You Won the Game!' : `${peerName} Won the Game!`;
    }
    return `${winner} Won the Game!`;
  };

  // --- Handlers ---
  const handleTicTacToeMove = (idx: number) => {
    if (!isMyTurn || board[idx] !== '') return;
    sounds.playClick();

    const nextBoard = [...board];
    nextBoard[idx] = mySymbol;

    const { winner: winSymbol } = checkWinner(nextBoard);
    let nextStatus = 'in_progress';
    let nextWinner: string | null = null;

    if (winSymbol) {
      nextStatus = 'won';
      nextWinner = currentUserId || winSymbol;
    } else if (nextBoard.every((c) => c !== '')) {
      nextStatus = 'draw';
    }

    useGameStore.setState({
      board: nextBoard,
      status: nextStatus,
      winner: nextWinner,
      turn: nextStatus === 'in_progress' && players.length > 1 ? (isPlayer1 ? players[1] : players[0]) : null,
    });

    onSendAction('move', 'tictactoe', {
      cell: idx,
      symbol: mySymbol,
      board: nextBoard,
      status: nextStatus,
      winner: nextWinner,
    });
  };

  const handleResetTicTacToe = () => {
    sounds.playClick();
    const emptyBoard = Array(9).fill('');
    useGameStore.setState({
      board: emptyBoard,
      status: 'in_progress',
      winner: null,
    });
    onSendAction('reset', 'tictactoe', { board: emptyBoard, status: 'in_progress' });
  };

  // Dark Questions Handlers
  const handleNextDarkQuestion = () => {
    sounds.playClick();
    let nextIdx = localDarkIndex + 1;
    if (activeCategoryFilter !== 'All') {
      const filtered = DARK_QUESTIONS.filter((q) => q.category.includes(activeCategoryFilter));
      if (filtered.length > 0) {
        const nextQ = filtered[nextIdx % filtered.length];
        useGameStore.setState({
          customData: { question: nextQ, reactions: {} },
          status: 'in_progress',
        });
        onSendAction('next', 'dark_questions', { question: nextQ });
        setLocalDarkIndex(nextIdx);
        return;
      }
    }
    setLocalDarkIndex(nextIdx);
    const nextQ = DARK_QUESTIONS[nextIdx % DARK_QUESTIONS.length];
    useGameStore.setState({
      customData: { question: nextQ, reactions: {} },
      status: 'in_progress',
    });
    onSendAction('next', 'dark_questions', { question: nextQ });
  };

  const handleReactDarkQuestion = (emoji: string) => {
    sounds.playClick();
    const currentReactions = { ...(customData?.reactions || {}) };
    currentReactions[currentUserId || 'me'] = emoji;
    useGameStore.setState({
      customData: { ...customData, reactions: currentReactions },
    });
    onSendAction('react', 'dark_questions', { reaction: emoji, reactions: currentReactions });
  };

  // WYR Handlers
  const handleWYRVote = (optionKey: string) => {
    sounds.playClick();
    const updatedVotes = { ...(customData?.votes || {}), [currentUserId || 'me']: optionKey };
    useGameStore.setState({
      customData: { ...customData, card: activeCard, votes: updatedVotes },
      status: 'completed',
    });
    onSendAction('vote', 'would_you_rather', { option: optionKey, votes: updatedVotes });
  };

  const handleNextWYR = () => {
    sounds.playClick();
    const nextIdx = localCardIndex + 1;
    setLocalCardIndex(nextIdx);
    const nextCard = DEFAULT_WYR_CARDS[nextIdx % DEFAULT_WYR_CARDS.length];
    useGameStore.setState({
      customData: { card: nextCard, votes: {} },
      status: 'in_progress',
    });
    onSendAction('next', 'would_you_rather', { card: nextCard });
  };

  const handleSwitchGame = (type: GameType) => {
    sounds.playClick();
    openGame(type);
    onSendAction('start', type, {});
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg border border-white/15 rounded-3xl p-4 sm:p-6 shadow-2xl bg-black/90 flex flex-col space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl border border-white/20 bg-transparent flex items-center justify-center">
                <Gamepad2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>In-Call Games</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </h3>
                <p className="text-[10px] text-gray-400">Live with {peerName}</p>
              </div>
            </div>

            <button
              onClick={() => {
                sounds.playClick();
                closeGame();
              }}
              className="p-2 rounded-xl bg-transparent hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 active:scale-95"
              title="Close game"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Game Switcher Tabs - Unfilled Clean Outline Style */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-transparent border border-white/15 rounded-2xl">
            {[
              { id: 'tictactoe' as GameType, label: 'Tic-Tac-Toe', icon: Gamepad2 },
              { id: 'dark_questions' as GameType, label: 'Dark Truths', icon: Flame },
              { id: 'would_you_rather' as GameType, label: 'Would You', icon: Sparkles },
            ].map((tab) => {
              const isActive = gameType === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchGame(tab.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-transparent border border-white/40 text-white font-bold shadow-sm'
                      : 'bg-transparent border border-transparent text-gray-400 hover:text-white hover:border-white/15'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* GAME 1: TIC-TAC-TOE WITH TURN-BY-TURN & SYMBOL LOCK      */}
          {/* ======================================================== */}
          {gameType === 'tictactoe' && (
            <div className="flex flex-col items-center py-2 space-y-4">
              {/* Player Badges & Signs */}
              <div className="w-full flex items-center justify-between gap-2 px-1">
                {/* User Player Pill */}
                <div
                  className={`flex-1 p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
                    isMyTurn && status === 'in_progress'
                      ? 'bg-transparent border-cyan-400/60 shadow-md'
                      : 'bg-transparent border-white/10 opacity-70'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-sm border border-cyan-400/40 text-cyan-300 bg-transparent">
                    {mySymbol}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">You ({mySymbol})</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      {isMyTurn && status === 'in_progress' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          <span>Your Turn</span>
                        </>
                      ) : (
                        <span>Waiting</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-gray-500">VS</div>

                {/* Peer Player Pill */}
                <div
                  className={`flex-1 p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
                    !isMyTurn && status === 'in_progress'
                      ? 'bg-transparent border-rose-400/60 shadow-md'
                      : 'bg-transparent border-white/10 opacity-70'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-sm border border-rose-400/40 text-rose-300 bg-transparent">
                    {peerSymbol}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{peerName} ({peerSymbol})</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      {!isMyTurn && status === 'in_progress' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                          <span>Thinking...</span>
                        </>
                      ) : (
                        <span>Ready</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status / Turn Banner */}
              <div className="w-full text-center">
                {status === 'won' ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="py-2 px-4 rounded-2xl bg-transparent border border-emerald-400 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>{getWinnerText()}</span>
                  </motion.div>
                ) : status === 'draw' ? (
                  <div className="py-2 px-4 rounded-2xl bg-transparent border border-amber-400/60 text-amber-300 font-bold text-xs">
                    Game ended in a Draw!
                  </div>
                ) : isMyTurn ? (
                  <div className="py-2 px-4 rounded-2xl bg-transparent border border-cyan-400/60 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 animate-pulse">
                    <span>Your Turn! Place</span>
                    <span className="px-2 py-0.5 rounded-lg border border-cyan-400 text-cyan-200 font-mono font-black">
                      {mySymbol}
                    </span>
                  </div>
                ) : (
                  <div className="py-2 px-4 rounded-2xl bg-transparent border border-white/15 text-gray-400 font-medium text-xs flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Waiting for {peerName} ({peerSymbol})...</span>
                  </div>
                )}
              </div>

              {/* 3x3 Tic-Tac-Toe Board */}
              <div className="grid grid-cols-3 gap-3 w-64 h-64 sm:w-72 sm:h-72 p-3 rounded-3xl bg-transparent border border-white/15 shadow-xl relative">
                {board.map((cell, idx) => {
                  const isWinningCell = winningLine?.includes(idx);
                  const isCellEmpty = cell === '';
                  const canClick = isMyTurn && isCellEmpty && status === 'in_progress';

                  return (
                    <button
                      key={idx}
                      onClick={() => handleTicTacToeMove(idx)}
                      disabled={!canClick}
                      className={`relative rounded-2xl text-3xl font-black flex items-center justify-center transition-all bg-transparent ${
                        isWinningCell
                          ? 'border-2 border-emerald-400 text-emerald-300 scale-95'
                          : cell === 'X'
                          ? 'border border-cyan-400/50 text-cyan-300'
                          : cell === 'O'
                          ? 'border border-rose-400/50 text-rose-300'
                          : canClick
                          ? 'border border-white/15 hover:border-cyan-400 hover:bg-white/5 cursor-pointer active:scale-95 group'
                          : 'border border-white/5 cursor-not-allowed opacity-40'
                      }`}
                    >
                      {cell ? (
                        <motion.span
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', damping: 15 }}
                        >
                          {cell}
                        </motion.span>
                      ) : canClick ? (
                        <span className="opacity-0 group-hover:opacity-40 text-cyan-300 text-xl font-black">
                          {mySymbol}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Play Again / Reset Button - Clean Outline Style */}
              {(status === 'won' || status === 'draw') && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleResetTicTacToe}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-transparent hover:bg-white/10 border border-white/30 hover:border-white/60 text-white text-xs font-bold transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-once" />
                  <span>Play Again</span>
                </motion.button>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* GAME 2: DARK & DEEP QUESTIONS / DILEMMAS                 */}
          {/* ======================================================== */}
          {gameType === 'dark_questions' && (
            <div className="flex flex-col items-center py-2 space-y-4">
              {/* Category Pills - Unfilled Clean Outline Style */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
                {['All', 'Dark Truths', 'Moral Dilemma', 'Existential', 'Psychology'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      sounds.playClick();
                      setActiveCategoryFilter(cat);
                      handleNextDarkQuestion();
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      activeCategoryFilter === cat
                        ? 'bg-transparent border-rose-400 text-rose-300 font-bold'
                        : 'bg-transparent border-white/15 text-gray-400 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Question Card */}
              <motion.div
                key={activeDarkQuestion?.question}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full p-5 sm:p-6 rounded-3xl bg-transparent border border-white/15 shadow-xl relative flex flex-col space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-transparent border border-rose-400/40 text-rose-300 flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-rose-400 animate-pulse" />
                    <span>{activeDarkQuestion?.category || 'Dark Truth'}</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {activeDarkQuestion?.tag || 'Unfiltered'}
                  </span>
                </div>

                <p className="text-sm sm:text-base font-bold text-white leading-relaxed text-center py-3">
                  "{activeDarkQuestion?.question}"
                </p>

                {/* Reaction Emojis Grid - Unfilled Clean Outline Style */}
                <div className="pt-2 border-t border-white/10 flex flex-col items-center space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <SmilePlus className="w-3 h-3 text-rose-400" />
                    <span>React to this question</span>
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {REACTION_EMOJIS.map((emoji) => {
                      const myReaction = customData?.reactions?.[currentUserId || 'me'];
                      const isReacted = myReaction === emoji;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReactDarkQuestion(emoji)}
                          className={`w-9 h-9 rounded-2xl text-lg flex items-center justify-center border transition-all ${
                            isReacted
                              ? 'bg-transparent border-rose-400 scale-110 shadow-sm'
                              : 'bg-transparent border-white/15 hover:border-white/40 hover:scale-105 active:scale-95'
                          }`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>

                  {/* Peer reaction display if any */}
                  {Object.keys(customData?.reactions || {}).length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {Object.entries(customData.reactions).map(([uid, r]) => (
                        <span
                          key={uid}
                          className="px-2.5 py-1 rounded-xl bg-transparent border border-white/15 text-xs text-gray-300 flex items-center gap-1"
                        >
                          <span>{uid === currentUserId ? 'You' : peerName}:</span>
                          <span className="text-base">{r as string}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Next Question Button - Unfilled Clean Outline Style */}
              <button
                onClick={handleNextDarkQuestion}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-transparent hover:bg-white/10 border border-white/30 hover:border-white/60 text-white text-xs font-bold transition-all mx-auto active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Next Dark Question</span>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* GAME 3: WOULD YOU RATHER                                 */}
          {/* ======================================================== */}
          {gameType === 'would_you_rather' && (
            <div className="flex flex-col items-center py-2 space-y-4">
              <p className="text-xs uppercase tracking-widest text-gray-300 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Pick Your Choice</span>
              </p>

              <div className="w-full flex flex-col gap-3">
                {['optionA', 'optionB'].map((optKey) => {
                  const optText = (activeCard as any)?.[optKey] || 'Option';
                  const myVote = customData?.votes?.[currentUserId || 'me'];
                  const isSelected = myVote === optKey;

                  return (
                    <button
                      key={optKey}
                      onClick={() => handleWYRVote(optKey)}
                      className={`w-full p-4 rounded-2xl text-left text-xs sm:text-sm font-semibold transition-all border ${
                        isSelected
                          ? 'bg-transparent border-cyan-400 text-white shadow-sm scale-[1.01]'
                          : 'bg-transparent hover:bg-white/5 border-white/15 text-gray-200 active:scale-98'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{optText}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-center w-full">
                {status === 'completed' && (
                  <p className="text-xs text-emerald-400 font-medium mb-3">
                    Choice registered! Compare answers with {peerName}.
                  </p>
                )}
                <button
                  onClick={handleNextWYR}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-transparent hover:bg-white/10 border border-white/30 hover:border-white/60 text-white text-xs font-bold transition-all mx-auto active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Next Dilemma</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
