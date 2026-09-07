/**
 * The motion language of the lab.
 *
 * Every animation in the apparatus must mean something: a connection snaps, a
 * switch throws, a needle settles, a rejected action shakes. Generic fades are
 * not part of the vocabulary. Durations and curves live here once so a knob in
 * optics moves like a knob in circuits.
 *
 * Pure data + pure helpers: no React, no DOM, no side effects.
 */

export type MotionToken =
  | 'snap'
  | 'throw'
  | 'settle'
  | 'turn'
  | 'flow'
  | 'shake'
  | 'confirm';

export interface MotionSpec {
  /** Milliseconds. 0 means "apply the end state immediately". */
  duration: number;
  /** CSS timing function. */
  easing: string;
  /** What the motion is allowed to say, for review and documentation. */
  meaning: string;
}

/**
 * `settle` deliberately carries the 260 ms damped overshoot the moving-coil
 * meter already used before 2.0 — the needle behaviour was right, so it was
 * promoted into the token table rather than replaced.
 */
export const MOTION: Record<MotionToken, MotionSpec> = {
  snap: { duration: 120, easing: 'cubic-bezier(.2,.9,.3,1.2)', meaning: 'a connection was made' },
  throw: { duration: 90, easing: 'linear', meaning: 'a switch or key moved mechanically' },
  settle: { duration: 260, easing: 'cubic-bezier(0.34, 1.2, 0.4, 1)', meaning: 'an instrument is settling onto a reading' },
  turn: { duration: 0, easing: 'linear', meaning: 'a knob follows the pointer with no lag' },
  flow: { duration: 1600, easing: 'linear', meaning: 'conventional current direction (illustrative, not drift speed)' },
  shake: { duration: 180, easing: 'cubic-bezier(.36,.07,.19,.97)', meaning: 'the apparatus rejected an action' },
  confirm: { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)', meaning: 'a reading was accepted' }
};

/** Milliseconds for a token, collapsed to 0 when motion is reduced. */
export const durationOf = (token: MotionToken, reducedMotion = false): number =>
  reducedMotion ? 0 : MOTION[token].duration;

/** A ready-made CSS `transition` value, or `none` when motion is reduced. */
export function transitionOf(
  token: MotionToken,
  property: string,
  reducedMotion = false
): string {
  if (reducedMotion) return 'none';
  const m = MOTION[token];
  return `${property} ${m.duration}ms ${m.easing}`;
}

/**
 * Period of the current-flow animation, in seconds, for a current magnitude.
 *
 * A heavier current visibly moves faster, so the cue is a monotonic function of
 * the model's own value rather than a decorative constant. It is explicitly a
 * *conceptual* representation of conventional current — see
 * {@link FLOW_DISCLOSURE}.
 */
export function flowPeriodSeconds(currentAmperes: number): number {
  const i = Math.abs(currentAmperes);
  if (!Number.isFinite(i) || i <= 1e-9) return 0;
  return Math.max(0.25, Math.min(3, 1.6 / Math.sqrt(i)));
}

/**
 * The honesty label every charge-flow visualisation must be able to show.
 * Electrons drift at ~10⁻⁴ m/s; nothing on screen may imply otherwise.
 */
export const FLOW_DISCLOSURE =
  'Illustrative animation of conventional current direction — not literal electron drift speed.';
