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
 * Resumes the audio context on the first real gesture. Browsers refuse to start
 * one otherwise, so this is attached once by the app shell rather than by every
 * control that might make a noise.
 */
export function useAudioUnlock(enabled: boolean): void {
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
