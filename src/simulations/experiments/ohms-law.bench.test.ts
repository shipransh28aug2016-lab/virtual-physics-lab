import { describe, expect, it } from 'vitest';
import type { ParamValues } from '@/types/lab';
import { addWire, removeWire } from '@/physics-engine/circuit';
import { CORRECT_WIRING, definition, readBench } from './ohms-law';
import { initialParams } from '@/hooks/useLabState';

const base = (): ParamValues => initialParams(definition);
const at = (over: ParamValues = {}) => readBench({ ...base(), ...over });

describe('the Ohm’s law bench, wired as the practical asks', () => {
  it('starts correctly wired with nothing to complain about', () => {
    expect(at().faults).toEqual([]);
  });

  it('reads the loop current the theory predicts, to within the meter loading', () => {
    const r = at();
    const ideal = 6 / (20 + 10 + 0.5);
    expect(r.ammeter).toBeGreaterThan(ideal * 0.98);
    expect(r.ammeter).toBeLessThan(ideal * 1.02);
  });

  it('reads a voltmeter value that is slightly below the ideal IR product', () => {
    const r = at();
    // The voltmeter draws its own current, so V/I from the meters is a little
    // under the marked 20 Ω. That gap is the loading error, and it is real.
    const measured = r.voltmeter / r.ammeter;
    expect(measured).toBeLessThan(20);
    expect(measured).toBeGreaterThan(19.9);
  });

  it('keeps V = IR for the resistor itself', () => {
    for (const load of [1, 5, 20, 47, 100]) {
      const r = at({ load });
      expect(r.voltmeter / r.ammeter).toBeGreaterThan(load * 0.97);
      expect(r.voltmeter / r.ammeter).toBeLessThanOrEqual(load);
    }
  });

  it('drops the terminal voltage below the emf as the current grows', () => {
    const light = at({ load: 100 });
    const heavy = at({ load: 1, rheostat: 0 });
    expect(light.terminalVoltage).toBeGreaterThan(heavy.terminalVoltage);
    expect(light.terminalVoltage).toBeLessThanOrEqual(6);
  });

  it('sweeps the current with the rheostat, which is what the practical is for', () => {
    const high = at({ rheostat: 0 }).ammeter;
    const low = at({ rheostat: 50 }).ammeter;
    expect(high).toBeGreaterThan(low);
  });

  it('reads zero on both meters with the key open', () => {
    const r = at({ closed: false });
    expect(Math.abs(r.ammeter)).toBeLessThan(1e-6);
    expect(Math.abs(r.voltmeter)).toBeLessThan(1e-6);
    expect(r.faults.map((f) => f.kind)).toContain('open-circuit');
  });
});

