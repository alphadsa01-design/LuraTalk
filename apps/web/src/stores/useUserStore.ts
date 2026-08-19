import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserMood = 'chill' | 'funny' | 'energetic' | 'curious' | 'deep' | 'talkative' | 'quiet' | 'need_to_talk';
export type ConversationIntention = 'casual' | 'friends' | 'deep' | 'language' | 'gaming' | 'music' | 'movies' | 'travel' | 'advice' | 'debate' | 'learning' | 'dating' | 'fun';

export interface AvatarPreset {
  id: string;
  name: string;
  seed: string;
  gradient: string;
}

export const getDicebearAvatarUrl = (seed: string) => {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed || 'Aura')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'felix', name: 'Felix', seed: 'Felix', gradient: 'from-indigo-500 via-purple-500 to-pink-500' },
  { id: 'aria', name: 'Aria', seed: 'Aria', gradient: 'from-cyan-400 via-teal-500 to-indigo-600' },
  { id: 'leo', name: 'Leo', seed: 'Leo', gradient: 'from-pink-500 via-rose-500 to-purple-600' },
  { id: 'zoe', name: 'Zoe', seed: 'Zoe', gradient: 'from-yellow-400 via-amber-500 to-cyan-500' },
  { id: 'maya', name: 'Maya', seed: 'Maya', gradient: 'from-purple-500 via-fuchsia-500 to-pink-600' },
  { id: 'kai', name: 'Kai', seed: 'Kai', gradient: 'from-blue-500 via-indigo-600 to-violet-700' },
  { id: 'nico', name: 'Nico', seed: 'Nico', gradient: 'from-emerald-400 via-teal-500 to-cyan-600' },
  { id: 'alex', name: 'Alex', seed: 'Alex', gradient: 'from-orange-400 via-amber-500 to-rose-500' },
  { id: 'sam', name: 'Sam', seed: 'Sam', gradient: 'from-indigo-600 via-blue-500 to-cyan-400' },
  { id: 'elena', name: 'Elena', seed: 'Elena', gradient: 'from-rose-500 via-pink-500 to-amber-500' },
  { id: 'jordan', name: 'Jordan', seed: 'Jordan', gradient: 'from-sky-400 via-cyan-500 to-indigo-600' },
  { id: 'luna', name: 'Luna', seed: 'Luna', gradient: 'from-amber-500 via-orange-500 to-purple-600' },
];

export interface UserState {
  token: string | null;
  user: any | null;
  avatarSeed: string;
  avatarId: string;
  nativeLanguage: string;
  targetLanguages: string[];
  interests: string[];
  mood: UserMood;
  intention: ConversationIntention;
  countryPreference: 'worldwide' | 'same_country' | 'specific_country';
  preferredCountry?: string;
  oneQuestionAnswer: string;
  enableAiAssistant: boolean;
  enableLiveTranslation: boolean;
  targetTranslationLanguage: string;

  setAuth: (token: string, user: any) => void;
  setAvatar: (avatarId: string, seed?: string) => void;
  setAvatarSeed: (seed: string) => void;
  rollRandomAvatar: () => string;
  updatePreferences: (prefs: Partial<UserState>) => void;
  addInterest: (interest: string) => void;
  removeInterest: (interest: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      avatarSeed: 'Felix',
      avatarId: 'felix',
      nativeLanguage: 'en',
      targetLanguages: ['en', 'es'],
      interests: ['gaming', 'technology', 'music', 'movies'],
      mood: 'chill',
      intention: 'casual',
      countryPreference: 'worldwide',
      oneQuestionAnswer: '',
      enableAiAssistant: true,
      enableLiveTranslation: false,
      targetTranslationLanguage: 'es',

      setAuth: (token, user) => {
        const seed = user?.avatarSeed || user?.username || 'Felix';
        set({ token, user, avatarSeed: seed, avatarId: user?.avatarId || 'felix' });
      },
      setAvatar: (avatarId, seed) => {
        const found = AVATAR_PRESETS.find((a) => a.id === avatarId);
        const chosenSeed = seed || found?.seed || avatarId;
        set((state) => ({
          avatarId,
          avatarSeed: chosenSeed,
          user: state.user ? { ...state.user, avatarId, avatarSeed: chosenSeed } : state.user,
        }));
      },
      setAvatarSeed: (avatarSeed) =>
        set((state) => ({
          avatarSeed,
          user: state.user ? { ...state.user, avatarSeed } : state.user,
        })),
      rollRandomAvatar: () => {
        const randomSeeds = ['Felix', 'Aria', 'Leo', 'Zoe', 'Maya', 'Kai', 'Nico', 'Alex', 'Sam', 'Elena', 'Jordan', 'Luna', 'Milo', 'Chloe', 'Liam', 'Emma'];
        const current = get().avatarSeed;
        const pool = randomSeeds.filter((s) => s !== current);
        const chosenSeed = pool[Math.floor(Math.random() * pool.length)] || `User_${Math.floor(Math.random() * 1000)}`;
        const preset = AVATAR_PRESETS.find((p) => p.seed.toLowerCase() === chosenSeed.toLowerCase());
        
        set((state) => ({
          avatarSeed: chosenSeed,
          avatarId: preset ? preset.id : 'custom',
          user: state.user ? { ...state.user, avatarSeed: chosenSeed, avatarId: preset ? preset.id : 'custom' } : state.user,
        }));
        return chosenSeed;
      },
      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
      addInterest: (interest) =>
        set((state) => ({
          interests: state.interests.includes(interest) ? state.interests : [...state.interests, interest],
        })),
      removeInterest: (interest) =>
        set((state) => ({
          interests: state.interests.filter((i) => i !== interest),
        })),
    }),
    {
      name: 'luratalk_user_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        avatarSeed: state.avatarSeed,
        avatarId: state.avatarId,
        nativeLanguage: state.nativeLanguage,
        targetLanguages: state.targetLanguages,
        interests: state.interests,
        mood: state.mood,
        intention: state.intention,
        countryPreference: state.countryPreference,
        preferredCountry: state.preferredCountry,
        oneQuestionAnswer: state.oneQuestionAnswer,
        enableAiAssistant: state.enableAiAssistant,
        enableLiveTranslation: state.enableLiveTranslation,
        targetTranslationLanguage: state.targetTranslationLanguage,
      }),
    }
  )
);
