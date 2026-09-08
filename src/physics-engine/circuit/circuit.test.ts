import { describe, expect, it } from 'vitest';
import {
  across,
  chain,
  hasClosedPath,
  resolveNodes,
  seriesLoop,
  terminal,
  type CircuitGraph,
  type Part
} from './graph';
import { solveCircuit } from './solve';
import { detectFaults, externalResistance, isMeasurable } from './faults';

const cell = (id: string, emf: number, r: number): Part => ({
  id,
  kind: 'cell',
  emf,
  internalResistance: r
});
const res = (id: string, resistance: number): Part => ({ id, kind: 'resistor', resistance });
const key = (id: string, closed: boolean): Part => ({ id, kind: 'key', closed });

describe('topology', () => {
  it('joins terminals a wire connects into one node', () => {
    const g: CircuitGraph = { parts: [cell('c', 6, 0.5), res('r', 20)], wires: seriesLoop('c', 'r') };
    const n = resolveNodes(g);
    expect(n.nodes).toHaveLength(2);
    expect(n.nodeOf.get(terminal('c', 'a'))).toBe(n.nodeOf.get(terminal('r', 'a')));
    expect(n.nodeOf.get(terminal('c', 'b'))).toBe(n.nodeOf.get(terminal('r', 'b')));
    expect(n.floating).toHaveLength(0);
  });

  it('reports a terminal that no wire reaches', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), res('r', 20)],
      wires: chain(terminal('c', 'a'), terminal('r', 'a'))
    };
    expect(resolveNodes(g).floating.sort()).toEqual(['c.b', 'r.b']);
  });

  it('knows whether a complete path exists without solving', () => {
    const closed: CircuitGraph = {
      parts: [cell('c', 6, 0.5), key('k', true), res('r', 20)],
      wires: seriesLoop('c', 'k', 'r')
    };
    const open: CircuitGraph = { ...closed, parts: [cell('c', 6, 0.5), key('k', false), res('r', 20)] };
    expect(hasClosedPath(closed, resolveNodes(closed), 'c')).toBe(true);
    expect(hasClosedPath(open, resolveNodes(open), 'c')).toBe(false);
  });

  it('ignores a wire naming a terminal that is not on the bench', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), res('r', 20)],
      wires: [...seriesLoop('c', 'r'), { id: 'ghost', from: 'nowhere.a', to: terminal('r', 'a') }]
    };
    expect(() => resolveNodes(g)).not.toThrow();
    expect(resolveNodes(g).nodes).toHaveLength(2);
  });
});

