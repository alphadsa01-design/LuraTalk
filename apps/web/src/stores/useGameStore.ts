import { create } from 'zustand';
import { getNextCuratedDarkQuestion, getNextCuratedWYRCard } from '@/lib/aiQuestions';

export type GameType = 'tictactoe' | 'dark_questions' | 'would_you_rather' | 'two_truths' | 'twenty_questions';

export interface GameState {
  isOpen: boolean;
  gameId: string | null;
  gameType: GameType | null;
  players: string[]; // [player1Id, player2Id]
  turn: string | null; // current player userId
  status: string; // 'in_progress', 'won', 'draw', 'completed'
  winner: string | null;
  board: string[]; // for Tic-Tac-Toe
  scores: Record<string, number>;
  customData: Record<string, any>;

  openGame: (type: GameType, data?: Record<string, any>) => void;
  closeGame: () => void;
  updateGameState: (session: any) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  isOpen: false,
  gameId: null,
  gameType: null,
  players: [],
  turn: null,
  status: 'idle',
  winner: null,
  board: Array(9).fill(''),
  scores: {},
  customData: {},

  openGame: (type, data = {}) =>
    set({
      isOpen: true,
      gameType: type,
      status: 'in_progress',
      winner: null,
      turn: null,
      board: Array(9).fill(''),
      customData:
        type === 'dark_questions'
          ? { question: data.question ?? getNextCuratedDarkQuestion(), reactions: {} }
          : type === 'would_you_rather'
          ? { card: data.card ?? getNextCuratedWYRCard(), votes: {} }
          : {},
    }),
  closeGame: () => set({ isOpen: false }),
  updateGameState: (session) =>
    set((state) => ({
      // Only pop the game open for a newly started game; don't reopen one the user closed
      isOpen: state.isOpen || session.gameId !== state.gameId,
      gameId: session.gameId,
      gameType: session.gameType,
      players: session.players || [],
      turn: session.turn || null,
      status: session.status || 'in_progress',
      winner: session.winner || null,
      board: session.board ? Array.from(session.board) : Array(9).fill(''),
      scores: session.scores || {},
      customData: session.customData || {},
    })),
  resetGame: () =>
    set({
      isOpen: false,
      gameId: null,
      gameType: null,
      players: [],
      turn: null,
      status: 'idle',
      winner: null,
      board: Array(9).fill(''),
      scores: {},
      customData: {},
    }),
}));

/**
 * Start a game for both people in the call: picks the first question/card locally
 * (shown instantly) and asks the server to start the synced session with it.
 */
export function launchGame(
  type: GameType,
  send: (actionType: string, gameType: GameType, data?: Record<string, any>) => void
) {
  const data: Record<string, any> =
    type === 'dark_questions'
      ? { question: getNextCuratedDarkQuestion() }
      : type === 'would_you_rather'
      ? { card: getNextCuratedWYRCard() }
      : {};
  useGameStore.getState().openGame(type, data);
  send('start', type, data);
}
