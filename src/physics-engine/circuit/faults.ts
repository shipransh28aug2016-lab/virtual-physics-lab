/**
 * Faults read off the circuit, not authored per experiment.
 *
 * Every check here asks the graph and the solution a question — "is there a
 * path?", "what is across the source?", "which branch does this meter share?"
 * — so a student can make a wiring mistake the author never thought of and
 * still get a physically honest response. That is the difference between a
 * simulation that permits mistakes and one that merely lists them.
 *
 * Pure: graph + solution in, faults out.
 */
import {
  conductingComponents,
  hasClosedPath,
  resistanceOf,
  terminal,
  type CircuitGraph,
  type NodeId,
  type Part
} from './graph';
import type { CircuitSolution } from './solve';

export type FaultKind =
  | 'open-circuit'
  | 'short-circuit'
  | 'ammeter-in-parallel'
  | 'voltmeter-in-series'
  | 'reversed-polarity'
  | 'floating-terminal'
  | 'over-range'
  | 'meter-unused';

export type FaultSeverity = 'error' | 'warning' | 'info';

export interface Fault {
  kind: FaultKind;
  severity: FaultSeverity;
  /** Parts the fault is about, so the view can highlight them. */
  parts: string[];
  message: string;
}

/** External resistance below this counts as a short across the source. */
const SHORT_OHMS = 0.05;

const nodesOf = (solution: CircuitSolution, partId: string): [NodeId, NodeId] | null => {
  const a = solution.nodes.nodeOf.get(terminal(partId, 'a'));
  const b = solution.nodes.nodeOf.get(terminal(partId, 'b'));
  return a && b ? [a, b] : null;
};

/** Parts that a meter could legitimately be measuring — leads and keys are not. */
const isLoad = (p: Part): boolean =>
  p.kind === 'resistor' || p.kind === 'bulb' || p.kind === 'rheostat' || p.kind === 'diode';

