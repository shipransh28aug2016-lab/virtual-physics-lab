/**
 * The circuit as data.
 *
 * A circuit here is a set of parts, each with two named terminals, joined by
 * wires. Nothing in this file knows where anything is drawn: geometry is a
 * layout hint the view may read, and the solver never looks at it. That is the
 * whole point — before 2.0 a "connection" was a hard-coded SVG path plus a
 * boolean, so no wrong connection was expressible and no student could make a
 * wiring mistake.
 *
 * Pure: no React, no DOM, SI units throughout.
 */

export type PartKind =
  | 'cell'
  | 'resistor'
  | 'bulb'
  | 'rheostat'
  | 'key'
  | 'ammeter'
  | 'voltmeter'
  | 'galvanometer'
  | 'diode'
  | 'lead';

/** Terminal names. `a` is the positive terminal, or the anode, where polarity matters. */
export type TerminalName = 'a' | 'b';
/** `partId.a` — the only way a terminal is ever addressed. */
export type TerminalId = string;
export type NodeId = string;

export interface Layout {
  x: number;
  y: number;
  rotate?: number;
  /**
   * Socket spacing of the mount this part sits in, overriding the default for
   * its kind. Swapping one component for another in the same mount must not
   * move the sockets, or the wiring appears to jump.
   */
  span?: number;
}

interface PartBase {
  id: string;
  label?: string;
  /** Drawing hint for the view. The solver never reads it. */
  layout?: Layout;
}

export interface CellPart extends PartBase {
  kind: 'cell';
  /** Volts. `a` is the positive terminal. */
  emf: number;
  /** Ohms. Zero gives an ideal cell, which the solver handles exactly. */
  internalResistance: number;
}

export interface ResistorPart extends PartBase {
  kind: 'resistor' | 'bulb';
  resistance: number;
  /** Bulbs only: the power at which the filament is at full brightness. */
  ratedPower?: number;
}

export interface RheostatPart extends PartBase {
  kind: 'rheostat';
  maxResistance: number;
  /** Slider position, 0–1, of the maximum that is in circuit. */
  fraction: number;
}

export interface KeyPart extends PartBase {
  kind: 'key';
  closed: boolean;
}

export interface AmmeterPart extends PartBase {
  kind: 'ammeter';
  /** A real ammeter is low but not zero, so inserting one changes the current. */
  resistance: number;
  /** Full-scale deflection, amperes. */
  range: number;
}

export interface VoltmeterPart extends PartBase {
  kind: 'voltmeter';
  /** A real voltmeter is high but not infinite, so it loads the circuit. */
  resistance: number;
  /** Full-scale deflection, volts. */
  range: number;
}

export interface GalvanometerPart extends PartBase {
  kind: 'galvanometer';
  resistance: number;
  /** Amperes per division. */
  figureOfMerit: number;
  /** Divisions either side of zero. */
  divisions: number;
}

export interface DiodePart extends PartBase {
  kind: 'diode';
  /** Reverse saturation current, amperes. `a` is the anode. */
  saturationCurrent: number;
  ideality: number;
  temperatureK: number;
}

export interface LeadPart extends PartBase {
  kind: 'lead';
}

export type Part =
  | CellPart
  | ResistorPart
  | RheostatPart
  | KeyPart
  | AmmeterPart
  | VoltmeterPart
  | GalvanometerPart
  | DiodePart
  | LeadPart;

export interface Wire {
  id: string;
  from: TerminalId;
  to: TerminalId;
}

export interface CircuitGraph {
  parts: Part[];
  wires: Wire[];
}

/* ── terminals ──────────────────────────────────────────────────────────── */

export const terminal = (partId: string, name: TerminalName): TerminalId => `${partId}.${name}`;

export function splitTerminal(id: TerminalId): { part: string; name: TerminalName } {
  const at = id.lastIndexOf('.');
  const name = id.slice(at + 1);
  return { part: id.slice(0, at), name: name === 'b' ? 'b' : 'a' };
}

/** Every terminal in the circuit, in part order. */
export const terminalsOf = (graph: CircuitGraph): TerminalId[] =>
  graph.parts.flatMap((p) => [terminal(p.id, 'a'), terminal(p.id, 'b')]);

/* ── node resolution ────────────────────────────────────────────────────── */

class DisjointSet {
  private parent = new Map<string, string>();

  add(x: string): void {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }

  find(x: string): string {
    this.add(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root) as string;
    // Path compression keeps repeated lookups cheap for large benches.
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur) as string;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface NodeMap {
  /** Terminal → the node it belongs to. */
  nodeOf: Map<TerminalId, NodeId>;
  /** Node → its terminals. */
  terminals: Map<NodeId, TerminalId[]>;
  /** Terminals with no wire attached at all. */
  floating: TerminalId[];
  nodes: NodeId[];
}

/**
 * Joins terminals into nodes by union-find over the wires. Two terminals are
 * the same electrical point when a wire — or a chain of wires — joins them.
 */
export function resolveNodes(graph: CircuitGraph): NodeMap {
  const set = new DisjointSet();
  const all = terminalsOf(graph);
  for (const t of all) set.add(t);

  const wired = new Set<TerminalId>();
  for (const w of graph.wires) {
    // A wire to a terminal that does not exist is ignored rather than fatal:
    // the bench is edited live and a half-built circuit must still solve.
    if (!all.includes(w.from) || !all.includes(w.to)) continue;
    set.union(w.from, w.to);
    wired.add(w.from);
    wired.add(w.to);
  }

  const nodeOf = new Map<TerminalId, NodeId>();
  const terminals = new Map<NodeId, TerminalId[]>();
  for (const t of all) {
    const root = set.find(t);
    nodeOf.set(t, root);
    const list = terminals.get(root);
    if (list) list.push(t);
    else terminals.set(root, [t]);
  }

  return {
    nodeOf,
    terminals,
    floating: all.filter((t) => !wired.has(t)),
    nodes: [...terminals.keys()].sort()
  };
}

/* ── conduction ─────────────────────────────────────────────────────────── */

/** Resistance a part presents, or `null` when it does not conduct at all. */
export function resistanceOf(part: Part): number | null {
  switch (part.kind) {
    case 'resistor':
    case 'bulb':
      return Math.max(part.resistance, 0);
    case 'rheostat':
      return Math.max(part.maxResistance * Math.min(Math.max(part.fraction, 0), 1), 0);
    case 'key':
      return part.closed ? LEAD_RESISTANCE : null;
    case 'lead':
      return LEAD_RESISTANCE;
    case 'ammeter':
    case 'voltmeter':
    case 'galvanometer':
      return Math.max(part.resistance, 0);
    case 'cell':
      return Math.max(part.internalResistance, 0);
    case 'diode':
      return null; // nonlinear — handled by the solver, not by a resistance
  }
}

/** Contact and lead resistance. Small, but not zero — real wires are not ideal. */
export const LEAD_RESISTANCE = 1e-3;

/**
 * Union-find over everything that can carry current, used to answer "is there a
 * complete path?" without solving. A diode counts as conducting: whether it
 * actually does is a question for the solver, not for topology.
 */
export function conductingComponents(
  graph: CircuitGraph,
  nodes: NodeMap,
  options: { exclude?: Set<string>; includeSources?: boolean } = {}
): DisjointSetView {
  const set = new DisjointSet();
  for (const n of nodes.nodes) set.add(n);
  for (const part of graph.parts) {
    if (options.exclude?.has(part.id)) continue;
    if (part.kind === 'cell' && !options.includeSources) continue;
    if (part.kind !== 'diode' && resistanceOf(part) === null) continue;
    const a = nodes.nodeOf.get(terminal(part.id, 'a'));
    const b = nodes.nodeOf.get(terminal(part.id, 'b'));
    if (a && b) set.union(a, b);
  }
  return { connected: (a: NodeId, b: NodeId) => set.find(a) === set.find(b), root: (n) => set.find(n) };
}

export interface DisjointSetView {
  connected: (a: NodeId, b: NodeId) => boolean;
  root: (n: NodeId) => string;
}

/** True when current has a route from one terminal of the part back to the other. */
export function hasClosedPath(graph: CircuitGraph, nodes: NodeMap, partId: string): boolean {
  const a = nodes.nodeOf.get(terminal(partId, 'a'));
  const b = nodes.nodeOf.get(terminal(partId, 'b'));
  if (!a || !b || a === b) return a === b && a !== undefined;
  return conductingComponents(graph, nodes, { exclude: new Set([partId]) }).connected(a, b);
}

/* ── builders ───────────────────────────────────────────────────────────── */

/** Wires a list of terminals into one chain: `[a, b, c]` joins a–b and b–c. */
export function chain(...terminals: TerminalId[]): Wire[] {
  const out: Wire[] = [];
  for (let i = 0; i + 1 < terminals.length; i += 1) {
    out.push({ id: `w:${terminals[i]}~${terminals[i + 1]}`, from: terminals[i], to: terminals[i + 1] });
  }
  return out;
}

/**
 * Wires a single series loop the way a student lays one out: conventional
 * current leaves the source's positive terminal (`a`), passes through each of
 * `rest` from `a` to `b` in the order given, and returns to the source's
 * negative terminal (`b`). Every part therefore carries a positive current in
 * a correctly wired loop, which is what makes a reversed lead detectable.
 */
export function seriesLoop(sourceId: string, ...rest: string[]): Wire[] {
  if (rest.length === 0) {
    return [{ id: `w:${sourceId}-short`, from: terminal(sourceId, 'a'), to: terminal(sourceId, 'b') }];
  }
  const points: TerminalId[] = [terminal(sourceId, 'a')];
  for (const id of rest) {
    points.push(terminal(id, 'a'), terminal(id, 'b'));
  }
  points.push(terminal(sourceId, 'b'));
  // Skip the internal a→b hop of each part: the part itself bridges those.
  const out: Wire[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push({ id: `w:${points[i]}~${points[i + 1]}`, from: points[i], to: points[i + 1] });
  }
  return out;
}

/** Bridges a part across another part's two terminals — a voltmeter, say. */
export const across = (partId: string, overPartId: string): Wire[] => [
  { id: `w:${partId}.a~${overPartId}.a`, from: terminal(partId, 'a'), to: terminal(overPartId, 'a') },
  { id: `w:${partId}.b~${overPartId}.b`, from: terminal(partId, 'b'), to: terminal(overPartId, 'b') }
];
