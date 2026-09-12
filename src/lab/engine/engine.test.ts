import { describe, expect, it, vi } from 'vitest';
import { PhysicsEngine, createEngine } from './PhysicsEngine';
import { CONSTANTS } from '@/physics-engine/constants';

/** A projectile in SI units — the smallest honest time-dependent system. */
const projectile = () =>
  createEngine({
    initial: { x: 0, y: 0, vx: 10, vy: 20, g: 9.81 },
    units: { x: 'm', y: 'm', vx: 'm/s', vy: 'm/s', g: 'm/s^2' },
    derive: (s) => ({ speed: Math.hypot(s.vx, s.vy), ke: 0.5 * 1 * (s.vx ** 2 + s.vy ** 2) }),
    integrate: (s, dt) => ({
      x: s.x + s.vx * dt,
      y: s.y + s.vy * dt - 0.5 * s.g * dt * dt,
      vy: s.vy - s.g * dt
    }),
    maxStep: 1 / 240
  });

describe('state', () => {
  it('holds quantities in SI units and reports them', () => {
    const e = projectile();
    expect(e.get('vx')).toBe(10);
    expect(e.unitOf('vx')).toBe('m/s');
    expect(e.unitOf('x')).toBe('m');
  });

  it('reads numbers, booleans and strings safely', () => {
    const e = createEngine({ initial: { a: 3, b: true, c: 'x', bad: Number.NaN } });
    expect(e.num('a')).toBe(3);
    expect(e.num('bad', 7)).toBe(7);
    expect(e.bool('b')).toBe(true);
    expect(e.str('c')).toBe('x');
    expect(e.num('missing' as 'a', 1)).toBe(1);
  });

  it('notifies on a change and stays quiet on a write that changes nothing', () => {
    const e = projectile();
    const seen = vi.fn();
    e.subscribe(seen);

    e.set('vx', 12);
    expect(seen).toHaveBeenCalledTimes(1);
    e.set('vx', 12);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('patches several fields with one notification', () => {
    const e = projectile();
    const seen = vi.fn();
    e.subscribe(seen);
    e.patch({ vx: 1, vy: 2 });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(e.get('vx')).toBe(1);
    expect(e.get('vy')).toBe(2);
  });

  it('stops notifying once a listener unsubscribes', () => {
    const e = projectile();
    const seen = vi.fn();
    const off = e.subscribe(seen);
    e.set('vx', 1);
    off();
    e.set('vx', 2);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('returns to its starting state, clock included', () => {
    const e = projectile();
    e.set('vx', 99);
    e.step(1);
    e.reset();
    expect(e.get('vx')).toBe(10);
    expect(e.time).toBe(0);
  });
});

describe('derived quantities', () => {
  it('computes the physics from the state', () => {
    const e = projectile();
    expect(e.derived().speed).toBeCloseTo(Math.hypot(10, 20), 12);
  });

  it('memoises while nothing moves, and recomputes when something does', () => {
    const derive = vi.fn(() => ({ v: 1 }));
    const e = createEngine({ initial: { a: 0 }, derive });

    e.derived();
    e.derived();
    e.derived();
    expect(derive).toHaveBeenCalledTimes(1);

    e.set('a', 1);
    e.derived();
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it('recomputes when only the clock has moved', () => {
    const derive = vi.fn((_s: { a: number }, t: number) => ({ phase: t }));
    const e = createEngine({ initial: { a: 0 }, derive });
    expect(e.derived().phase).toBe(0);
    e.step(0.5);
    expect(e.derived().phase).toBeCloseTo(0.5, 9);
  });

  it('gives an empty object when an experiment derives nothing', () => {
    expect(createEngine({ initial: { a: 1 } }).derived()).toEqual({});
  });
});

describe('time integration', () => {
  it('advances the clock by the step', () => {
    const e = projectile();
    e.step(0.5);
    expect(e.time).toBeCloseTo(0.5, 9);
  });

  it('integrates projectile motion to the analytic answer', () => {
    // x = vx t and y = vy t - ½gt² are exact for this integrator, so a whole
    // second of small steps must land on the closed-form values.
    const e = projectile();
    for (let i = 0; i < 240; i += 1) e.step(1 / 240);
    expect(e.get('x')).toBeCloseTo(10, 6);
    expect(e.get('y')).toBeCloseTo(20 - 0.5 * 9.81, 2);
    expect(e.get('vy')).toBeCloseTo(20 - 9.81, 6);
  });

  it('splits a long frame into sub-steps rather than jumping', () => {
    // A stalled tab must not integrate a whole second in one go.
    const fine = projectile();
    for (let i = 0; i < 240; i += 1) fine.step(1 / 240);

    const coarse = projectile();
    coarse.step(1);

    expect(coarse.time).toBeCloseTo(fine.time, 9);
    expect(coarse.get('vy')).toBeCloseTo(fine.get('vy'), 6);
  });

  it('advances by exactly the time asked for, without swallowing any', () => {
    // Deciding how much wall-clock time to believe belongs to the render loop.
    // The engine integrating less than it was asked for would be a lie that is
    // very hard to find later.
    const e = projectile();
    e.step(60);
    expect(e.time).toBeCloseTo(60, 6);
  });

  it('bounds the work a very long step may do', () => {
    // maxStep is 1/240 s, so a naive loop would take 144 000 iterations for a
    // ten-minute step. The sub-step grows instead of the thread locking up.
    const e = projectile();
    const started = Date.now();
    e.step(600);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(e.time).toBeCloseTo(600, 3);
  });

  it('ignores a step that is zero, negative or not a number', () => {
    const e = projectile();
    e.step(0);
    e.step(-1);
    e.step(Number.NaN);
    expect(e.time).toBe(0);
    expect(e.get('x')).toBe(0);
  });

  it('advances the clock for a steady-state experiment with no integrator', () => {
    const e = createEngine({ initial: { r: 20 } });
    e.step(1 / 60);
    expect(e.time).toBeCloseTo(1 / 60, 9);
    expect(e.get('r')).toBe(20);
  });

  it('rewinds the clock without disturbing the state', () => {
    const e = projectile();
    e.step(0.5);
    const x = e.get('x');
    e.resetTime();
    expect(e.time).toBe(0);
    expect(e.get('x')).toBe(x);
  });
});

describe('the revision counter a render loop watches', () => {
  it('moves on a state change and on a time step, not on an idle read', () => {
    const e = projectile();
    const start = e.revision;
    expect(e.snapshot.vx).toBe(10); // reading does not count as a change
    e.derived();
    expect(e.revision).toBe(start);

    e.set('vx', 4);
    expect(e.revision).toBeGreaterThan(start);
    const afterSet = e.revision;
    e.step(1 / 60);
    expect(e.revision).toBeGreaterThan(afterSet);
  });
});

describe('it is a plain class, not a framework', () => {
  it('constructs without React, a DOM or a canvas', () => {
    expect(new PhysicsEngine({ initial: { a: 1 } })).toBeInstanceOf(PhysicsEngine);
  });

  it('leaves the caller free to use the shared physical constants', () => {
    const e = createEngine({
      initial: { q1: 1e-6, q2: 2e-6, r: 0.1 },
      units: { q1: 'C', q2: 'C', r: 'm' },
      // Coulomb's law, F = k q₁q₂ / r², with k from the shared constants table.
      derive: (s) => ({ force: (CONSTANTS.K_E * s.q1 * s.q2) / (s.r * s.r) })
    });
    expect(e.derived().force).toBeCloseTo((8.9875517923e9 * 1e-6 * 2e-6) / 0.01, 6);
  });
});
