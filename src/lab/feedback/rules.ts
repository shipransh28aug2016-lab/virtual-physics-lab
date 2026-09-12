/**
 * Rule-based tutor feedback.
 *
 * Every hint here is derived from state the physics engine already computed.
 * Nothing in this file may invent a value, guess at a reading, or describe a
 * circuit the model does not report — §46 of the 2.0 brief. An LLM layer, if
 * one is ever added, sits *above* this and is fed the same validated state.
 *
 * Pure: input state in, hints out. No React, no DOM, no I/O.
 */
import type { IssueSeverity } from '@/types/lab';

export type HintKind =
  | 'open-circuit'
  | 'short-circuit'
  | 'meter-placement'
  | 'polarity'
  | 'floating'
  | 'over-range'
  | 'no-deflection'
  | 'off-scale'
  | 'procedure';

export interface Hint {
  kind: HintKind;
  severity: IssueSeverity;
  /** What the student is seeing. */
  observation: string;
  /** Why it is happening, in the language of the syllabus. */
  explanation: string;
  /** The next physical action. Never "click here" — a bench instruction. */
  action: string;
}

/** Everything the rules are allowed to look at. All of it comes from the model. */
export interface FeedbackState {
  /** A closed conducting path exists between the source terminals. */
  closedPath: boolean;
  /** Source is connected across a near-zero resistance. */
  shorted: boolean;
  /** Current through the source, amperes. */
  current: number;
  /** Terminals wired to nothing. */
  floatingTerminals: number;
  /** An ammeter bridged across a component instead of in series with it. */
  ammeterInParallel: boolean;
  /** A voltmeter inserted into the loop instead of across a component. */
  voltmeterInSeries: boolean;
  /** A polarity-sensitive part is connected the wrong way round. */
  reversedPolarity: boolean;
  /** Fraction of full-scale on the most-deflected meter, 0–1+. */
  meterFraction: number;
}

const HINTS: { when: (s: FeedbackState) => boolean; hint: Hint }[] = [
  {
    when: (s) => s.shorted,
    hint: {
      kind: 'short-circuit',
      severity: 'error',
      observation: 'The source is connected across a path of almost no resistance.',
      explanation:
        'With nothing to limit it, the current is set only by the internal resistance of the cell. On a real bench this is the connection that heats the leads and flattens the cell.',
      action: 'Put the resistor, rheostat or resistance box back into the loop before closing the key.'
    }
  },
  {
    when: (s) => s.ammeterInParallel,
    hint: {
      kind: 'meter-placement',
      severity: 'error',
      observation: 'The ammeter is bridged across a component rather than inserted into the loop.',
      explanation:
        'An ammeter has very low resistance, so connecting it across a component short-circuits that component. It must carry the same current as the branch it measures.',
      action: 'Break the loop at one point and insert the ammeter into the gap, in series.'
    }
  },
  {
    when: (s) => s.voltmeterInSeries,
    hint: {
      kind: 'meter-placement',
      severity: 'error',
      observation: 'The voltmeter is in the loop rather than across a component.',
      explanation:
        'A voltmeter has very high resistance, so placing it in series almost stops the current. It must be connected in parallel with the component whose potential difference you want.',
      action: 'Take the voltmeter out of the loop and bridge it across the component instead.'
    }
  },
  {
    when: (s) => s.reversedPolarity,
    hint: {
      kind: 'polarity',
      severity: 'warning',
      observation: 'A polarity-sensitive component is connected the wrong way round.',
      explanation:
        'Meters deflect backwards and a junction diode blocks instead of conducting when the terminals are swapped. The positive terminal of the cell must face the positive terminal of the instrument.',
      action: 'Swap the two leads on that component and watch the deflection change sign.'
    }
  },
  {
    when: (s) => !s.closedPath,
    hint: {
      kind: 'open-circuit',
      severity: 'warning',
      observation: 'No current flows anywhere in the circuit.',
      explanation:
        'A current needs a complete conducting path from one terminal of the source back to the other. Anywhere the path is broken — an open key, an empty terminal — the whole loop carries nothing.',
      action: 'Trace the loop from the positive terminal and close the first gap you meet.'
    }
  },
  {
    when: (s) => s.closedPath && s.floatingTerminals > 0,
    hint: {
      kind: 'floating',
      severity: 'info',
      observation: 'Some terminals are still unconnected.',
      explanation:
        'A terminal wired to nothing carries no current, so the component attached to it takes no part in the circuit even though it is on the bench.',
      action: 'Connect the remaining terminals, or remove the unused component from the layout.'
    }
  },
  {
    when: (s) => s.meterFraction > 1,
    hint: {
      kind: 'over-range',
      severity: 'error',
      observation: 'The pointer is hard against the end stop.',
      explanation:
        'The quantity is larger than the range of the instrument, so the reading cannot be trusted — and on a real meter this is how the movement is damaged.',
      action: 'Increase the series resistance, or use a higher range, until the pointer sits on the scale.'
    }
  },
  {
    when: (s) => s.closedPath && !s.shorted && s.meterFraction > 0 && s.meterFraction < 0.15,
    hint: {
      kind: 'off-scale',
      severity: 'info',
      observation: 'The deflection is very small, near the bottom of the scale.',
      explanation:
        'A reading taken over the first few divisions carries a large fractional error, because the least count is a big share of the number you are reading.',
      action: 'Reduce the resistance until the pointer sits over the middle of the scale, then take the reading.'
    }
  },
  {
    when: (s) => s.closedPath && !s.shorted && Math.abs(s.current) <= 1e-9,
    hint: {
      kind: 'no-deflection',
      severity: 'warning',
      observation: 'The path is complete but nothing is moving.',
      explanation:
        'A complete path with no current usually means the source is set to zero, or a component in the loop has effectively infinite resistance.',
      action: 'Check the emf setting and any resistance box left at its maximum.'
    }
  }
];

/**
 * All hints that apply, most serious first. An empty list means the apparatus
 * is in a state a student can legitimately take a reading from.
 */
export function diagnose(state: FeedbackState): Hint[] {
  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return HINTS.filter((r) => r.when(state))
    .map((r) => r.hint)
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

/** The single most useful hint, or `null` when the bench is in a good state. */
export const nextHint = (state: FeedbackState): Hint | null => diagnose(state)[0] ?? null;

/** A bench state with nothing wrong — the base every caller spreads over. */
export const HEALTHY: FeedbackState = {
  closedPath: true,
  shorted: false,
  current: 0.1,
  floatingTerminals: 0,
  ammeterInParallel: false,
  voltmeterInSeries: false,
  reversedPolarity: false,
  meterFraction: 0.5
};
