/**
 * Where a lead runs, and what it is carrying.
 *
 * Shared by the SVG bench and the canvas carrier overlay so the two cannot
 * disagree: a carrier drawn on the canvas follows the same curve the SVG drew,
 * and takes its speed and direction from the same solved current.
 */
import type { CircuitSolution, Part } from '@/physics-engine/circuit';
import type { Vec2 } from '@/lab/canvas/primitives';

/**
 * Control point of the lead's curve.
 *
 * Real leads sag. A quadratic through a dropped midpoint reads as a cable
 * rather than a schematic line, and keeps two leads between the same pair of
 * sockets visually distinct.
 */
export function wireControl(from: Vec2, to: Vec2): Vec2 {
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 + Math.min(46, Math.hypot(to.x - from.x, to.y - from.y) * 0.22)
  };
}

/** A point along that curve, `t` from 0 at `from` to 1 at `to`. */
export function wirePoint(from: Vec2, to: Vec2, t: number): Vec2 {
  const c = wireControl(from, to);
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * c.y + t * t * to.y
  };
}

/** Rough arc length of the curve, good enough to space carriers evenly. */
export function wireLength(from: Vec2, to: Vec2, samples = 12): number {
  let total = 0;
  let prev = from;
  for (let i = 1; i <= samples; i += 1) {
    const p = wirePoint(from, to, i / samples);
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total;
}

/**
 * The current a lead carries, signed along the direction `from → to`.
 *
 * A lead joins two terminals, so the honest answer is the current in whichever
 * part it is attached to — taken from the terminal the student plugged into,
 * never guessed from the geometry. Current leaves a part at `b`, so a lead on a
 * `b` terminal carries it forwards.
 */
export function wireCurrent(
  fromTerminal: string,
  toTerminal: string,
  byId: Map<string, Part>,
  solution: CircuitSolution
): number {
  for (const end of [fromTerminal, toTerminal]) {
    const dot = end.lastIndexOf('.');
    const partId = end.slice(0, dot);
    const name = end.slice(dot + 1);
    if (!byId.has(partId)) continue;
    const i = solution.current.get(partId) ?? 0;
    if (Math.abs(i) < 1e-12) continue;
    const forwards = name === 'b' ? i : -i;
    // The sign is relative to `from → to`; flip it when the reference terminal
    // was the second one.
    return end === fromTerminal ? forwards : -forwards;
  }
  return 0;
}
