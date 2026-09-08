import { describe, expect, it } from 'vitest';
import type { ParamValues } from '@/types/lab';
import { addWire, removeWire } from '@/physics-engine/circuit';
import { FORWARD_WIRING, REVERSE_WIRING, definition, readBench } from './iv-characteristic';
import { initialParams } from '@/hooks/useLabState';

const base = (): ParamValues => initialParams(definition);
const at = (over: ParamValues = {}) => readBench({ ...base(), ...over });

describe('the diode bench, forward-biased', () => {
  it('starts correctly wired', () => {
    expect(at().faults).toEqual([]);
  });

  it('puts the silicon knee near 0.7 V at a few milliamperes', () => {
    const r = at({ supply: 3, series: 220 });
    expect(r.deviceVoltage).toBeGreaterThan(0.6);
    expect(r.deviceVoltage).toBeLessThan(0.8);
    expect(r.deviceCurrent).toBeGreaterThan(2e-3);
    expect(r.deviceCurrent).toBeLessThan(20e-3);
  });

  it('puts the germanium knee near 0.3 V', () => {
    const r = at({ device: 'germanium', supply: 3, series: 220 });
    expect(r.deviceVoltage).toBeGreaterThan(0.2);
    expect(r.deviceVoltage).toBeLessThan(0.45);
  });

  it('holds the diode voltage almost constant while the current changes tenfold', () => {
    const low = at({ supply: 1.5, series: 1000 });
    const high = at({ supply: 6, series: 100 });
    expect(high.deviceCurrent / low.deviceCurrent).toBeGreaterThan(10);
    // Past the knee the diode voltage barely moves — which is why only the
    // series resistance limits the current.
    expect(high.deviceVoltage - low.deviceVoltage).toBeLessThan(0.25);
  });

  it('lets the series resistance actually limit the current', () => {
    // The pre-2.0 model computed the diode current from the applied voltage
    // alone, so the series resistor did nothing at all.
    const stiff = at({ series: 1000 });
    const slack = at({ series: 10 });
    expect(slack.deviceCurrent).toBeGreaterThan(stiff.deviceCurrent * 5);
  });

  it('reports going past the meter’s full scale rather than drawing it anyway', () => {
    const r = at({ supply: 6, series: 10 });
    expect(r.deviceCurrent).toBeGreaterThan(0.05);
    expect(r.faults.map((f) => f.kind)).toContain('over-range');
  });

  it('is ohmic when a resistor is in the mount', () => {
    for (const supply of [1, 3, 6]) {
      const r = at({ device: 'resistor', rDevice: 220, supply, series: 220 });
      expect(r.deviceVoltage / r.deviceCurrent).toBeGreaterThan(215);
      expect(r.deviceVoltage / r.deviceCurrent).toBeLessThan(225);
    }
  });
});

