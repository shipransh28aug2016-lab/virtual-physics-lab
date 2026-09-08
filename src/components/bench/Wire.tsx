import { flowPeriodSeconds } from '@/lab/motion';

export interface BenchWireProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Current in the branch, amperes. Sign gives the direction of the cue. */
  current: number;
  live: boolean;
  /** Draws the lead as the one the student is currently holding. */
  ghost?: boolean;
}

/**
 * A connecting lead drawn as a slack cable between two sockets.
 *
 * The flow cue on a live lead is a *representation of conventional current
 * direction*: its period comes from the model's own current magnitude, so a
 * heavier current visibly moves faster, and it reverses when the current does.
 * It is not a claim about drift velocity — the bench prints that disclosure on
 * the apparatus. See `docs/animation/README.md`.
 */
export function BenchWire({ from, to, current, live, ghost }: BenchWireProps) {
  // Real leads sag. A quadratic through a dropped midpoint reads as a cable
  // rather than a schematic line, and keeps two leads between the same pair of
  // sockets visually distinct.
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + Math.min(46, Math.hypot(to.x - from.x, to.y - from.y) * 0.22);
  const d = `M ${from.x} ${from.y} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${to.x} ${to.y}`;
  const period = flowPeriodSeconds(current);

  if (ghost) return <path d={d} className="bench-wire is-ghost" fill="none" />;

  return (
    <g className="bench-wire-group">
      <path d={d} className="bench-wire-shadow" fill="none" />
      <path d={d} className={`bench-wire${live ? ' is-live' : ''}`} fill="none" />
      {live && period > 0 ? (
        <path
          d={d}
          className="lead-flow"
          fill="none"
          style={{
            animationDuration: `${period}s`,
            animationDirection: current < 0 ? 'reverse' : 'normal'
          }}
        />
      ) : null}
    </g>
  );
}
