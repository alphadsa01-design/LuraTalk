/**
 * In-call game content for LuraTalk.
 *
 * Players are anonymous strangers of unknown age, so every prompt must be fine to
 * hear from someone you just met: bold, funny, revealing and deep — never sexual,
 * never about self-harm, never asking for identifying details.
 */

export interface DeepQuestion {
  category: string;
  question: string;
  tag: string;
}

export interface WYRCard {
  optionA: string;
  optionB: string;
}

const q = (category: string, tag: string, question: string): DeepQuestion => ({ category, tag, question });

export const DEEP_QUESTIONS: DeepQuestion[] = [
  // --- Deep Talk ---
  q('Deep Talk', 'Turning Point', 'What is a moment that quietly changed the direction of your life?'),
  q('Deep Talk', 'Inner Voice', 'What is something you believe now that you would have argued against five years ago?'),
  q('Deep Talk', 'Comfort', 'What makes you feel most at home, even when you are far from home?'),
  q('Deep Talk', 'Proud Of', 'What are you secretly proud of that nobody ever compliments you on?'),
  q('Deep Talk', 'Lessons', 'What is a lesson you had to learn twice before it finally stuck?'),
  q('Deep Talk', 'Fear', 'What is a fear you have that you wish you could just switch off?'),
  q('Deep Talk', 'Younger You', 'What would your 10-year-old self think of who you are today?'),
  q('Deep Talk', 'Energy', 'What drains your energy faster than anything else, and what refills it?'),
  q('Deep Talk', 'Misunderstood', 'What is something people often get wrong about you on first impression?'),
  q('Deep Talk', 'Gratitude', 'Who is someone who helped you more than they will ever know?'),
  q('Deep Talk', 'Meaning', 'What does a "good life" actually look like to you?'),
  q('Deep Talk', 'Letting Go', 'What is something you finally stopped caring about, and how did it feel?'),

  // --- Hot Takes ---
  q('Hot Takes', 'Unpopular Opinion', 'What is an opinion you hold that would start an argument at a family dinner?'),
  q('Hot Takes', 'Overrated', 'What is something everyone loves that you honestly think is overrated?'),
  q('Hot Takes', 'Underrated', 'What is something totally underrated that more people should try?'),
  q('Hot Takes', 'Hill to Die On', 'What is a tiny, silly thing you will defend until the end?'),
  q('Hot Takes', 'Pet Peeve', 'What small habit in other people instantly annoys you?'),
  q('Hot Takes', 'Internet', 'What is a trend you hope disappears forever?'),
  q('Hot Takes', 'Food Fight', 'What food combination do you love that most people find weird?'),
  q('Hot Takes', 'Movie Take', 'Which famous movie or show do you think nobody actually enjoys?'),

  // --- Confessions (light) ---
  q('Confessions', 'Guilty Pleasure', 'What is your most embarrassing guilty-pleasure song, show or snack?'),
  q('Confessions', 'Little Lie', 'What is a harmless lie you have told so often it basically became true?'),
  q('Confessions', 'Cringe', 'What is a past phase of yours that makes you cringe now?'),
  q('Confessions', 'Bad Habit', 'What is a bad habit you have totally made peace with?'),
  q('Confessions', 'Close Call', 'What is the closest you have come to getting into serious trouble as a kid?'),
  q('Confessions', 'Secret Skill', 'What is a weirdly specific skill you have that nobody would guess?'),
  q('Confessions', 'Pretending', 'What is something you pretend to understand but secretly do not?'),
  q('Confessions', 'Petty', 'What is the pettiest thing you have ever done that you are still a little proud of?'),
  q('Confessions', 'Never Told', 'What is a funny story you have never told anyone because no one asked?'),

  // --- What If ---
  q('What If', 'Superpower', 'If you could have one useless superpower, what would it be?'),
  q('What If', 'Time Machine', 'If you could relive one ordinary day of your life, which would you pick?'),
  q('What If', 'Fresh Start', 'If you could restart somewhere new tomorrow with zero consequences, where would you go?'),
  q('What If', 'Billboard', 'If you could put one sentence on a billboard seen by millions, what would it say?'),
  q('What If', 'Swap', 'If you could swap lives with anyone for one week, who would it be and why?'),
  q('What If', 'Skill Download', 'If you could instantly master one skill, what would you choose?'),
  q('What If', 'Last Meal', 'If you could only eat one cuisine for the rest of your life, which one?'),
  q('What If', 'Famous', 'If you became famous tomorrow, what would you most likely be famous for?'),
  q('What If', 'Rulebook', 'If you made one law everyone had to follow, what would it be?'),

  // --- Moral Dilemmas ---
  q('Dilemmas', 'Honesty Test', 'You find a wallet with cash and an ID. Would you return the money too, honestly?'),
  q('Dilemmas', 'Loyalty', 'Would you tell a close friend a painful truth if it might end the friendship?'),
  q('Dilemmas', 'Fame vs Peace', 'Would you take huge success if it meant losing most of your privacy?'),
  q('Dilemmas', 'Knowledge', 'Would you want to know what people really think of you, even the harsh parts?'),
  q('Dilemmas', 'Second Chances', 'Is there anything that is truly unforgivable to you?'),
  q('Dilemmas', 'Fairness', 'Is it ever okay to break a rule if nobody gets hurt?'),
  q('Dilemmas', 'Memory', 'Would you erase your most embarrassing memory if it also erased what it taught you?'),

  // --- Dreams ---
  q('Dreams', 'Bucket List', 'What is one thing you really want to do before you are old?'),
  q('Dreams', 'Dream Job', 'If money did not matter, what would you do all day?'),
  q('Dreams', 'Someday', 'What is a place you have always dreamed of visiting, and what is stopping you?'),
  q('Dreams', 'Legacy', 'What would you like people to say about you when you are not in the room?'),
  q('Dreams', 'Next Year', 'What is one thing you hope is different in your life a year from now?'),
];