describe('the reverse characteristic comes from turning the device round', () => {
  it('blocks when the device is reversed in its mount', () => {
    const forward = at({ wiring: FORWARD_WIRING });
    const reverse = at({ wiring: REVERSE_WIRING });
    expect(reverse.deviceCurrent).toBeLessThan(0);
    expect(Math.abs(reverse.deviceCurrent)).toBeLessThan(forward.deviceCurrent / 1000);
  });

  it('saturates at the reverse saturation current, not at zero', () => {
    const si = at({ wiring: REVERSE_WIRING, device: 'silicon', supply: 6 });
    const ge = at({ wiring: REVERSE_WIRING, device: 'germanium', supply: 6 });
    // Silicon leaks about a nanoampere; germanium about a thousand times more.
    expect(Math.abs(si.deviceCurrent)).toBeGreaterThan(5e-10);
    expect(Math.abs(si.deviceCurrent)).toBeLessThan(5e-9);
    expect(Math.abs(ge.deviceCurrent)).toBeGreaterThan(Math.abs(si.deviceCurrent) * 100);
  });

  it('keeps the voltmeter pointer on the scale, because its leads turn round too', () => {
    const r = at({ wiring: REVERSE_WIRING, supply: 4 });
    expect(r.voltmeter).toBeGreaterThan(0);
    expect(r.faults.map((f) => f.kind)).not.toContain('reversed-polarity');
  });

  it('reads the voltmeter’s own current in reverse, and says so', () => {
    // Once the diode blocks, the voltmeter is the easiest path in that branch.
    // For silicon the meter is reading almost nothing but the voltmeter; for
    // germanium the diode contributes a comparable amount. Hiding this would
    // be the fake-realism the model is meant to avoid.
    const si = at({ wiring: REVERSE_WIRING, device: 'silicon', meterRange: 'uA', supply: 6 });
    expect(Math.abs(si.ammeter)).toBeCloseTo(Math.abs(si.voltmeterCurrent), 8);
    expect(Math.abs(si.deviceCurrent)).toBeLessThan(Math.abs(si.voltmeterCurrent) / 100);

    const ge = at({ wiring: REVERSE_WIRING, device: 'germanium', meterRange: 'uA', supply: 6 });
    expect(Math.abs(ge.deviceCurrent)).toBeGreaterThan(Math.abs(ge.voltmeterCurrent) / 2);
    expect(Math.abs(ge.ammeter)).toBeGreaterThan(Math.abs(si.ammeter));
  });
});

describe('temperature', () => {
  it('grows the reverse saturation current and lowers the forward knee', () => {
    const cold = at({ temp: 0, wiring: REVERSE_WIRING, supply: 6 });
    const hot = at({ temp: 100, wiring: REVERSE_WIRING, supply: 6 });
    expect(Math.abs(hot.deviceCurrent)).toBeGreaterThan(Math.abs(cold.deviceCurrent) * 100);

    const coldF = at({ temp: 0 });
    const hotF = at({ temp: 100 });
    expect(hotF.deviceVoltage).toBeLessThan(coldF.deviceVoltage);
  });
});

describe('mistakes and half-built circuits', () => {
  it('reports a bare bench as open', () => {
    const r = at({ wiring: '' });
    expect(r.closedPath).toBe(false);
    expect(r.faults.map((f) => f.kind)).toContain('open-circuit');
  });

  it('catches the ammeter bridged across the device', () => {
    let w = removeWire(FORWARD_WIRING, 'dev.b', 'am.a');
    w = removeWire(w, 'am.b', 'rh.a');
    w = addWire(w, 'dev.b', 'rh.a');
    w = addWire(w, 'am.a', 'dev.a');
    w = addWire(w, 'am.b', 'dev.b');
    expect(at({ wiring: w }).faults.map((f) => f.kind)).toContain('ammeter-in-parallel');
  });

  it('never produces a number that is not finite, over the whole control range', () => {
    for (const device of ['silicon', 'germanium', 'resistor']) {
      for (const wiring of [FORWARD_WIRING, REVERSE_WIRING, '']) {
        for (const supply of [0, 0.5, 3, 6]) {
          for (const series of [10, 1000]) {
            for (const temp of [0, 100]) {
              const r = at({ device, wiring, supply, series, temp });
              const where = `${device} ${supply}V ${series}Ω ${temp}°C`;
              expect(Number.isFinite(r.deviceCurrent), where).toBe(true);
              expect(Number.isFinite(r.deviceVoltage), where).toBe(true);
              expect(Number.isFinite(r.ammeter), where).toBe(true);
              expect(Number.isFinite(r.voltmeter), where).toBe(true);
            }
          }
        }
      }
    }
  });

  it('leaves the wiring valid when the device in the mount is swapped', () => {
    // The mount fixes the socket spacing, so a student who has wired the bench
    // does not have to rewire it to change the device.
    for (const device of ['silicon', 'germanium', 'resistor']) {
      expect(at({ device }).faults, device).toEqual([]);
    }
  });
});