export function detectFaults(graph: CircuitGraph, solution: CircuitSolution): Fault[] {
  const faults: Fault[] = [];
  const { nodes } = solution;
  const cells = graph.parts.filter((p): p is Extract<Part, { kind: 'cell' }> => p.kind === 'cell');

  /* ── open circuit ─────────────────────────────────────────────────────── */
  for (const cell of cells) {
    if (cell.emf === 0) continue;
    if (!hasClosedPath(graph, nodes, cell.id)) {
      faults.push({
        kind: 'open-circuit',
        severity: 'warning',
        parts: [cell.id],
        message:
          'The circuit is open: there is no complete conducting path from one terminal of the source back to the other, so no current flows anywhere in it.'
      });
    }
  }

  /* ── short circuit ────────────────────────────────────────────────────── */
  for (const cell of cells) {
    const i = solution.current.get(cell.id) ?? 0;
    const v = solution.voltage.get(cell.id) ?? 0;
    if (Math.abs(i) < 1e-9) continue;
    const external = Math.abs(v / i);
    if (external < SHORT_OHMS) {
      faults.push({
        kind: 'short-circuit',
        severity: 'error',
        parts: [cell.id],
        message: `The source is short-circuited: only ${external.toFixed(3)} Ω stands across it, so the current is limited by the internal resistance of the cell alone.`
      });
    }
  }

  /* ── meter placement ──────────────────────────────────────────────────── */
  for (const part of graph.parts) {
    const pair = nodesOf(solution, part.id);
    if (!pair) continue;
    const [a, b] = pair;

    if (part.kind === 'ammeter') {
      // An ammeter must be the only thing in its branch. If a load shares both
      // of its nodes, the meter is bridged across that load and shorts it.
      const shared = graph.parts.filter((other) => {
        if (other.id === part.id || !isLoad(other)) return false;
        const o = nodesOf(solution, other.id);
        return !!o && ((o[0] === a && o[1] === b) || (o[0] === b && o[1] === a));
      });
      if (shared.length > 0) {
        faults.push({
          kind: 'ammeter-in-parallel',
          severity: 'error',
          parts: [part.id, ...shared.map((s) => s.id)],
          message:
            'The ammeter is connected across a component instead of in series with it. Its resistance is very low, so it short-circuits that component and reads far more than the branch current.'
        });
      }
    }

    if (part.kind === 'voltmeter') {
      // A voltmeter is in series when removing it breaks the circuit — that is,
      // when it is the only conducting bridge between its own two nodes.
      const withoutMeter = conductingComponents(graph, nodes, { exclude: new Set([part.id]) });
      const carriesLoopCurrent = !withoutMeter.connected(a, b);
      const sourceStillReaches = cells.some((cell) => {
        const c = nodesOf(solution, cell.id);
        return !!c && (withoutMeter.connected(c[0], a) || withoutMeter.connected(c[0], b));
      });
      if (a !== b && carriesLoopCurrent && sourceStillReaches) {
        faults.push({
          kind: 'voltmeter-in-series',
          severity: 'error',
          parts: [part.id],
          message:
            'The voltmeter is in the loop rather than across a component. Its resistance is very high, so it almost stops the current instead of measuring a potential difference.'
        });
      } else if (a === b) {
        faults.push({
          kind: 'meter-unused',
          severity: 'info',
          parts: [part.id],
          message: 'Both voltmeter leads are on the same point of the circuit, so it can only read zero.'
        });
      }
    }
  }

  /* ── polarity ─────────────────────────────────────────────────────────── */
  for (const part of graph.parts) {
    const i = solution.current.get(part.id) ?? 0;
    if (part.kind === 'ammeter' || part.kind === 'galvanometer') {
      if (i < -1e-9) {
        faults.push({
          kind: 'reversed-polarity',
          severity: 'warning',
          parts: [part.id],
          message:
            'Current is entering this meter by its negative terminal, so the pointer is driven backwards against the stop. Swap its two leads.'
        });
      }
      const range = part.kind === 'ammeter' ? part.range : part.figureOfMerit * part.divisions;
      if (range > 0 && Math.abs(i) > range) {
        faults.push({
          kind: 'over-range',
          severity: 'error',
          parts: [part.id],
          message: `The current is ${Math.abs(i).toPrecision(3)} A but this meter reads only to ${range.toPrecision(3)} A, so the pointer is hard against the end stop.`
        });
      }
    }
    if (part.kind === 'voltmeter') {
      const v = solution.voltage.get(part.id) ?? 0;
      if (v < -1e-9) {
        faults.push({
          kind: 'reversed-polarity',
          severity: 'warning',
          parts: [part.id],
          message: 'The voltmeter is connected with reversed polarity, so it is being driven below zero.'
        });
      }
      if (part.range > 0 && Math.abs(v) > part.range) {
        faults.push({
          kind: 'over-range',
          severity: 'error',
          parts: [part.id],
          message: `The potential difference is ${Math.abs(v).toPrecision(3)} V but this voltmeter reads only to ${part.range} V.`
        });
      }
    }
  }

  /* ── unfinished wiring ────────────────────────────────────────────────── */
  if (nodes.floating.length > 0) {
    const parts = [...new Set(nodes.floating.map((t) => t.slice(0, t.lastIndexOf('.'))))];
    faults.push({
      kind: 'floating-terminal',
      severity: 'info',
      parts,
      message: `${nodes.floating.length} terminal${nodes.floating.length === 1 ? ' is' : 's are'} not connected to anything, so ${parts.length === 1 ? 'that component takes' : 'those components take'} no part in the circuit.`
    });
  }

  const order: Record<FaultSeverity, number> = { error: 0, warning: 1, info: 2 };
  return faults.sort((x, y) => order[x.severity] - order[y.severity]);
}

/** A circuit with no error-level fault is one a reading can be taken from. */
export const isMeasurable = (faults: Fault[]): boolean => !faults.some((f) => f.severity === 'error');

/** Total resistance the source sees, for the readouts. `Infinity` when open. */
export function externalResistance(solution: CircuitSolution, cellId: string): number {
  const i = solution.current.get(cellId) ?? 0;
  if (Math.abs(i) < 1e-12) return Number.POSITIVE_INFINITY;
  return Math.abs((solution.voltage.get(cellId) ?? 0) / i);
}

/** Sum of the resistances a part list presents, ignoring the ones that cannot conduct. */
export const totalResistance = (parts: Part[]): number =>
  parts.reduce((sum, p) => sum + (resistanceOf(p) ?? 0), 0);