describe('single loop', () => {
  it('gives I = ε /(R + r) — the anchor Ohm’s law is built on', () => {
    const g: CircuitGraph = { parts: [cell('c', 6, 0.5), res('r', 20)], wires: seriesLoop('c', 'r') };
    const s = solveCircuit(g);
    expect(s.current.get('r')).toBeCloseTo(6 / 20.5, 9);
    expect(s.current.get('c')).toBeCloseTo(6 / 20.5, 9);
    // Terminal voltage V = ε − Ir.
    expect(s.voltage.get('c')).toBeCloseTo(6 - (6 / 20.5) * 0.5, 9);
  });

  it('handles an ideal cell exactly, with no internal resistance to hide behind', () => {
    const g: CircuitGraph = { parts: [cell('c', 6, 0), res('r', 20)], wires: seriesLoop('c', 'r') };
    const s = solveCircuit(g);
    expect(s.current.get('r')).toBeCloseTo(0.3, 9);
    expect(s.voltage.get('c')).toBeCloseTo(6, 9);
  });

  it('adds series resistances and shares parallel ones', () => {
    const series: CircuitGraph = {
      parts: [cell('c', 6, 0), res('r1', 10), res('r2', 20)],
      wires: seriesLoop('c', 'r1', 'r2')
    };
    expect(solveCircuit(series).current.get('r1')).toBeCloseTo(6 / 30, 9);

    const parallel: CircuitGraph = {
      parts: [cell('c', 6, 0), res('r1', 10), res('r2', 20)],
      wires: [
        ...chain(terminal('c', 'a'), terminal('r1', 'a'), terminal('r2', 'a')),
        ...chain(terminal('c', 'b'), terminal('r1', 'b'), terminal('r2', 'b'))
      ]
    };
    const p = solveCircuit(parallel);
    expect(p.current.get('r1')).toBeCloseTo(0.6, 9);
    expect(p.current.get('r2')).toBeCloseTo(0.3, 9);
    expect(p.current.get('c')).toBeCloseTo(0.9, 9); // 6 V across 10‖20 = 6.667 Ω
  });

  it('carries nothing at all while the key is open', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), key('k', false), res('r', 20)],
      wires: seriesLoop('c', 'k', 'r')
    };
    const s = solveCircuit(g);
    expect(Math.abs(s.current.get('r') ?? 1)).toBeLessThan(1e-9);
    expect(Math.abs(s.current.get('c') ?? 1)).toBeLessThan(1e-9);
  });

  it('limits a short circuit by the internal resistance, not by a special case', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), key('k', true)],
      wires: seriesLoop('c', 'k')
    };
    const s = solveCircuit(g);
    // ε / (r + contact resistance of the closed key)
    expect(s.current.get('c')).toBeGreaterThan(11.9);
    expect(s.current.get('c')).toBeLessThan(12.01);
  });

  it('obeys Kirchhoff’s voltage law around the loop', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 9, 1), res('r1', 47), res('r2', 22)],
      wires: seriesLoop('c', 'r1', 'r2')
    };
    const s = solveCircuit(g);
    const drops = (s.voltage.get('r1') ?? 0) + (s.voltage.get('r2') ?? 0);
    expect(drops).toBeCloseTo(s.voltage.get('c') ?? 0, 9);
    expect((s.current.get('c') ?? 0) * (47 + 22 + 1)).toBeCloseTo(9, 8);
  });
});

describe('real instruments load the circuit', () => {
  it('makes an ammeter reduce the current it is measuring', () => {
    const ideal: CircuitGraph = { parts: [cell('c', 6, 0)], wires: [] };
    void ideal;
    const withMeter: CircuitGraph = {
      parts: [
        cell('c', 6, 0),
        { id: 'a', kind: 'ammeter', resistance: 0.5, range: 1 },
        res('r', 20)
      ],
      wires: seriesLoop('c', 'a', 'r')
    };
    const s = solveCircuit(withMeter);
    expect(s.current.get('a')).toBeCloseTo(6 / 20.5, 9);
    expect(s.current.get('a')).toBeLessThan(0.3); // an ideal meter would read 0.3 A
  });

  it('makes a voltmeter across a resistor draw a little current', () => {
    const g: CircuitGraph = {
      parts: [
        cell('c', 6, 0),
        res('r1', 1000),
        res('r2', 1000),
        { id: 'v', kind: 'voltmeter', resistance: 10_000, range: 10 }
      ],
      wires: [...seriesLoop('c', 'r1', 'r2'), ...across('v', 'r2')]
    };
    const s = solveCircuit(g);
    // r2 in parallel with the meter is 909.1 Ω, so the meter reads well under
    // the 3 V an ideal voltmeter would show. This is the classic loading error.
    expect(s.voltage.get('v')).toBeGreaterThan(2.7);
    expect(s.voltage.get('v')).toBeLessThan(2.9);
    expect(s.current.get('v')).toBeGreaterThan(0);
    const expected = 6 * (909.0909 / (1000 + 909.0909));
    expect(s.voltage.get('v')).toBeCloseTo(expected, 3);
  });

  it('deflects a galvanometer from the current the model actually computed', () => {
    const g: CircuitGraph = {
      parts: [
        cell('c', 2, 0),
        { id: 'g', kind: 'galvanometer', resistance: 50, figureOfMerit: 1e-5, divisions: 30 },
        res('r', 1950)
      ],
      wires: seriesLoop('c', 'g', 'r')
    };
    const s = solveCircuit(g);
    expect(s.current.get('g')).toBeCloseTo(1e-3, 9);
  });
});

