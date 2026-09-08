import { describe, expect, it } from 'vitest';
import type { ParamValues } from '@/types/lab';
import { CORRECT_WIRING, SHUNT_IN_SERIES, definition, readBench } from './galvanometer-half-deflection';
import { initialParams } from '@/hooks/useLabState';

const base = (): ParamValues => initialParams(definition);
const at = (over: ParamValues = {}) => readBench({ ...base(), ...over });

describe('setting up full-scale deflection', () => {
  it('starts correctly wired', () => {
    expect(at().faults).toEqual([]);
  });

  it('puts the pointer near full scale with the shunt key open', () => {
    const r = at();
    expect(r.deflection).toBeGreaterThan(29);
    expect(r.deflection).toBeLessThanOrEqual(30);
  });

  it('makes adjusting R a real task — the deflection is not simply n', () => {
    // I = E/(R + G + r), so R alone decides where the pointer sits.
    expect(at({ seriesR: 5000 }).deflection).toBeGreaterThan(at({ seriesR: 20000 }).deflection);
  });

  it('reports the pointer hard against the stop when R is far too small', () => {
    const r = at({ seriesR: 1000, emf: 6 });
    expect(r.deflection).toBeGreaterThan(30);
    expect(r.faults.map((f) => f.kind)).toContain('over-range');
  });

  it('reads zero with the key up', () => {
    const r = at({ k1Closed: false });
    expect(Math.abs(r.deflection)).toBeLessThan(1e-6);
    expect(r.faults.map((f) => f.kind)).toContain('open-circuit');
  });
});

describe('the half-deflection measurement', () => {
  it('halves the deflection at S = RG/(R + G)', () => {
    const full = at().deflection;
    const half = at({ shuntClosed: true, shunt: at().idealShunt });
    expect(half.deflection).toBeCloseTo(full / 2, 1);
  });

  it('recovers the coil resistance from G = RS/(R − S)', () => {
    for (const galvanometer of ['a', 'b', 'c']) {
      const r0 = at({ galvanometer });
      const r = at({ galvanometer, shuntClosed: true, shunt: r0.idealShunt });
      expect(r.measuredG, galvanometer).toBeCloseTo(r.trueG, 0);
    }
  });

  it('needs a different shunt for each instrument, so the answer is not shared', () => {
    const shunts = ['a', 'b', 'c'].map((galvanometer) => at({ galvanometer }).idealShunt);
    expect(new Set(shunts.map((s) => s.toFixed(1))).size).toBe(3);
  });

  it('leaves the pointer above half when the shunt is too large', () => {
    const ideal = at().idealShunt;
    const tooBig = at({ shuntClosed: true, shunt: ideal * 4 });
    expect(tooBig.deflection).toBeGreaterThan(at().deflection / 2);
  });

  it('measures a little low, exactly as the viva answer says it should', () => {
    // Adding the shunt lowers the total resistance and raises the total
    // current, so the constant-current assumption is only approximate. The
    // pre-2.0 module asserted this in the viva but could not show it, because
    // it computed the deflection from that very assumption.
    const r = at({ shuntClosed: true, shunt: at().idealShunt });
    expect(r.measuredG).toBeLessThan(r.trueG + 0.5);
    expect(r.measuredG).toBeGreaterThan(r.trueG * 0.97);
  });
});

describe('the shunt in the loop — the mistake the method depends on not making', () => {
  it('barely changes the deflection, because a few tens of ohms is nothing beside R', () => {
    const across = at({ wiring: CORRECT_WIRING, shuntClosed: true, shunt: 62 });
    const inSeries = at({ wiring: SHUNT_IN_SERIES, shuntClosed: true, shunt: 62 });
    const full = at().deflection;

    expect(across.deflection).toBeLessThan(full * 0.55);
    expect(inSeries.deflection).toBeGreaterThan(full * 0.99);
  });

  it('offers no half-deflection point at all over the whole shunt range', () => {
    const full = at().deflection;
    for (let s = 5; s <= 500; s += 45) {
      const r = at({ wiring: SHUNT_IN_SERIES, shuntClosed: true, shunt: s });
      expect(r.deflection, `S = ${s}`).toBeGreaterThan(full * 0.94);
    }
  });
});

describe('the coil resistance is the unknown, not a control', () => {
  it('has no control that sets the quantity being measured', () => {
    const keys = definition.controls.map((c) => c.key);
    expect(keys).not.toContain('trueG');
    expect(keys).toContain('galvanometer');
  });

  it('keeps the marked value available only for the notebook comparison', () => {
    expect(at({ galvanometer: 'b' }).trueG).toBe(118);
  });
});

describe('robustness', () => {
  it('reports a bare bench as open', () => {
    expect(at({ wiring: '' }).faults.map((f) => f.kind)).toContain('open-circuit');
  });

  it('never produces a non-finite reading across the control range', () => {
    for (const galvanometer of ['a', 'b', 'c']) {
      for (const wiring of [CORRECT_WIRING, SHUNT_IN_SERIES, '']) {
        for (const emf of [1, 6]) {
          for (const seriesR of [1000, 20000]) {
            for (const shunt of [5, 500]) {
              for (const shuntClosed of [true, false]) {
                const r = at({ galvanometer, wiring, emf, seriesR, shunt, shuntClosed });
                const where = `${galvanometer} ${emf}V ${seriesR}Ω ${shunt}Ω`;
                expect(Number.isFinite(r.deflection), where).toBe(true);
                expect(Number.isFinite(r.coilCurrent), where).toBe(true);
                expect(Number.isFinite(r.idealShunt), where).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});
