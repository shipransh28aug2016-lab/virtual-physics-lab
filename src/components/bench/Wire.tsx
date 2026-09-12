import { wireControl } from './geometry';

export interface BenchWireProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /**
   * Whether this lead is carrying current. The magnitude and direction are the
   * canvas carrier layer's business; the lead itself only has to look live.
   */
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
export function BenchWire({ from, to, live, ghost }: BenchWireProps) {
  // The sag comes from the shared geometry, so the canvas carrier overlay
  // follows exactly the curve drawn here.
  const c = wireControl(from, to);
  const d = `M ${from.x} ${from.y} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${to.x} ${to.y}`;

  if (ghost) return <path d={d} className="bench-wire is-ghost" fill="none" />;

  return (
    <g className="bench-wire-group">
      <path d={d} className="bench-wire-shadow" fill="none" />
      <path d={d} className={`bench-wire${live ? ' is-live' : ''}`} fill="none" />
      {/*
        The moving carriers are drawn on the canvas layer now, where their speed
        comes from the solved current in this branch rather than from a CSS
        animation duration. Where there is no canvas the lead still brightens,
        so "current flows here" is never lost — only its motion.
      */}
    </g>
  );
}
