/**
 * Modified nodal analysis for the circuit bench.
 *
 * The solver takes the graph, stamps a conductance matrix, adds a row for each
 * ideal voltage source, and solves by Gaussian elimination with partial
 * pivoting. Nonlinear parts — the junction diode — are linearised about their
 * operating point and iterated to convergence, which is why a diode's knee is a
 * consequence of the Shockley equation rather than a drawn curve.
 *
 * Two deliberate modelling choices make the bench honest:
 *
 *  · meters carry their real resistance, so an ammeter reduces the current it
 *    measures and a voltmeter loads the branch it is across;
 *  · leads and closed keys carry a small contact resistance, so a "short
 *    circuit" is limited by something physical rather than by a special case.
 *
 * Pure and deterministic: the same graph always gives the same solution.
 */
import { CONSTANTS } from '../constants';
import {
  LEAD_RESISTANCE,
  resistanceOf,
  resolveNodes,
  terminal,
  type CircuitGraph,
  type NodeId,
  type NodeMap,
  type Part
} from './graph';

export interface CircuitSolution {
  /** Node potentials in volts, referenced to the ground node of each island. */
  nodeVoltage: Map<NodeId, number>;
  /** Current through each part, positive from terminal `a` to terminal `b`. */
  current: Map<string, number>;
  /** Potential difference V(a) − V(b) across each part. */
  voltage: Map<string, number>;
  /** Power dissipated (or, for a source, delivered) by each part, watts. */
  power: Map<string, number>;
  nodes: NodeMap;
  converged: boolean;
  iterations: number;
}

/** Leakage to ground that keeps an unreferenced island from making the matrix singular. */
const GMIN = 1e-12;
const MAX_NEWTON = 60;
const TOLERANCE = 1e-10;

/** Thermal voltage kT/q at a temperature in kelvin. */
const thermalVoltage = (temperatureK: number): number =>
  (CONSTANTS.K_B * Math.max(temperatureK, 1)) / CONSTANTS.E_CHARGE;

/** Shockley current with the exponent clamped so a sweep cannot overflow. */
function diodeCurrentAt(part: Extract<Part, { kind: 'diode' }>, v: number): number {
  const vt = thermalVoltage(part.temperatureK) * Math.max(part.ideality, 1e-3);
  const x = Math.min(v / vt, 80);
  return part.saturationCurrent * (Math.exp(x) - 1);
}

function diodeConductanceAt(part: Extract<Part, { kind: 'diode' }>, v: number): number {
  const vt = thermalVoltage(part.temperatureK) * Math.max(part.ideality, 1e-3);
  const x = Math.min(v / vt, 80);
  return Math.max((part.saturationCurrent / vt) * Math.exp(x), GMIN);
}

/**
 * Junction-voltage limiting. Newton's method on an exponential diverges wildly
 * from a bad first step; damping each update the way SPICE does keeps the
 * iteration stable without changing the answer it converges to.
 */
function limitJunction(vNew: number, vOld: number, vt: number): number {
  const vCrit = vt * Math.log(vt / Math.SQRT2 / 1e-14);
  if (vNew > vCrit && Math.abs(vNew - vOld) > 2 * vt) {
    if (vOld > 0) {
      const arg = 1 + (vNew - vOld) / vt;
      return arg > 0 ? vOld + vt * Math.log(arg) : vCrit;
    }
    return vt * Math.log(Math.max(vNew / vt, 1e-12));
  }
  return vNew;
}

/** Gaussian elimination with partial pivoting. Returns `null` for a singular system. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  const m = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-18) return null;
    if (pivot !== col) {
      const t = m[pivot];
      m[pivot] = m[col];
      m[col] = t;
    }
    const p = m[col][col];
    for (let r = col + 1; r < n; r += 1) {
      const factor = m[r][col] / p;
      if (factor === 0) continue;
      for (let c = col; c <= n; c += 1) m[r][c] -= factor * m[col][c];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = m[r][n];
    for (let c = r + 1; c < n; c += 1) sum -= m[r][c] * x[c];
    x[r] = sum / m[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Solves the circuit.
 *
 * Every island of the graph gets its own reference node, so a bench with a
 * component not yet wired in still solves rather than throwing.
 */
