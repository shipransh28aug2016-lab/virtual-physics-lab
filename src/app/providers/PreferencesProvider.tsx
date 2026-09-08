import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { readJSON, writeJSON } from '@/utils/storage';

export type Lang = 'en' | 'hi';

interface PreferencesState {
  lang: Lang;
  favourites: string[];
  recent: string[];
  motion: boolean;
  /** Apparatus sound cues. Off until the student asks for them. */
  sound: boolean;
  /** Master volume for those cues, 0–1. */
  volume: number;
}

export interface Preferences extends PreferencesState {
  setLang: (l: Lang) => void;
  toggleFavourite: (slug: string) => void;
  isFavourite: (slug: string) => boolean;
  touchRecent: (slug: string) => void;
  setMotion: (on: boolean) => void;
  setSound: (on: boolean) => void;
  setVolume: (v: number) => void;
}

const DEFAULTS: PreferencesState = {
  lang: 'en',
  favourites: [],
  recent: [],
  motion: true,
  sound: false,
  volume: 0.6
};
const KEY = 'preferences';
const RECENT_LIMIT = 8;

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreferencesState>(() => ({
    ...DEFAULTS,
    ...readJSON<Partial<PreferencesState>>(KEY, {})
  }));

  useEffect(() => {
    writeJSON(KEY, state);
  }, [state]);

  // The motion preference drives a document attribute so CSS can opt out too.
  useEffect(() => {
    document.documentElement.dataset.motion = state.motion ? 'on' : 'off';
    document.documentElement.lang = state.lang;
  }, [state.motion, state.lang]);

  const setLang = useCallback((lang: Lang) => setState((s) => ({ ...s, lang })), []);
  const setMotion = useCallback((motion: boolean) => setState((s) => ({ ...s, motion })), []);
  const setSound = useCallback((sound: boolean) => setState((s) => ({ ...s, sound })), []);
  const setVolume = useCallback(
    (volume: number) => setState((s) => ({ ...s, volume: Math.max(0, Math.min(1, volume)) })),
    []
  );

  const toggleFavourite = useCallback((slug: string) => {
    setState((s) => ({
      ...s,
      favourites: s.favourites.includes(slug)
        ? s.favourites.filter((f) => f !== slug)
        : [...s.favourites, slug]
    }));
  }, []);

  const touchRecent = useCallback((slug: string) => {
    setState((s) =>
      s.recent[0] === slug
        ? s
        : { ...s, recent: [slug, ...s.recent.filter((r) => r !== slug)].slice(0, RECENT_LIMIT) }
    );
  }, []);

  const value = useMemo<Preferences>(
    () => ({
      ...state,
      setLang,
      setMotion,
      setSound,
      setVolume,
      toggleFavourite,
      isFavourite: (slug: string) => state.favourites.includes(slug),
      touchRecent
    }),
    [state, setLang, setMotion, setSound, setVolume, toggleFavourite, touchRecent]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/** Falls back to inert defaults so a component can render outside the provider. */
export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (ctx) return ctx;
  return {
    ...DEFAULTS,
    setLang: () => undefined,
    setMotion: () => undefined,
    setSound: () => undefined,
    setVolume: () => undefined,
    toggleFavourite: () => undefined,
    isFavourite: () => false,
    touchRecent: () => undefined
  };
}