export const WYR_CARDS: WYRCard[] = [
  { optionA: 'Always know when someone is lying to you', optionB: 'Always get away with any lie you tell' },
  { optionA: 'Travel 100 years into the future', optionB: 'Travel 100 years into the past' },
  { optionA: 'Never need to sleep again', optionB: 'Never need to eat again' },
  { optionA: 'Speak every human language fluently', optionB: 'Understand what animals are saying' },
  { optionA: 'Have your search history made public', optionB: 'Have your camera roll made public' },
  { optionA: 'Be able to pause time', optionB: 'Be able to rewind time by 10 seconds' },
  { optionA: 'Live in a big city forever', optionB: 'Live in a quiet village forever' },
  { optionA: 'Be famous but misunderstood', optionB: 'Be unknown but truly understood' },
  { optionA: 'Lose all your old photos', optionB: 'Lose all your old messages' },
  { optionA: 'Have a rewind button for your life', optionB: 'Have a pause button for your life' },
  { optionA: 'Always say exactly what you think', optionB: 'Never be able to speak your mind' },
  { optionA: 'Know how every movie ends before watching', optionB: 'Never be able to rewatch anything' },
  { optionA: 'Have unlimited free flights', optionB: 'Have unlimited free food' },
  { optionA: 'Be the funniest person in the room', optionB: 'Be the smartest person in the room' },
  { optionA: 'Be stuck in an elevator with your ex', optionB: 'Be stuck in an elevator with your boss' },
  { optionA: 'Give up music forever', optionB: 'Give up movies and shows forever' },
  { optionA: 'Read minds but never turn it off', optionB: 'Be invisible but only when nobody is looking' },
  { optionA: 'Win the lottery once', optionB: 'Live twice as long' },
  { optionA: 'Have a personal chef', optionB: 'Have a personal driver' },
  { optionA: 'Only whisper for a year', optionB: 'Only shout for a year' },
  { optionA: 'Know the truth about one historical mystery', optionB: 'See one event 50 years in the future' },
  { optionA: 'Be a master of every instrument', optionB: 'Be a master of every sport' },
  { optionA: 'Live without the internet', optionB: 'Live without air conditioning and heating' },
  { optionA: 'Restart your life at 10 with your memories', optionB: 'Skip ahead 10 years right now' },
  { optionA: 'Have a dragon', optionB: 'Be a dragon' },
  { optionA: 'Always be 10 minutes late', optionB: 'Always be 30 minutes early' },
  { optionA: 'Only eat sweet food forever', optionB: 'Only eat salty food forever' },
  { optionA: 'Explore the deep ocean', optionB: 'Explore outer space' },
  { optionA: 'Have your life narrated out loud', optionB: 'Have a soundtrack only you can hear' },
  { optionA: 'Forget who you are for a day', optionB: 'Everyone else forgets who you are for a day' },
];

function makeDeck<T>(items: T[]): () => T {
  // Non-repeating shuffled deck: every item appears once before any repeats
  let order: number[] = [];
  return () => {
    if (order.length === 0) {
      order = items.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    return items[order.pop() as number];
  };
}

export const getNextDeepQuestion = makeDeck(DEEP_QUESTIONS);
export const getNextWYRCard = makeDeck(WYR_CARDS);
