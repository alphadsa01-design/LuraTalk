'use client';

import React, { useState } from 'react';
import { Gamepad2, X, RefreshCw, CheckCircle2, Sparkles, Trophy, Zap, HelpCircle } from 'lucide-react';
import {
  useGameStore,
  GameType,
  DEFAULT_WYR_CARDS,
  DEFAULT_TRIVIA_QUESTIONS,
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

function checkWinner(board: string[]): string | null {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export default function GameOverlay({ currentUserId, peerName = 'Partner', onSendAction }: GameOverlayProps) {
  const {
    isOpen,
    gameType,
    board,
    turn,
    status,
    winner,
    customData,
    scores,
    openGame,
    closeGame,
  } = useGameStore();

  const [localCardIndex, setLocalCardIndex] = useState(0);
  const [localTriviaIndex, setLocalTriviaIndex] = useState(0);
  const [localScores, setLocalScores] = useState({ me: 0, peer: 0 });

  if (!isOpen) return null;

  // Active game card data with instant fallbacks
  const activeCard =
    customData?.card || DEFAULT_WYR_CARDS[localCardIndex % DEFAULT_WYR_CARDS.length];
  const activeQuestion =
    customData?.question ||
    DEFAULT_TRIVIA_QUESTIONS[localTriviaIndex % DEFAULT_TRIVIA_QUESTIONS.length];

  // Count placed pieces to determine next symbol in Tic-Tac-Toe
  const filledCount = board.filter((c) => c !== '').length;
  const currentSymbol = filledCount % 2 === 0 ? 'X' : 'O';

  // Format winner banner display text cleanly without raw UUIDs
  const getWinnerText = () => {
    if (!winner) return 'Winner Declared!';
    if (winner === currentUserId || winner === 'me') return '🎉 You Won the Round!';
    if (winner === 'X' || winner === 'O') return `🎉 (${winner}) Won the Round!`;
    if (winner.length > 20) {
      // It's a raw UUID, check if it matches current user
      return winner === currentUserId ? '🎉 You Won the Round!' : `🎉 ${peerName} Won the Round!`;
    }
    return `🎉 ${winner} Won the Round!`;
  };

  // --- Handlers ---
  const handleTicTacToeMove = (idx: number) => {
    if (board[idx] !== '' || status === 'won' || status === 'draw') return;
    sounds.playClick();

    const nextBoard = [...board];
    nextBoard[idx] = currentSymbol;

    const winSymbol = checkWinner(nextBoard);
    let nextStatus = 'in_progress';
    let nextWinner: string | null = null;

    if (winSymbol) {
      nextStatus = 'won';
      nextWinner = winSymbol;
      if (winSymbol === 'X') {
        setLocalScores((prev) => ({ ...prev, me: prev.me + 1 }));
      } else {
        setLocalScores((prev) => ({ ...prev, peer: prev.peer + 1 }));
      }
    } else if (nextBoard.every((c) => c !== '')) {
      nextStatus = 'draw';
    }

    useGameStore.setState({
      board: nextBoard,
      status: nextStatus,
      winner: nextWinner,
    });

    onSendAction('move', 'tictactoe', {
      cell: idx,
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

  const handleTriviaAnswer = (optIdx: number) => {
    sounds.playClick();
    const isCorrect = activeQuestion?.answer === optIdx;
    if (isCorrect) {
      setLocalScores((prev) => ({ ...prev, me: prev.me + 10 }));
    }

    const updatedAnswers = {
      ...(customData?.answers || {}),
      [currentUserId || 'me']: optIdx,
    };
    useGameStore.setState({
      customData: {
        ...customData,
        question: activeQuestion,
        answers: updatedAnswers,
      },
      status: 'completed',
    });
    onSendAction('answer', 'trivia', { optionIndex: optIdx, answers: updatedAnswers });
  };

  const handleNextTrivia = () => {
    sounds.playClick();
    const nextIdx = localTriviaIndex + 1;
    setLocalTriviaIndex(nextIdx);
    const nextQuestion = DEFAULT_TRIVIA_QUESTIONS[nextIdx % DEFAULT_TRIVIA_QUESTIONS.length];
    useGameStore.setState({
      customData: { question: nextQuestion, answers: {} },
      status: 'in_progress',
    });
    onSendAction('next', 'trivia', { question: nextQuestion });
  };

  const handleSwitchGame = (type: GameType) => {
    sounds.playClick();
    openGame(type);
    onSendAction('start', type, {});
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md glass-panel-glow border border-primary/40 rounded-3xl p-5 sm:p-6 shadow-2xl bg-surface/95 flex flex-col space-y-4"
        >
          {/* Header & Quick Tabs */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 flex items-center justify-center shadow-md">
                <Gamepad2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  In-Call Mini-Game
                </h3>
                <p className="text-[10px] text-gray-400">Play live with your voice partner</p>
              </div>
            </div>

            <button
              onClick={() => {
                sounds.playClick();
                closeGame();
              }}
              className="p-1.5 rounded-xl bg-surfaceLight hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Game Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/40 border border-white/10 rounded-2xl">
            {[
              { id: 'tictactoe' as GameType, label: 'Tic-Tac-Toe', icon: '❌' },
              { id: 'would_you_rather' as GameType, label: 'Would You', icon: '🤔' },
              { id: 'trivia' as GameType, label: 'Trivia', icon: '🧠' },
            ].map((tab) => {
              const isActive = gameType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchGame(tab.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-md shadow-primary/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* GAME 1: TIC-TAC-TOE */}
          {gameType === 'tictactoe' && (
            <div className="flex flex-col items-center py-2 space-y-4">
              <div className="text-xs font-semibold px-4 py-1.5 rounded-full border bg-white/5 border-white/10 shadow-sm">
                {status === 'won' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400 animate-bounce" />
                    <span>{getWinnerText()}</span>
                  </span>
                ) : status === 'draw' ? (
                  <span className="text-amber-400 font-bold">Game ended in a Draw! 🤝</span>
                ) : (
                  <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                    <span>Next Move:</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono">{currentSymbol}</span>
                  </span>
                )}
              </div>

              {/* 3x3 Grid */}
              <div className="grid grid-cols-3 gap-2.5 w-64 h-64 p-2 rounded-2xl bg-black/30 border border-white/10 shadow-inner">
                {board.map((cell, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTicTacToeMove(idx)}
                    disabled={cell !== '' || status === 'won' || status === 'draw'}
                    className={`rounded-xl text-2xl font-black flex items-center justify-center transition-all ${
                      cell === 'X'
                        ? 'bg-primary/30 text-secondary border border-primary/50 shadow-inner scale-95'
                        : cell === 'O'
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 shadow-inner scale-95'
                        : status === 'in_progress'
                        ? 'bg-surfaceLight hover:bg-white/15 border border-white/10 hover:border-primary/40 cursor-pointer active:scale-90 hover:scale-105'
                        : 'bg-surfaceLight/50 border border-white/5 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {cell}
                  </button>
                ))}
              </div>

              {(status === 'won' || status === 'draw') && (
                <button
                  onClick={handleResetTicTacToe}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>
              )}
            </div>
          )}

          {/* GAME 2: WOULD YOU RATHER */}
          {gameType === 'would_you_rather' && (
            <div className="flex flex-col items-center py-2 space-y-4">
              <p className="text-xs uppercase tracking-widest text-secondary font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-secondary animate-pulse" />
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
                      className={`w-full p-4 rounded-2xl text-left text-sm font-semibold transition-all border ${
                        isSelected
                          ? 'bg-primary/30 border-primary text-white shadow-lg shadow-primary/25 scale-[1.02]'
                          : 'bg-surfaceLight hover:bg-white/10 border-white/10 text-gray-200 active:scale-98'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{optText}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-center w-full">
                {status === 'completed' && (
                  <p className="text-xs text-emerald-400 font-medium mb-3">
                    Choice registered! Discuss your answers together.
                  </p>
                )}
                <button
                  onClick={handleNextWYR}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold hover:scale-105 active:scale-95 transition-all mx-auto shadow-lg shadow-primary/30"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Next Dilemma</span>
                </button>
              </div>
            </div>
          )}

          {/* GAME 3: TRIVIA */}
          {gameType === 'trivia' && (
            <div className="flex flex-col py-2 space-y-4">
              <h4 className="text-sm font-bold text-white leading-relaxed text-center px-2">
                {activeQuestion?.question}
              </h4>

              <div className="grid grid-cols-1 gap-2.5">
                {activeQuestion?.options?.map((opt: string, idx: number) => {
                  const myAnswer = customData?.answers?.[currentUserId || 'me'];
                  const isSelected = myAnswer === idx;
                  const isCompleted = status === 'completed' || myAnswer !== undefined;
                  const isCorrect = activeQuestion?.answer === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleTriviaAnswer(idx)}
                      className={`w-full p-3 rounded-2xl text-left text-xs font-semibold border transition-all ${
                        isCompleted && isCorrect
                          ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-500/20'
                          : isSelected && !isCorrect
                          ? 'bg-rose-500/25 border-rose-500 text-rose-200'
                          : isSelected
                          ? 'bg-primary/30 border-primary text-white'
                          : 'bg-surfaceLight hover:bg-white/10 border-white/10 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opt}</span>
                        {isCompleted && isCorrect && (
                          <span className="text-emerald-400 font-bold text-[10px]">CORRECT ✓</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={handleNextTrivia}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold hover:scale-105 active:scale-95 transition-all mx-auto shadow-lg shadow-primary/30"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Next Trivia Question</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