describe('the junction diode', () => {
  const diode = (id: string): Part => ({
    id,
    kind: 'diode',
    // Silicon small-signal diode: I_s ≈ 1 pA, ideality ≈ 1 at room temperature,
    // which puts the forward knee near 0.6 V as the NCERT characteristic shows.
    saturationCurrent: 1e-12,
    ideality: 1,
    temperatureK: 300
  });

  it('blocks in reverse and passes in forward bias', () => {
    const forward: CircuitGraph = {
      parts: [cell('c', 2, 0), diode('d'), res('r', 100)],
      wires: seriesLoop('c', 'd', 'r')
    };
    const reverse: CircuitGraph = {
      parts: [cell('c', -2, 0), diode('d'), res('r', 100)],
      wires: seriesLoop('c', 'd', 'r')
    };
    const f = solveCircuit(forward);
    const rv = solveCircuit(reverse);
    expect(f.converged).toBe(true);
    expect(f.current.get('d')).toBeGreaterThan(1e-3);
    expect(Math.abs(rv.current.get('d') ?? 1)).toBeLessThan(1e-9);
  });

  it('drops roughly a knee voltage once it is conducting', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 5, 0), diode('d'), res('r', 470)],
      wires: seriesLoop('c', 'd', 'r')
    };
    const s = solveCircuit(g);
    const vd = s.voltage.get('d') ?? 0;
    expect(vd).toBeGreaterThan(0.5);
    expect(vd).toBeLessThan(0.8);
    // Everything the diode does not drop appears across the resistor.
    expect(vd + (s.voltage.get('r') ?? 0)).toBeCloseTo(5, 6);
  });

  it('converges over a whole forward sweep without overflowing', () => {
    for (let v = -5; v <= 5; v += 0.25) {
      const g: CircuitGraph = {
        parts: [cell('c', v, 0), diode('d'), res('r', 220)],
        wires: seriesLoop('c', 'd', 'r')
      };
      const s = solveCircuit(g);
      expect(s.converged, `at ${v} V`).toBe(true);
      expect(Number.isFinite(s.current.get('d') ?? NaN), `at ${v} V`).toBe(true);
    }
  });

  it('is monotonic in the applied voltage', () => {
    const at = (v: number) =>
      solveCircuit({
        parts: [cell('c', v, 0), diode('d'), res('r', 220)],
        wires: seriesLoop('c', 'd', 'r')
      }).current.get('d') ?? 0;
    let last = at(-1);
    for (let v = -0.5; v <= 3; v += 0.25) {
      const now = at(v);
      expect(now).toBeGreaterThanOrEqual(last - 1e-12);
      last = now;
    }
  });
});

describe('a half-built bench', () => {
  it('solves a circuit with a component wired to nothing', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), res('r', 20), res('spare', 100)],
      wires: seriesLoop('c', 'r')
    };
    const s = solveCircuit(g);
    expect(s.current.get('r')).toBeCloseTo(6 / 20.5, 9);
    expect(s.current.get('spare')).toBeCloseTo(0, 9);
  });

  it('solves an empty bench without throwing', () => {
    const s = solveCircuit({ parts: [], wires: [] });
    expect(s.nodeVoltage.size).toBe(0);
    expect(s.converged).toBe(true);
  });

  it('is deterministic — the same graph twice gives the same numbers', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 4.5, 0.3), res('r1', 33), res('r2', 68)],
      wires: seriesLoop('c', 'r1', 'r2')
    };
    expect(solveCircuit(g).current.get('r1')).toBe(solveCircuit(g).current.get('r1'));
  });
});

