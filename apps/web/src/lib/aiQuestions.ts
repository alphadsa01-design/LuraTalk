/**
 * LuraTalk AI Dynamic Question & Dark Fantasy Generator
 * Generates endless, non-repeating, dark fantasy, sexy, seductive, and taboo questions.
 */

export interface DarkQuestion {
  category: string;
  question: string;
  tag: string;
}

export interface WYRCard {
  optionA: string;
  optionB: string;
}

export const ALL_DARK_QUESTIONS: DarkQuestion[] = [
  // --- Dark Fantasy & Seduction ---
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you possessed a cloak of complete invisibility for 7 nights, what is the single most forbidden, voyeuristic, or secret thing you would witness or do?',
    tag: 'Forbidden Invisibility',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you brewed an elixir that compelled one person in your life to crave and obey you unconditionally with zero memory of the potion, who is your target?',
    tag: 'Mind Control Potion',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is your darkest, most private sensual or power fantasy that you have never dared to speak aloud to any partner?',
    tag: 'Unspoken Fantasy',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'In your wildest uncensored daydream, what kind of dominance, surrender, or psychological control do you secretly crave in the dark?',
    tag: 'Sensual Power',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'A dark entity offers you 200 years of irresistible charm, eternal youth, and wealth, but someone loses 5 years of their life every time you kiss. Do you sign?',
    tag: 'Demon’s Bargain',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you were given a mask granting absolute anonymity and immunity from all laws and moral judgment for 24 hours, what forbidden desire would you fulfill?',
    tag: 'The Purge Mask',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is a specific kink, fetish, or erotic scenario that instantly turns you on the second you think about it in private?',
    tag: 'Secret Kink',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Do you secretly prefer being totally dominant, completely submissive, or switching power dynamics behind closed doors?',
    tag: 'Power Dynamic',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is the wildest, most unconventional place you have ever hooked up or done something forbidden with someone?',
    tag: 'Wild Encounters',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever sent a spicy photo, video, or voice note to someone and immediately got an adrenaline rush wondering if you went too far?',
    tag: 'After Dark Confession',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is the most seductive thing someone can whisper or do to you in private that makes you instantly lose all self-control?',
    tag: 'Losing Control',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is a sensual fantasy involving roleplay, blindfolds, or public thrills that you’ve been dying to test in real life?',
    tag: 'Midnight Thrill',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you had to rate your private sexual appetite from 1 (innocent angel) to 10 (unhinged hedonist), where do you honestly fall?',
    tag: 'Appetite Score',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever had intense, intoxicating sexual chemistry with someone you genuinely disliked or knew was completely toxic for you?',
    tag: 'Toxic Magnetism',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever hooked up with a complete stranger or had a one-night encounter that you still secretly daydream about to this day?',
    tag: 'Stranger Memories',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is the most sensitive or reactive spot on your body that drives you crazy when touched slowly in the dark?',
    tag: 'Hidden Weakness',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If a partner wanted to tie your hands, blindfold you, and have complete control for one night, would you surrender?',
    tag: 'Total Surrender',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is the dirtiest thought you have had about someone in the last 48 hours?',
    tag: 'Recent Impulse',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Do you prefer intense dirty talk during intimacy, or do you prefer heavy breathing and complete silent tension?',
    tag: 'Vocal vs Silent',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is the longest you have ever gone in a state of intense sexual tension with someone before finally breaking and hooking up?',
    tag: 'Boiling Point',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If someone you found deeply attractive whispered an order to undress slowly in the dark right now, would you obey?',
    tag: 'Dark Command',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is an unconventional body part or trait (hands, voice, collarbones, neck) that gets you intensely aroused?',
    tag: 'Unusual Magnet',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever fantasized about being caught doing something dangerously naughty with someone in a semi-public place?',
    tag: 'Exhibitionist Thrill',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you could implant a single intense romantic daydream into someone’s mind while they sleep tonight, whose dream do you enter?',
    tag: 'Dream Infiltration',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever used your looks, flirtation, or charm to get out of serious trouble or manipulate someone into doing your work?',
    tag: 'Seductive Leverage',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is a secret phrase or tone of voice that makes your knees weak when spoken right against your neck?',
    tag: 'Vocal Trigger',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you had to choose between a partner who is submissive and obeys your every whim or a dominant partner who takes complete control, which do you pick?',
    tag: 'Control Choice',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever had a crush on someone exclusively because of how good you imagined they would be in bed?',
    tag: 'Carnal Curiosity',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is the most daring text message, audio note, or photo you have ever received out of nowhere?',
    tag: 'Midnight Drop',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Do you prefer slow, intense psychological teasing or rough, demanding physical passion?',
    tag: 'Tease vs Passion',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is an erotic boundary you secretly hope a future lover pushes you to cross against your polite hesitation?',
    tag: 'The Push',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you were given a truth serum right now, what is the one secret you would fight hardest not to confess?',
    tag: 'Buried Truth',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever kept touching or teasing someone after they asked you to stop because you loved seeing them lose control?',
    tag: 'Torture of Desire',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is something taboo or scandalous that turns you on in secret, but you would deny if asked in public?',
    tag: 'Guilty Craving',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If we were in a dark room together right now with no cameras and no witnesses, what is the first boundary you would want to test?',
    tag: 'Midnight Encounter',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Do you get more satisfaction from breaking a shy person out of their shell or breaking a proud person down to their knees?',
    tag: 'Conqueror’s High',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'What is a piece of clothing, lingerie, or scent that makes you completely powerless against someone?',
    tag: 'Visual Euphoria',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'Have you ever kissed someone so passionately that you forgot who and where you were?',
    tag: 'Drunken Touch',
  },
  {
    category: 'Dark Fantasy & Sexy',
    question: 'If you could have a midnight pass where you could do anything with anyone and the world reset with zero memory at dawn, what would you do?',
    tag: 'Reset Pass',
  },
];

