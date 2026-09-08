import { useCallback, useEffect } from 'react';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import { labAudio } from './bus';
import type { CueName } from './sounds';

export type PlayCue = (name: CueName) => void;

/**
 * Binds the shared audio bus to the student's preferences.
 *
 * Returns a `play` that is always safe to call: it is a no-op when sound is
 * off, when Web Audio is unavailable, and inside tests. A caller therefore
 * never needs to guard a cue — which is what keeps the visual change and the
 * sound at the same call site.
 */
export function useSound(): { play: PlayCue; enabled: boolean } {
  const { sound, volume } = usePreferences();

  useEffect(() => {
    labAudio.configure({ enabled: sound, volume });
  }, [sound, volume]);

  const play = useCallback<PlayCue>(
    (name) => {
      labAudio.play(name);
    },
    []
  );

  return { play, enabled: sound };
}

/**
 * Applies the student's audio preference app-wide and resumes the context on
 * the first real gesture. Browsers refuse to start an AudioContext outside a
 * gesture, so the shell arms it once rather than every control that might make
 * a noise. Called by the app layout; `useSound` covers the same ground for a
 * component mounted without it.
 */
export function useAudioUnlock(enabled: boolean, volume = 0.6): void {
  useEffect(() => {
    labAudio.configure({ enabled, volume });
  }, [enabled, volume]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const unlock = () => labAudio.resume();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [enabled]);
}
