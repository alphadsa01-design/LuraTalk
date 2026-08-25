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
  // =========================================================================
  // --- 1. DARK & SENSUAL TABOOS (30 Questions) ---
  // =========================================================================
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is a specific kink, fetish, or erotic fantasy that instantly turns you on the second you think about it in private?',
    tag: 'Unfiltered Desire',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Do you secretly prefer being totally dominant, completely submissive, or switching power dynamics behind closed doors?',
    tag: 'Power Dynamic',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the wildest, most unconventional place you have ever hooked up or done something forbidden with someone?',
    tag: 'Wild Encounters',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever sent a spicy photo, video, or voice note to someone and immediately got an adrenaline rush wondering if you went too far?',
    tag: 'After Dark Confession',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the most seductive thing someone can whisper or do to you in private that makes you instantly lose all self-control?',
    tag: 'Losing Control',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'If you had to rate your private sexual appetite from 1 (innocent angel) to 10 (unhinged hedonist), where do you honestly fall?',
    tag: 'Appetite Score',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever had intense, intoxicating sexual chemistry with someone you genuinely disliked or knew was completely toxic for you?',
    tag: 'Forbidden Magnetism',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is a sensual dark fantasy involving roleplay, blindfolds, or public thrills that you’ve been dying to test in real life?',
    tag: 'Secret Kink',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever hooked up with a complete stranger or had a one-night stand that you still secretly daydream about to this day?',
    tag: 'Stranger Memories',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the biggest sexual regret or most awkward bedroom moment you’ve had that you swore you would never tell anyone?',
    tag: 'Midnight Regret',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever thought about someone else entirely while being intimate with a current partner?',
    tag: 'Intimate Betrayal',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the most sensitive or reactive spot on your body that drives you crazy when touched in the dark?',
    tag: 'Hidden Weakness',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Do you enjoy the danger of almost getting caught while being intimate, or does it kill the mood for you?',
    tag: 'Adrenaline Rush',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is a sensual boundary you used to think was too extreme, but now secretly want to try?',
    tag: 'Shifting Lines',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'If a partner wanted to tie your hands, blindfold you, and have complete control for one night, would you surrender?',
    tag: 'Total Surrender',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the dirtiest thought you have had about someone in the last 48 hours?',
    tag: 'Recent Impulse',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever felt an unexpected surge of attraction toward someone strictly because they treated you cold or dominant?',
    tag: 'Toxic Allure',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is a piece of lingerie, outfit, or accessory that you find utterly intoxicating on a partner?',
    tag: 'Visual Euphoria',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever recorded a private video or voice memo with someone that you made them swear to delete?',
    tag: 'Private Tape',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Do you prefer intense dirty talk during intimacy, or do you prefer heavy breathing and complete silent tension?',
    tag: 'Vocal vs Silent',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the longest you have ever gone in a state of intense sexual tension with someone before finally breaking and hooking up?',
    tag: 'Boiling Point',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever kissed someone so passionately that you lost all concept of time, location, and surroundings?',
    tag: 'Drunken Touch',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the most taboo category in your private video or browser history that you would die if anyone ever uncovered?',
    tag: 'Incognito Shame',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'If someone you found deeply attractive whispered an order to undress slowly in the dark right now, would you obey?',
    tag: 'Dark Command',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever pretended to be innocent in front of family or friends while living a completely wild secret nightlife?',
    tag: 'Double Life',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is an unconventional body part or trait (hands, voice, collarbones, veins) that gets you intensely aroused?',
    tag: 'Unusual Magnet',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever used ice, wax, or temperature play to push sensory limits in the bedroom?',
    tag: 'Sensory Fire',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is a secret nickname or term of endearment in bed that makes your heart race instantly?',
    tag: 'Bedtime Name',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'Have you ever had a crush on someone exclusively because of how good you imagined they would be in bed?',
    tag: 'Carnal Curiosity',
  },
  {
    category: 'Dark & Sensual Taboos',
    question: 'What is the most daring text message or photo you have ever received from someone out of nowhere?',
    tag: 'Midnight Drop',
  },

  // =========================================================================
  // --- 2. FORBIDDEN DESIRES & TEMPTATIONS (28 Questions) ---
  // =========================================================================
  {
    category: 'Forbidden Desires',
    question: 'If you had a potion that would make one person of your choice obsessively, unconditionally devoted to your every whim forever, whose name goes on the bottle?',
    tag: 'Mind Control Potion',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever had an intense, forbidden sexual craving for someone you knew was strictly off-limits (a friend’s partner, an authority figure, or an ex)?',
    tag: 'Forbidden Chemistry',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is something taboo or scandalous that turns you on in secret, but you would violently deny if asked in public?',
    tag: 'Guilty Craving',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever fantasized about being caught doing something dangerously naughty with someone in a semi-public place?',
    tag: 'Exhibitionist Thrill',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is a secret roleplay, dark dynamic, or boundary you desperately want to explore in the dark, but feel too shy or judged to request?',
    tag: 'Midnight Kink',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever used your looks, flirtation, or charm to get out of serious trouble or manipulate someone into doing your work?',
    tag: 'Seductive Leverage',
  },
  {
    category: 'Forbidden Desires',
    question: 'If you could erase one specific person’s memories of an intimate encounter you had with them, would you do it?',
    tag: 'Memory Wipe',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever stalked someone’s private photos or social presence in the middle of the night out of sheer obsession?',
    tag: 'Midnight Lurker',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is a forbidden crush you had that was so wrong you never spoke a word of it to anyone?',
    tag: 'Buried Attraction',
  },
  {
    category: 'Forbidden Desires',
    question: 'If someone gave you a truth crystal that forced anyone you kiss to confess their dirtiest secret, whose secret do you unlock first?',
    tag: 'Kiss of Truth',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever deliberately flirted with someone just to make another person jealous and furious?',
    tag: 'Jealousy Fuel',
  },
  {
    category: 'Forbidden Desires',
    question: 'If an anonymous benefactor offered you $100,000 for a single no-strings weekend with zero questions asked, do you take it?',
    tag: 'Indecent Proposal',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is the most morally questionable thing you have ever done purely out of horniness or impulse?',
    tag: 'Impulsive Dark',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever kept a secret stash of photos, videos, or messages that would completely ruin you if discovered?',
    tag: 'The Hidden Vault',
  },
  {
    category: 'Forbidden Desires',
    question: 'If you could read the private diary or search history of anyone in your contact list with zero trace, whose life do you read?',
    tag: 'Diary Peeker',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever wanted to be the “villain” or the homewrecker in someone else’s story just to prove you could have them?',
    tag: 'Temptation Siren',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is the closest you have ever come to cheating on a partner or crossing an unforgivable physical line?',
    tag: 'The Brink',
  },
  {
    category: 'Forbidden Desires',
    question: 'If you could have a one-night secret pass where the universe reset itself the next morning with zero memories, what would you do?',
    tag: 'Universal Reset',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever developed an intense physical obsession with someone purely based on their scent or voice alone?',
    tag: 'Pheromone Trap',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is a secret romantic lie you told someone that made them fall head over heels in love with you?',
    tag: 'The Golden Lie',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever kept touching or kissing someone after they asked you to tease them, enjoying testing their self-restraint?',
    tag: 'Torture of Desire',
  },
  {
    category: 'Forbidden Desires',
    question: 'If you had to pick between a lifetime of passionate, toxic sex or boring, peaceful stability, which do you crave deep down?',
    tag: 'Chaos vs Peace',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever eavesdropped on someone else being intimate in the next room and secretly enjoyed listening?',
    tag: 'Eavesdropper',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is a private fantasy that involves multiple partners or a voyeuristic audience that you secretly think about?',
    tag: 'Audience Thrill',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever accepted a drink, gift, or favor from someone you had zero intention of ever giving a chance to?',
    tag: 'Free Ride',
  },
  {
    category: 'Forbidden Desires',
    question: 'If you could steal the romantic partner of your worst enemy right in front of them, would you do it for vengeance?',
    tag: 'Vendetta Seduction',
  },
  {
    category: 'Forbidden Desires',
    question: 'What is an erotic boundary you secretly hope a future lover pushes you to cross against your polite hesitation?',
    tag: 'The Push',
  },
  {
    category: 'Forbidden Desires',
    question: 'Have you ever pretended to fall asleep just to see what someone would do or say while watching you?',
    tag: 'Sleeping Test',
  },

  // =========================================================================
  // --- 3. SEDUCTION & POWER DYNAMICS (26 Questions) ---
  // =========================================================================
  {
    category: 'Seduction & Power',
    question: 'What is your darkest, most private sensual or power fantasy that you have never dared to confess to any living person?',
    tag: 'Unspoken Fantasy',
  },
  {
    category: 'Seduction & Power',
    question: 'In your wildest, uncensored daydream, what kind of dominance, power, or control do you secretly crave having over others?',
    tag: 'Shadow Dominance',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever deliberately toyed with someone’s emotions, led them on, or seduced them just to feel desired, powerful, and in control?',
    tag: 'Emotional Siren',
  },
  {
    category: 'Seduction & Power',
    question: 'Do you feel more aroused when you are giving orders or when someone is telling you exactly what to do?',
    tag: 'Command vs Obey',
  },
  {
    category: 'Seduction & Power',
    question: 'What is your signature seductive move or behavior that you know almost nobody can resist?',
    tag: 'Fatal Charm',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever enjoyed the feeling of someone crying, begging, or yearning desperately for your affection?',
    tag: 'Cruel Devotion',
  },
  {
    category: 'Seduction & Power',
    question: 'In the bedroom, do you prefer slow, intense psychological tease or rough, demanding physical passion?',
    tag: 'Tease vs Force',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever intentionally dressed in something scandalous specifically so one particular person couldn’t focus on anything else?',
    tag: 'Calculated Allure',
  },
  {
    category: 'Seduction & Power',
    question: 'If you had to choose between being loved innocently or being lusted after with uncontrollable obsession, which do you pick?',
    tag: 'Love vs Lust',
  },
  {
    category: 'Seduction & Power',
    question: 'What is a secret phrase or tone of voice that makes your knees weak when spoken right into your ear?',
    tag: 'Vocal Trigger',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever maintained eye contact with someone across a crowded room and both of you instantly knew you wanted to hook up?',
    tag: 'Silent Connection',
  },
  {
    category: 'Seduction & Power',
    question: 'Do you prefer leaving marks (scratches, bites) on your partner, or having them leave their mark on you as a trophy?',
    tag: 'Mark of Ownership',
  },
  {
    category: 'Seduction & Power',
    question: 'If your partner locked your hands behind your back and leaned in slowly, what is the first thing you want them to whisper?',
    tag: 'Restrained Whisper',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever used intimacy as a weapon or a reward to get what you wanted in a relationship?',
    tag: 'Carnal Currency',
  },
  {
    category: 'Seduction & Power',
    question: 'Do you get more satisfaction from breaking a shy person out of their shell or breaking a proud person down to their knees?',
    tag: 'Conqueror’s High',
  },
  {
    category: 'Seduction & Power',
    question: 'What is a non-sexual situation (work, negotiations, arguments) where you used raw sexual tension to win?',
    tag: 'Boardroom Magnet',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever known someone was head over heels for you, and kept them on a string just for an ego boost?',
    tag: 'Ego Puppet',
  },
  {
    category: 'Seduction & Power',
    question: 'What is the most vulnerable, helpless position a partner can put you in that makes your heart pound through your chest?',
    tag: 'Pure Vulnerability',
  },
  {
    category: 'Seduction & Power',
    question: 'Do you like when someone grabs you by the waist, hair, or neck with sudden firm possession, or do you prefer delicate gentleness?',
    tag: 'Grip of Desire',
  },
  {
    category: 'Seduction & Power',
    question: 'What is the most dangerous situation where you and someone else secretly engaged in hands-under-the-table touch?',
    tag: 'Undercover Touch',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever made someone wait days or weeks for intimacy intentionally just to drive them utterly mad with anticipation?',
    tag: 'The Long Agony',
  },
  {
    category: 'Seduction & Power',
    question: 'If you had to surrender all control in bed to a stranger for 30 minutes, what is the one safe-word boundary you’d set?',
    tag: 'Contract of Surrender',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever looked at someone and thought: “I could ruin your entire life if I let myself”, and smiled?',
    tag: 'Predatory Smirk',
  },
  {
    category: 'Seduction & Power',
    question: 'What kind of praise in the bedroom makes you feel like an absolute god or goddess?',
    tag: 'Deity Praise',
  },
  {
    category: 'Seduction & Power',
    question: 'Have you ever felt a sudden rush of power when someone lost the ability to speak properly after kissing you?',
    tag: 'Breathless Prey',
  },
  {
    category: 'Seduction & Power',
    question: 'If you were given total dominion over one person’s private life for 7 days, how strict or permissive would you be?',
    tag: 'The Sovereign Master',
  },

  // =========================================================================
  // --- 4. DARK FANTASIES & ALTER EGOS (28 Questions) ---
  // =========================================================================
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you possessed a cloak of complete invisibility for 7 consecutive nights, what is the most forbidden or secretive thing you would watch, do, or take?',
    tag: 'Forbidden Invisibility',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you were given a mask granting absolute immunity from all legal, moral, and social consequences for 24 hours, what dark sexual or hedonistic impulse would you satisfy?',
    tag: 'The Purge Mask',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If your dark fantasy alter-ego had a name and a personality, what would they do in the bedroom that your normal self is too polite to try?',
    tag: 'The Dark Persona',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could swap bodies with anyone in your life for 24 hours to explore their private desires, bedroom secrets, and fantasies, whose body would you inhabit?',
    tag: 'Body Stealer',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'A dark entity offers you absolute wealth and beauty forever, but in exchange, one random person in your city dies painfully every month. Do you accept?',
    tag: 'Demon’s Bargain',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If our conversation right now was completely untraceable and vanished forever in 5 minutes, what is the single darkest sensual confession you would whisper to me?',
    tag: 'Ephemeral Confession',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'Would you rather have a supernatural vampire lover who is violently possessive of you, or a shapeshifter who turns into your wildest fantasy on demand?',
    tag: 'Creature of the Night',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could freeze time for 60 minutes every night and nobody else would ever know, how would you spend that hour?',
    tag: 'Frozen Midnight',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could read the private, uncensored sexual fantasies of anyone you make eye contact with, would you want that superpower?',
    tag: 'Mind Peeker',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'Have you ever had a dream so vivid, sensual, and taboo with someone in real life that you couldn’t look them in the eye the next day?',
    tag: 'The Dreamer’s Guilt',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could trade 5 years off your life to experience one night of the most mind-shattering, godlike pleasure imaginable, do you sign?',
    tag: 'Ecstasy Trade',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'What is a secret lie you told that was so convincing and devious that everyone still believes it to this day, and you take dark pride in it?',
    tag: 'Master Manipulator',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you were offered a truth serum to ask me (your stranger partner right now) ANY single unfiltered, private question with 100% honesty, what would you ask?',
    tag: 'Veritas Serum',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could live inside an intoxicating, hyper-sensory dark fantasy simulation forever where every fantasy comes true, would you ever return to reality?',
    tag: 'Sensory Matrix',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could summon an incubus or succubus that fulfilled your every unspoken bedroom desire with zero attachment, would you make the pact?',
    tag: 'Midnight Summoning',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'Have you ever felt a sudden dark impulse to destroy a good relationship just to feel the thrill of drama, chaos, and raw passion?',
    tag: 'Self-Sabotage Rush',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you were offered a mirror that showed who currently has secret sexual fantasies about you, whose face do you look for first?',
    tag: 'The Mirror of Desire',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'Would you rather be trapped in a luxury dungeon with someone you passionately desire for a month, or roam free alone forever?',
    tag: 'Gilded Cage',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'What is the most twisted moral dilemma you have ever faced where your dark selfish desires won over your good conscience?',
    tag: 'Victory of the Shadow',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could whisper a command directly into someone’s ear while they slept that they would obey without question the next morning, what command do you whisper?',
    tag: 'Sleepwalker Charm',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'Have you ever wondered what it would feel like to surrender all moral restraint and live purely for hedonistic indulgence for one month?',
    tag: 'The Hedonist’s Vacation',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you found out you only had 24 hours left to live, what is the single most taboo or reckless sexual desire you would immediately fulfill?',
    tag: 'Final Midnight',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could possess a charm that made your voice completely intoxicating and irresistible to anyone who hears it, how would you use it?',
    tag: 'Siren’s Voice',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'Have you ever had an intense romantic obsession with a fictional character, villain, or monster that shocked yourself?',
    tag: 'Monster Lover',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you were cursed to only be intimate in complete darkness without ever seeing each other’s faces, would the anonymity enhance your pleasure?',
    tag: 'The Velvet Abyss',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If you could drink a wine that lets you feel everything your partner feels during intimacy with 10x intensity, would you drink it?',
    tag: 'Empathic Wine',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'What is the darkest secret about your true nature that nobody in your normal daily life suspects even for a second?',
    tag: 'The Mask Behind The Mask',
  },
  {
    category: 'Dark Fantasies & Alter Egos',
    question: 'If I asked you to tell me the single most shameless, unedited fantasy on your mind right now without holding back, would you dare?',
    tag: 'The Final Threshold',
  },
];

export const DEFAULT_WYR_CARDS = [
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
  {
    optionA: 'Erase all memory of your worst mistake from the world',
    optionB: 'See 10 years into the future of anyone you lock eyes with',
  },
  {
    optionA: 'Have a dark alter-ego that does all your dirty work while you sleep',
    optionB: 'Read the minds of anyone who is currently thinking about you sexually',
  },
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
