import { create } from 'zustand';

export type GameType = 'tictactoe' | 'would_you_rather' | 'trivia' | 'two_truths' | 'twenty_questions';

export interface GameState {
  isOpen: boolean;
  gameId: string | null;
  gameType: GameType | null;
  turn: string | null;
  status: string; // 'in_progress', 'won', 'draw', 'completed'
  winner: string | null;
  board: string[]; // for Tic-Tac-Toe
  scores: Record<string, number>;
  customData: Record<string, any>;

  openGame: (type: GameType) => void;
  closeGame: () => void;
  updateGameState: (session: any) => void;
  resetGame: () => void;
}

export const DEFAULT_WYR_CARDS = [
  { optionA: 'Travel 100 years into the future', optionB: 'Travel 100 years into the past' },
  { optionA: 'Never have to sleep with 100% energy', optionB: 'Never have to work with infinite money' },
  { optionA: 'Explore the deepest ocean trenches', optionB: 'Explore uncharted planets in space' },
  { optionA: 'Speak every human language fluently', optionB: 'Understand and speak with all animals' },
];

export const DEFAULT_TRIVIA_QUESTIONS = [
  { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], answer: 1 },
  { question: 'What is the fastest animal on land?', options: ['Cheetah', 'Pronghorn', 'Lion', 'Peregrine Falcon'], answer: 0 },
  { question: 'How many hearts does an octopus possess?', options: ['1', '2', '3', '4'], answer: 2 },
  { question: 'Which element has the chemical symbol "Au"?', options: ['Silver', 'Gold', 'Argon', 'Aluminum'], answer: 1 },
];

export const useGameStore = create<GameState>((set) => ({
  isOpen: false,
  gameId: null,
  gameType: null,
  turn: null,
  status: 'idle',
  winner: null,
  board: Array(9).fill(''),
  scores: {},
  customData: {},

  openGame: (type) =>
    set({
      isOpen: true,
      gameType: type,
      status: 'in_progress',
      winner: null,
      board: Array(9).fill(''),
      customData:
        type === 'would_you_rather'
          ? { card: DEFAULT_WYR_CARDS[0], votes: {} }
          : type === 'trivia'
          ? { question: DEFAULT_TRIVIA_QUESTIONS[0], answers: {} }
          : {},
    }),
  closeGame: () => set({ isOpen: false }),
  updateGameState: (session) =>
    set({
      isOpen: true,
      gameId: session.gameId,
      gameType: session.gameType,
      turn: session.turn,
      status: session.status,
      winner: session.winner || null,
      board: session.board || Array(9).fill(''),
      scores: session.scores || {},
      customData: session.customData || {},
    }),
  resetGame: () =>
    set({
      isOpen: false,
      gameId: null,
      gameType: null,
      turn: null,
      status: 'idle',
      winner: null,
      board: Array(9).fill(''),
      scores: {},
      customData: {},
    }),
}));