describe('mistakes a student can actually make', () => {
  it('reports a bare bench as an open circuit', () => {
    const r = at({ wiring: '' });
    expect(r.closedPath).toBe(false);
    expect(r.faults.map((f) => f.kind)).toContain('open-circuit');
    expect(Math.abs(r.ammeter)).toBeLessThan(1e-9);
  });

  it('notices a single lead pulled out of the loop', () => {
    const broken = removeWire(CORRECT_WIRING, 'r.b', 'am.a');
    const r = at({ wiring: broken });
    expect(r.faults.map((f) => f.kind)).toContain('open-circuit');
  });

  it('catches the ammeter bridged across the resistor', () => {
    // Take the ammeter out of the loop and hang it across the resistor instead.
    let w = removeWire(CORRECT_WIRING, 'r.b', 'am.a');
    w = removeWire(w, 'am.b', 'rh.a');
    w = addWire(w, 'r.b', 'rh.a');
    w = addWire(w, 'am.a', 'r.a');
    w = addWire(w, 'am.b', 'r.b');
    const r = at({ wiring: w });
    expect(r.faults.map((f) => f.kind)).toContain('ammeter-in-parallel');
    expect(r.faults.some((f) => f.severity === 'error')).toBe(true);
  });

  it('catches the voltmeter dropped into the loop', () => {
    // Unbridge the voltmeter and put it in series where the resistor was fed.
    let w = removeWire(CORRECT_WIRING, 'r.a', 'vm.a');
    w = removeWire(w, 'r.b', 'vm.b');
    w = removeWire(w, 'k.a', 'r.a');
    w = addWire(w, 'k.a', 'vm.a');
    w = addWire(w, 'vm.b', 'r.a');
    const r = at({ wiring: w });
    expect(r.faults.map((f) => f.kind)).toContain('voltmeter-in-series');
  });

  it('drives the ammeter backwards when its leads are swapped', () => {
    let w = removeWire(CORRECT_WIRING, 'r.b', 'am.a');
    w = removeWire(w, 'am.b', 'rh.a');
    w = addWire(w, 'r.b', 'am.b');
    w = addWire(w, 'am.a', 'rh.a');
    const r = at({ wiring: w });
    expect(r.ammeter).toBeLessThan(0);
    expect(r.faults.map((f) => f.kind)).toContain('reversed-polarity');
  });

  it('shorts the cell when a lead is dropped straight across its terminals', () => {
    const r = at({ wiring: addWire(CORRECT_WIRING, 'c.a', 'c.b'), rheostat: 0 });
    expect(r.faults.map((f) => f.kind)).toContain('short-circuit');
    expect(r.faults.some((f) => f.severity === 'error')).toBe(true);
  });

  it('does not call a bypassed resistor a short of the cell — the meter still limits it', () => {
    // A lead across the resistor leaves the ammeter and the rheostat in the
    // loop, so the current is large but finite. Calling that a cell short would
    // be a lie; pegging the ammeter is what actually happens.
    const r = at({ wiring: addWire(CORRECT_WIRING, 'k.a', 'am.a'), rheostat: 0 });
    expect(r.faults.map((f) => f.kind)).not.toContain('short-circuit');
    expect(r.faults.map((f) => f.kind)).toContain('over-range');
    expect(Number.isFinite(r.ammeter)).toBe(true);
  });

  it('pushes the ammeter past full scale on a heavy current', () => {
    const r = at({ load: 1, rheostat: 0, emf: 12, rInt: 0 });
    expect(Math.abs(r.ammeter)).toBeGreaterThan(1.5);
    expect(r.faults.map((f) => f.kind)).toContain('over-range');
  });

  it('never lets a mis-wired bench produce a number that is not finite', () => {
    const wirings = ['', CORRECT_WIRING, addWire(CORRECT_WIRING, 'c.a', 'c.b')];
    for (const wiring of wirings) {
      for (const emf of [0, 6, 12]) {
        for (const rInt of [0, 5]) {
          const r = at({ wiring, emf, rInt });
          expect(Number.isFinite(r.ammeter), `${emf} V, r=${rInt}`).toBe(true);
          expect(Number.isFinite(r.voltmeter)).toBe(true);
          expect(Number.isFinite(r.terminalVoltage)).toBe(true);
        }
      }
    }
  });
});

describe('the wiring is an ordinary parameter', () => {
  it('offers the two starting layouts as options on the control', () => {
    const wiring = definition.controls.find((c) => c.key === 'wiring');
    expect(wiring?.kind).toBe('select');
    if (wiring?.kind !== 'select') return;
    expect(wiring.options.map((o) => o.value)).toContain(CORRECT_WIRING);
    expect(wiring.options.map((o) => o.value)).toContain('');
    expect(wiring.initial).toBe(CORRECT_WIRING);
  });

  it('is canonical, so the order the student wired in does not matter', () => {
    const shuffled = CORRECT_WIRING.split(';').reverse().join(';');
    expect(at({ wiring: shuffled }).ammeter).toBeCloseTo(at().ammeter, 12);
  });
});
