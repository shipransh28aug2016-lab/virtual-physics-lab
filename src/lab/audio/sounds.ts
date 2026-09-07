/**
 * Every cue the lab can make, described as data.
 *
 * Nothing here is a file. A recorded asset would have to be base64-inlined into
 * the portable single-file build, so each cue is a short synthesis recipe the
 * bus renders through Web Audio on demand. See `docs/audio/README.md`.
 */

export type CueName =
  | 'switchOn'
  | 'switchOff'
  | 'plug'
  | 'unplug'
  | 'needle'
  | 'record'
  | 'error'
  | 'success';

export type Layer =
  | { kind: 'noise'; duration: number; filter: number; q: number; gain: number; decay: number }
  | { kind: 'tone'; freq: number; toFreq?: number; duration: number; gain: number; type: OscillatorType; delay?: number };

export interface Cue {
  layers: Layer[];
  /** What the sound tells the student. A cue with no meaning does not ship. */
  meaning: string;
}

/**
 * Mechanical cues are filtered noise bursts; confirmations are two short tones.
 * Levels are deliberately low: audio is a second channel, never the only one.
 */
export const CUES: Record<CueName, Cue> = {
  switchOn: {
    meaning: 'the key was closed',
    layers: [
      { kind: 'noise', duration: 0.02, filter: 2600, q: 1.6, gain: 0.5, decay: 0.016 },
      { kind: 'tone', freq: 320, duration: 0.03, gain: 0.16, type: 'square' }
    ]
  },
  switchOff: {
    meaning: 'the key was opened',
    layers: [
      { kind: 'noise', duration: 0.018, filter: 1900, q: 1.4, gain: 0.42, decay: 0.014 },
      { kind: 'tone', freq: 220, duration: 0.028, gain: 0.13, type: 'square' }
    ]
  },
  plug: {
    meaning: 'a lead seated in a terminal',
    layers: [
      { kind: 'noise', duration: 0.03, filter: 1200, q: 0.9, gain: 0.55, decay: 0.026 },
      { kind: 'tone', freq: 150, toFreq: 96, duration: 0.07, gain: 0.2, type: 'sine' }
    ]
  },
  unplug: {
    meaning: 'a lead was pulled out',
    layers: [
      { kind: 'noise', duration: 0.036, filter: 900, q: 0.8, gain: 0.4, decay: 0.032 },
      { kind: 'tone', freq: 96, toFreq: 150, duration: 0.06, gain: 0.14, type: 'sine' }
    ]
  },
  needle: {
    meaning: 'the pointer crossed a major division',
    layers: [{ kind: 'noise', duration: 0.008, filter: 5200, q: 2.4, gain: 0.22, decay: 0.007 }]
  },
  record: {
    meaning: 'a reading went into the notebook',
    layers: [
      { kind: 'tone', freq: 660, duration: 0.05, gain: 0.16, type: 'sine' },
      { kind: 'tone', freq: 990, duration: 0.07, gain: 0.13, type: 'sine', delay: 0.05 }
    ]
  },
  error: {
    meaning: 'the apparatus refused an action or a fault appeared',
    layers: [
      { kind: 'tone', freq: 330, duration: 0.09, gain: 0.16, type: 'triangle' },
      { kind: 'tone', freq: 233, duration: 0.13, gain: 0.15, type: 'triangle', delay: 0.09 }
    ]
  },
  success: {
    meaning: 'a balance or a valid measuring configuration was reached',
    layers: [
      { kind: 'tone', freq: 523, duration: 0.07, gain: 0.14, type: 'sine' },
      { kind: 'tone', freq: 784, duration: 0.11, gain: 0.13, type: 'sine', delay: 0.06 }
    ]
  }
};

export const CUE_NAMES = Object.keys(CUES) as CueName[];
