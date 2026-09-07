import { describe, expect, it } from 'vitest';
import {
  FLOW_DISCLOSURE,
  MOTION,
  durationOf,
  flowPeriodSeconds,
  transitionOf,
  type MotionToken
} from './tokens';

const TOKENS = Object.keys(MOTION) as MotionToken[];

describe('motion tokens', () => {
  it('gives every token a duration, an easing and a stated meaning', () => {
    for (const t of TOKENS) {
      expect(MOTION[t].duration, t).toBeGreaterThanOrEqual(0);
      expect(MOTION[t].easing.length, t).toBeGreaterThan(0);
      expect(MOTION[t].meaning.length, t).toBeGreaterThan(10);
    }
  });

  it('collapses every duration to zero when motion is reduced', () => {
    for (const t of TOKENS) {
      expect(durationOf(t, true), t).toBe(0);
      expect(transitionOf(t, 'transform', true), t).toBe('none');
    }
  });

  it('keeps the needle settle that the moving-coil meter already used', () => {
    expect(MOTION.settle.duration).toBe(260);
    expect(durationOf('settle')).toBe(260);
  });

  it('builds a CSS transition for a property', () => {
    expect(transitionOf('snap', 'transform')).toBe('transform 120ms cubic-bezier(.2,.9,.3,1.2)');
  });

  it('speeds the flow cue up as the current grows, within readable bounds', () => {
    expect(flowPeriodSeconds(0)).toBe(0);
    expect(flowPeriodSeconds(1e-12)).toBe(0);
    const small = flowPeriodSeconds(0.01);
    const big = flowPeriodSeconds(2);
    expect(big).toBeLessThan(small);
    for (const i of [1e-6, 0.001, 0.1, 1, 50, 1e4]) {
      expect(flowPeriodSeconds(i)).toBeGreaterThanOrEqual(0.25);
      expect(flowPeriodSeconds(i)).toBeLessThanOrEqual(3);
    }
  });

  it('reverses nothing by magnitude alone — direction is the view’s job', () => {
    expect(flowPeriodSeconds(-0.5)).toBe(flowPeriodSeconds(0.5));
  });

  it('states plainly that the flow animation is not electron drift', () => {
    expect(FLOW_DISCLOSURE).toMatch(/not literal electron drift/i);
  });
});
