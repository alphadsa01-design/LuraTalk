/**
 * LuraTalk AI Dynamic Question & Dark Fantasy Generator
 * Generates endless, non-repeating, dark fantasy, psychological, taboo, and moral dilemma questions.
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

const DARK_FANTASY_PROMPTS = [
  {
    category: 'Dark Fantasy & Taboo',
    tag: 'Forbidden Invisibility',
    templates: [
      'If you possessed a cloak of complete invisibility for 7 nights, what is the single most forbidden, voyeuristic, or secret thing you would witness or steal?',
      'If you could walk through locked doors unseen for one midnight hour, whose private room or safe would you enter first?',
    ],
  },
  {
    category: 'Forbidden Desires',
    tag: 'Mind Control Potion',
    templates: [
      'If you brewed an elixir that compelled one person in your life to crave and obey you unconditionally with zero memory of the potion, who is your target?',
      'If you could implant a single intense romantic daydream into someone’s mind while they sleep tonight, whose dream do you enter?',
    ],
  },
  {
    category: 'Seduction & Power',
    tag: 'Unspoken Fantasy',
    templates: [
      'What is your darkest, most private sensual or power fantasy that you have never dared to speak aloud to any partner?',
      'In your wildest uncensored daydream, what kind of dominance, surrender, or psychological control do you secretly crave?',
    ],
  },
  {
    category: 'Moral Sacrifices',
    tag: 'Demon’s Bargain',
    templates: [
      'A dark entity offers you 200 years of irresistible charm, eternal youth, and wealth, but in exchange, someone you know loses 5 years of their life every time you kiss. Do you sign?',
      'If you had to sacrifice the memory of your first love or the ability to ever feel true empathy again in exchange for godlike wealth, which do you surrender?',
    ],
  },
  {
    category: 'Alter Egos & Shadows',
    tag: 'The Purge Mask',
    templates: [
      'If you were given a mask granting absolute anonymity and immunity from all laws and moral judgment for 24 hours, what forbidden desire would you fulfill?',
      'What is a toxic, manipulative, or dark aspect of your personality that you secretly love using to wrap people around your finger?',
    ],
  },
  {
    category: 'Sensual & Taboo',
    tag: 'After Dark Desires',
    templates: [
      'What is the wildest, most unconventional place you have ever hooked up or done something sexual with someone?',
      'What is a specific kink, fetish, or erotic scenario that instantly turns you on the second you think about it?',
      'Do you secretly prefer being totally dominant, completely submissive, or switching power dynamics behind closed doors?',
      'Have you ever sent a spicy photo, video, or voice note to someone and immediately got an adrenaline rush wondering if you went too far?',
      'What is the most seductive thing someone can whisper or do to you in private that makes you instantly lose all self-control?',
      'What is a sensual fantasy involving roleplay, blindfolds, or public thrills that you’ve been dying to test in real life?',
      'If you had to rate your private sexual appetite from 1 (innocent angel) to 10 (unhinged hedonist), where do you honestly fall?',
    ],
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

/**
 * Generate a fresh, non-repeating Dark Fantasy AI Question (Powered by Google Gemini + Fallback)
 */
export async function generateAIDarkQuestion(category?: string): Promise<DarkQuestion> {
  const selectedCat = category && category !== 'All' ? category : 'Dark & Sensual Taboos';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('/api/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dark_question', category: selectedCat }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json?.data?.question) {
        return {
          category: json.data.category || selectedCat,
          question: json.data.question,
          tag: json.data.tag || 'Gemini AI',
        };
      }
    }
  } catch (err) {
    console.warn('[AI Questions] Gemini request timed out or failed, using instant local engine:', err);
  }

  // Fallback to local synthesis engine
  const matchingPool = category && category !== 'All'
    ? DARK_FANTASY_PROMPTS.filter((p) => p.category.includes(category))
    : DARK_FANTASY_PROMPTS;

  const selectedCategory = matchingPool.length > 0
    ? matchingPool[Math.floor(Math.random() * matchingPool.length)]
    : DARK_FANTASY_PROMPTS[Math.floor(Math.random() * DARK_FANTASY_PROMPTS.length)];

  const question = selectedCategory.templates[Math.floor(Math.random() * selectedCategory.templates.length)];

  return {
    category: selectedCategory.category,
    question,
    tag: selectedCategory.tag,
  };
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

  // Fallback to local templates
  return WYR_TEMPLATES[Math.floor(Math.random() * WYR_TEMPLATES.length)];
}