const WYR_TEMPLATES: WYRCard[] = [
  {
    optionA: 'Possess mind control over anyone you touch',
    optionB: 'Have absolute immortality with eternal youth & peak health',
  },
  {
    optionA: 'Have a lover who is a dangerous vampire devoted only to you',
    optionB: 'Have a magical siren who satisfies your every dark craving on command',
  },
  {
    optionA: 'Know the deepest sexual and dark secrets of everyone you meet',
    optionB: 'Have everyone find you irresistibly attractive and magnetic at all times',
  },
  {
    optionA: 'Live 100 years inside an intoxicating, hyper-sensory dark fantasy dream',
    optionB: 'Endure brutal, boring reality for 80 years',
  },
  {
    optionA: 'Be able to turn invisible whenever you are doing something forbidden',
    optionB: 'Be able to freeze time for 1 hour every night with zero cameras or witnesses',
  },
  {
    optionA: 'Have your partner be submissively obsessed with your every whim',
    optionB: 'Have a powerful, dominant partner who takes complete control in the dark',
  },
  {
    optionA: 'Gain $50 Million but your search history is published on the front page of the internet',
    optionB: 'Live broke but your private secrets remain buried in the grave forever',
  },
  {
    optionA: 'Relive your wildest romantic encounter on loop for eternity',
    optionB: 'Experience an entirely new forbidden adventure with a stranger every week',
  },
];

// Non-repeating randomized shuffle deck tracker
let seenQuestionIndices = new Set<number>();

export function getNextCuratedDarkQuestion(): DarkQuestion {
  if (seenQuestionIndices.size >= ALL_DARK_QUESTIONS.length) {
    seenQuestionIndices.clear();
  }

  const availableIndices: number[] = [];
  for (let i = 0; i < ALL_DARK_QUESTIONS.length; i++) {
    if (!seenQuestionIndices.has(i)) {
      availableIndices.push(i);
    }
  }

  const randIdx =
    availableIndices.length > 0
      ? availableIndices[Math.floor(Math.random() * availableIndices.length)]
      : Math.floor(Math.random() * ALL_DARK_QUESTIONS.length);

  seenQuestionIndices.add(randIdx);
  return ALL_DARK_QUESTIONS[randIdx];
}

let seenWYRIndices = new Set<number>();

export function getNextCuratedWYRCard(): WYRCard {
  if (seenWYRIndices.size >= WYR_TEMPLATES.length) {
    seenWYRIndices.clear();
  }

  const availableIndices: number[] = [];
  for (let i = 0; i < WYR_TEMPLATES.length; i++) {
    if (!seenWYRIndices.has(i)) {
      availableIndices.push(i);
    }
  }

  const randIdx =
    availableIndices.length > 0
      ? availableIndices[Math.floor(Math.random() * availableIndices.length)]
      : Math.floor(Math.random() * WYR_TEMPLATES.length);

  seenWYRIndices.add(randIdx);
  return WYR_TEMPLATES[randIdx];
}

/**
 * Generate a fresh, non-repeating Dark Fantasy AI Question (Powered by Google Gemini + Curated Fallback)
 */
export async function generateAIDarkQuestion(): Promise<DarkQuestion> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('/api/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dark_question', category: 'Dark Fantasy & Sexy' }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json?.data?.question) {
        return {
          category: json.data.category || 'Dark Fantasy & Sexy',
          question: json.data.question,
          tag: json.data.tag || 'Unfiltered AI',
        };
      }
    }
  } catch (err) {
    console.warn('[AI Questions] Gemini request timed out or failed, using instant curated non-repeating engine:', err);
  }

  return getNextCuratedDarkQuestion();
}

/**
 * Generate a fresh, non-repeating Would You Rather Dark Fantasy Card (Powered by Google Gemini + Fallback)
 */
export async function generateAIWYRCard(): Promise<WYRCard> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('/api/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'wyr' }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json?.data?.optionA && json?.data?.optionB) {
        return {
          optionA: json.data.optionA,
          optionB: json.data.optionB,
        };
      }
    }
  } catch (err) {
    console.warn('[AI Questions] Gemini WYR request timed out or failed, using instant local engine:', err);
  }

  return getNextCuratedWYRCard();
}