export function solveCircuit(graph: CircuitGraph): CircuitSolution {
  const nodes = resolveNodes(graph);
  const nodeList = nodes.nodes;
  const index = new Map<NodeId, number>();

  // One ground per connected island: the lowest-sorted node of each island,
  // where "connected" spans sources too, since a cell also joins two nodes.
  const parent = new Map<NodeId, NodeId>(nodeList.map((n) => [n, n]));
  const find = (n: NodeId): NodeId => {
    let r = n;
    while (parent.get(r) !== r) r = parent.get(r) as NodeId;
    return r;
  };
  const union = (a: NodeId, b: NodeId) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const part of graph.parts) {
    const a = nodes.nodeOf.get(terminal(part.id, 'a'));
    const b = nodes.nodeOf.get(terminal(part.id, 'b'));
    if (!a || !b) continue;
    if (part.kind === 'key' && !part.closed) continue;
    union(a, b);
  }
  const grounds = new Set<NodeId>();
  const seen = new Set<NodeId>();
  for (const n of nodeList) {
    const root = find(n);
    if (!seen.has(root)) {
      seen.add(root);
      grounds.add(n);
    }
  }

  const unknowns: NodeId[] = [];
  for (const n of nodeList) {
    if (grounds.has(n)) continue;
    index.set(n, unknowns.length);
    unknowns.push(n);
  }

  // Ideal cells (r = 0) need a branch-current unknown; every other part is a
  // conductance, which is why the matrix stays small.
  const idealCells = graph.parts.filter(
    (p): p is Extract<Part, { kind: 'cell' }> => p.kind === 'cell' && p.internalResistance <= 0
  );
  const size = unknowns.length + idealCells.length;

  const nodeIndex = (n: NodeId | undefined): number => (n === undefined ? -1 : index.get(n) ?? -1);

  const diodes = graph.parts.filter((p): p is Extract<Part, { kind: 'diode' }> => p.kind === 'diode');
  const diodeVoltage = new Map<string, number>(diodes.map((d) => [d.id, 0]));

  let solution: number[] = new Array(size).fill(0);
  let converged = diodes.length === 0;
  let iterations = 0;

  for (let iter = 0; iter < (diodes.length ? MAX_NEWTON : 1); iter += 1) {
    iterations = iter + 1;
    const A: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    const rhs = new Array<number>(size).fill(0);

    const stampConductance = (na: number, nb: number, g: number) => {
      if (na >= 0) A[na][na] += g;
      if (nb >= 0) A[nb][nb] += g;
      if (na >= 0 && nb >= 0) {
        A[na][nb] -= g;
        A[nb][na] -= g;
      }
    };
    const stampCurrent = (na: number, nb: number, i: number) => {
      // A current source driving `i` from a to b inside the element.
      if (na >= 0) rhs[na] -= i;
      if (nb >= 0) rhs[nb] += i;
    };

    for (let i = 0; i < size; i += 1) A[i][i] += GMIN;

    for (const part of graph.parts) {
      const na = nodeIndex(nodes.nodeOf.get(terminal(part.id, 'a')));
      const nb = nodeIndex(nodes.nodeOf.get(terminal(part.id, 'b')));

      if (part.kind === 'diode') {
        const v = diodeVoltage.get(part.id) ?? 0;
        const g = diodeConductanceAt(part, v);
        const i0 = diodeCurrentAt(part, v);
        stampConductance(na, nb, g);
        stampCurrent(na, nb, i0 - g * v);
        continue;
      }

      if (part.kind === 'cell') {
        if (part.internalResistance > 0) {
          // Norton equivalent: a conductance 1/r with a current source εg
          // pushing current out of the positive terminal.
          const g = 1 / part.internalResistance;
          stampConductance(na, nb, g);
          stampCurrent(nb, na, part.emf * g);
        }
        continue; // ideal cells are stamped below, as voltage sources
      }

      const r = resistanceOf(part);
      if (r === null) continue; // an open key conducts nothing
      stampConductance(na, nb, 1 / Math.max(r, LEAD_RESISTANCE * 1e-3));
    }

    idealCells.forEach((cell, k) => {
      const row = unknowns.length + k;
      const na = nodeIndex(nodes.nodeOf.get(terminal(cell.id, 'a')));
      const nb = nodeIndex(nodes.nodeOf.get(terminal(cell.id, 'b')));
      if (na >= 0) {
        A[na][row] += 1;
        A[row][na] += 1;
      }
      if (nb >= 0) {
        A[nb][row] -= 1;
        A[row][nb] -= 1;
      }
      rhs[row] = cell.emf;
    });

    const next = solveLinear(A, rhs);
    if (!next) break;

    if (diodes.length === 0) {
      solution = next;
      converged = true;
      break;
    }

    let delta = 0;
    for (const d of diodes) {
      const na = nodeIndex(nodes.nodeOf.get(terminal(d.id, 'a')));
      const nb = nodeIndex(nodes.nodeOf.get(terminal(d.id, 'b')));
      const va = na >= 0 ? next[na] : 0;
      const vb = nb >= 0 ? next[nb] : 0;
      const old = diodeVoltage.get(d.id) ?? 0;
      const vt = thermalVoltage(d.temperatureK) * Math.max(d.ideality, 1e-3);
      const limited = limitJunction(va - vb, old, vt);
      delta = Math.max(delta, Math.abs(limited - old));
      diodeVoltage.set(d.id, limited);
    }
    solution = next;
    if (delta < TOLERANCE * 1e3) {
      converged = true;
      break;
    }
  }

  /* ── read the answers back out ────────────────────────────────────────── */

  const nodeVoltage = new Map<NodeId, number>();
  for (const n of nodeList) {
    const i = nodeIndex(n);
    nodeVoltage.set(n, i >= 0 ? solution[i] ?? 0 : 0);
  }

  const current = new Map<string, number>();
  const voltage = new Map<string, number>();
  const power = new Map<string, number>();

  for (const part of graph.parts) {
    const a = nodes.nodeOf.get(terminal(part.id, 'a'));
    const b = nodes.nodeOf.get(terminal(part.id, 'b'));
    const va = a ? nodeVoltage.get(a) ?? 0 : 0;
    const vb = b ? nodeVoltage.get(b) ?? 0 : 0;
    const v = va - vb;
    voltage.set(part.id, v);

    let i = 0;
    if (part.kind === 'cell') {
      if (part.internalResistance > 0) {
        // Current delivered out of the positive terminal: (ε − V) / r.
        i = (part.emf - v) / part.internalResistance;
      } else {
        const k = idealCells.findIndex((c) => c.id === part.id);
        // The MNA branch current runs a → b inside the source; the current the
        // cell delivers to the circuit leaves the positive terminal, so it is
        // the negative of that.
        i = k >= 0 ? -(solution[unknowns.length + k] ?? 0) : 0;
      }
    } else if (part.kind === 'diode') {
      i = diodeCurrentAt(part, diodeVoltage.get(part.id) ?? v);
    } else {
      const r = resistanceOf(part);
      i = r === null ? 0 : v / Math.max(r, LEAD_RESISTANCE * 1e-3);
    }

    current.set(part.id, Number.isFinite(i) ? i : 0);
    power.set(part.id, Math.abs((Number.isFinite(i) ? i : 0) * v));
  }

  return { nodeVoltage, current, voltage, power, nodes, converged, iterations };
}