describe('faults derived from the graph', () => {
  const ohmic = (): CircuitGraph => ({
    parts: [cell('c', 6, 0.5), key('k', true), res('r', 20)],
    wires: seriesLoop('c', 'k', 'r')
  });

  it('finds nothing wrong with a correctly wired loop', () => {
    const g = ohmic();
    expect(detectFaults(g, solveCircuit(g))).toEqual([]);
    expect(isMeasurable(detectFaults(g, solveCircuit(g)))).toBe(true);
  });

  it('reports the open circuit when the key is up', () => {
    const g: CircuitGraph = { ...ohmic(), parts: [cell('c', 6, 0.5), key('k', false), res('r', 20)] };
    const f = detectFaults(g, solveCircuit(g));
    expect(f.map((x) => x.kind)).toContain('open-circuit');
    expect(f[0].message).toMatch(/complete conducting path/i);
  });

  it('reports a short when the load is wired out of the loop', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), key('k', true)],
      wires: seriesLoop('c', 'k')
    };
    const f = detectFaults(g, solveCircuit(g));
    expect(f.map((x) => x.kind)).toContain('short-circuit');
    expect(isMeasurable(f)).toBe(false);
  });

  it('catches an ammeter bridged across the resistor instead of in series', () => {
    const g: CircuitGraph = {
      parts: [
        cell('c', 6, 0.5),
        res('r', 20),
        { id: 'a', kind: 'ammeter', resistance: 0.01, range: 5 }
      ],
      wires: [...seriesLoop('c', 'r'), ...across('a', 'r')]
    };
    const f = detectFaults(g, solveCircuit(g));
    const hit = f.find((x) => x.kind === 'ammeter-in-parallel');
    expect(hit?.severity).toBe('error');
    expect(hit?.parts).toContain('r');
  });

  it('catches a voltmeter inserted into the loop instead of across a part', () => {
    const g: CircuitGraph = {
      parts: [
        cell('c', 6, 0),
        res('r', 20),
        { id: 'v', kind: 'voltmeter', resistance: 100_000, range: 10 }
      ],
      wires: seriesLoop('c', 'v', 'r')
    };
    const f = detectFaults(g, solveCircuit(g));
    expect(f.map((x) => x.kind)).toContain('voltmeter-in-series');
  });

  it('leaves a correctly bridged voltmeter alone', () => {
    const g: CircuitGraph = {
      parts: [
        cell('c', 6, 0),
        res('r', 20),
        { id: 'v', kind: 'voltmeter', resistance: 100_000, range: 10 }
      ],
      wires: [...seriesLoop('c', 'r'), ...across('v', 'r')]
    };
    expect(detectFaults(g, solveCircuit(g)).map((x) => x.kind)).not.toContain('voltmeter-in-series');
  });

  it('notices a meter driven backwards by reversed leads', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), { id: 'a', kind: 'ammeter', resistance: 0.01, range: 5 }, res('r', 20)],
      // The meter is wired b-first, so current enters by its negative terminal.
      wires: [
        ...chain(terminal('c', 'a'), terminal('a', 'b')),
        ...chain(terminal('a', 'a'), terminal('r', 'a')),
        ...chain(terminal('r', 'b'), terminal('c', 'b'))
      ]
    };
    const f = detectFaults(g, solveCircuit(g));
    expect(f.map((x) => x.kind)).toContain('reversed-polarity');
  });

  it('reports a meter driven past its full-scale range', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.1), { id: 'a', kind: 'ammeter', resistance: 0.01, range: 0.5 }, res('r', 2)],
      wires: seriesLoop('c', 'a', 'r')
    };
    const f = detectFaults(g, solveCircuit(g));
    const over = f.find((x) => x.kind === 'over-range');
    expect(over?.severity).toBe('error');
    expect(over?.message).toMatch(/end stop/i);
  });

  it('mentions a component nobody has wired in yet', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), res('r', 20), res('spare', 47)],
      wires: seriesLoop('c', 'r')
    };
    const f = detectFaults(g, solveCircuit(g));
    const floating = f.find((x) => x.kind === 'floating-terminal');
    expect(floating?.severity).toBe('info');
    expect(floating?.parts).toEqual(['spare']);
  });

  it('sorts errors ahead of warnings ahead of notes', () => {
    const g: CircuitGraph = {
      parts: [cell('c', 6, 0.5), key('k', true), res('spare', 47)],
      wires: seriesLoop('c', 'k')
    };
    const f = detectFaults(g, solveCircuit(g));
    const severities = f.map((x) => x.severity);
    expect(severities).toEqual([...severities].sort((a, b) => ({ error: 0, warning: 1, info: 2 })[a] - ({ error: 0, warning: 1, info: 2 })[b]));
  });

  it('reports the external resistance the source actually sees', () => {
    const g = ohmic();
    expect(externalResistance(solveCircuit(g), 'c')).toBeCloseTo(20.001, 2);
  });
});
