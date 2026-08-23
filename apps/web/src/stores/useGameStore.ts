import { create } from 'zustand';

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

  openGame: (type: GameType) => void;
  closeGame: () => void;
  updateGameState: (session: any) => void;
  resetGame: () => void;
}

export const DARK_QUESTIONS = [
  {
    category: 'Dark Truths',
    question: 'What is a secret you will take to the grave if nobody ever forces you to speak?',
    tag: 'Unfiltered Secret',
  },
  {
    category: 'Moral Dilemma',
    question: 'If you received $20 Million tax-free, but a random stranger somewhere dies, would you press the button?',
    tag: 'High Stakes',
  },
  {
    category: 'Secrets & Regrets',
    question: 'Have you ever secretly felt satisfied or happy about someone else’s downfall or failure?',
    tag: 'Guilty Confession',
  },
  {
    category: 'Existential',
    question: 'Would you rather know the exact date and time of your death, or the exact cause?',
    tag: 'Fate & Destiny',
  },
  {
    category: 'Dark Truths',
    question: 'What is the most manipulative thing you have ever done to get what you wanted?',
    tag: 'Unfiltered Truth',
  },
  {
    category: 'Moral Dilemma',
    question: 'If you could erase one person from your past as if they never existed with zero consequences, would you do it?',
    tag: 'Erase the Past',
  },
  {
    category: 'Psychology',
    question: 'What is a toxic personality trait you know you have, but secretly kind of enjoy?',
    tag: 'Shadow Self',
  },
  {
    category: 'Secrets & Regrets',
    question: 'Have you ever stayed with someone or pretended to care just because you were terrified of being alone?',
    tag: 'Raw Honesty',
  },
  {
    category: 'Existential',
    question: 'Would you rather live a 100% happy life inside a fake simulation, or endure painful truths in reality?',
    tag: 'Simulation vs Reality',
  },
  {
    category: 'Dark Truths',
    question: 'If everyone in your life could hear your raw, uncensored inner thoughts for 2 minutes, who would leave first?',
    tag: 'Mind Unlocked',
  },
  {
    category: 'Moral Dilemma',
    question: 'Would you rather betray your best friend to save your career, or ruin your career to keep their secret safe?',
    tag: 'Loyalty Test',
  },
  {
    category: 'Psychology',
    question: 'What is something you did in your past that still occasionally haunts you when you try to sleep at night?',
    tag: 'Midnight Thoughts',
  },
  {
    category: 'Dark Truths',
    question: 'Have you ever ghosted someone who genuinely loved or cared for you, knowing it would break them?',
    tag: 'Hard Truth',
  },
  {
    category: 'Existential',
    question: 'If you died tonight, what is the single file, item, or chat on your phone you would pray nobody ever discovers?',
    tag: 'Digital Graveyard',
  },
  {
    category: 'Moral Dilemma',
    question: 'If you had 24 hours where absolutely nothing you did had legal or social consequences, what would you honestly do?',
    tag: 'The Purge Rule',
  },
  {
    category: 'Secrets & Regrets',
    question: 'What was the exact moment in your life where you realized you had lost your childhood innocence?',
    tag: 'Turning Point',
  },
  {
    category: 'Psychology',
    question: 'Do you believe humans are fundamentally selfish and good only when watched, or inherently compassionate?',
    tag: 'Human Nature',
  },
  {
    category: 'Dark Truths',
    question: 'What is a lie you told that spiraled so out of control that you had to create a completely fake backstory?',
    tag: 'Deep Web of Lies',
  },
  {
    category: 'Moral Dilemma',
    question: 'Would you rather be universally loved for a fake persona, or hated by everyone for who you truly are?',
    tag: 'Authenticity vs Acceptance',
  },
  {
    category: 'Existential',
    question: 'If you found out tomorrow that your entire life up to this second was an elaborate psychological experiment, what is your next move?',
    tag: 'The Truman Effect',
  },
];

export const DEFAULT_WYR_CARDS = [
  { optionA: 'Always know when someone is lying to you', optionB: 'Always get away with any lie you tell with 100% belief' },
  { optionA: 'Know the exact date and time of your death', optionB: 'Know the exact cause of your death with no timestamp' },
  { optionA: 'Travel 100 years into the future', optionB: 'Travel 100 years into the past with full modern knowledge' },
  { optionA: 'Never have to sleep with 100% energy forever', optionB: 'Never have to work with infinite funding' },
  { optionA: 'Erase your worst mistake from everyone’s memory', optionB: 'Receive $5 Million but keep the memory intact' },
  { optionA: 'Have all your private search history leaked to your contacts', optionB: 'Never be able to use the internet again for life' },
  { optionA: 'Be able to read everyone’s mind without turning it off', optionB: 'Have everyone hear your thoughts whenever they look at you' },
  { optionA: 'Speak every human language fluently', optionB: 'Understand and communicate with all animal species' },
];

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

  openGame: (type) =>
    set({
      isOpen: true,
      gameType: type,
      status: 'in_progress',
      winner: null,
      board: Array(9).fill(''),
      customData:
        type === 'dark_questions'
          ? { question: DARK_QUESTIONS[0], reactions: {} }
          : type === 'would_you_rather'
          ? { card: DEFAULT_WYR_CARDS[0], votes: {} }
          : {},
    }),
  closeGame: () => set({ isOpen: false }),
  updateGameState: (session) =>
    set({
      isOpen: true,
      gameId: session.gameId,
      gameType: session.gameType,
      players: session.players || [],
      turn: session.turn || null,
      status: session.status || 'in_progress',
      winner: session.winner || null,
      board: session.board ? Array.from(session.board) : Array(9).fill(''),
      scores: session.scores || {},
      customData: session.customData || {},
    }),
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
