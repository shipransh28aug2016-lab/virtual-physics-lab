import { describe, expect, it } from 'vitest';
import { HEALTHY, diagnose, nextHint } from './rules';

describe('rule-based feedback', () => {
  it('says nothing when the bench is in a readable state', () => {
    expect(diagnose(HEALTHY)).toEqual([]);
    expect(nextHint(HEALTHY)).toBeNull();
  });

  it('explains an open circuit rather than reporting an error code', () => {
    const h = nextHint({ ...HEALTHY, closedPath: false, current: 0 });
    expect(h?.kind).toBe('open-circuit');
    expect(h?.explanation).toMatch(/complete conducting path/i);
    expect(h?.action.length).toBeGreaterThan(20);
  });

  it('ranks a short circuit above an open one when both are reported', () => {
    const hints = diagnose({ ...HEALTHY, closedPath: false, shorted: true });
    expect(hints[0].kind).toBe('short-circuit');
    expect(hints[0].severity).toBe('error');
  });

  it('catches each meter misplacement separately', () => {
    expect(nextHint({ ...HEALTHY, ammeterInParallel: true })?.kind).toBe('meter-placement');
    expect(nextHint({ ...HEALTHY, voltmeterInSeries: true })?.kind).toBe('meter-placement');
    expect(
      diagnose({ ...HEALTHY, ammeterInParallel: true, voltmeterInSeries: true })
    ).toHaveLength(2);
  });

  it('treats reversed polarity as a warning, not a failure', () => {
    const h = nextHint({ ...HEALTHY, reversedPolarity: true });
    expect(h?.kind).toBe('polarity');
    expect(h?.severity).toBe('warning');
  });

  it('warns off the ends of the scale in both directions', () => {
    expect(nextHint({ ...HEALTHY, meterFraction: 1.4 })?.kind).toBe('over-range');
    expect(nextHint({ ...HEALTHY, meterFraction: 0.04 })?.kind).toBe('off-scale');
    expect(nextHint({ ...HEALTHY, meterFraction: 0.5 })).toBeNull();
  });

  it('mentions floating terminals only once the loop is otherwise closed', () => {
    expect(diagnose({ ...HEALTHY, floatingTerminals: 2 }).map((h) => h.kind)).toContain('floating');
    const open = diagnose({ ...HEALTHY, closedPath: false, floatingTerminals: 2 });
    expect(open.map((h) => h.kind)).not.toContain('floating');
  });

  it('gives every hint an observation, an explanation and a physical action', () => {
    const states = [
      { ...HEALTHY, closedPath: false },
      { ...HEALTHY, shorted: true },
      { ...HEALTHY, ammeterInParallel: true },
      { ...HEALTHY, voltmeterInSeries: true },
      { ...HEALTHY, reversedPolarity: true },
      { ...HEALTHY, meterFraction: 2 },
      { ...HEALTHY, meterFraction: 0.02 },
      { ...HEALTHY, floatingTerminals: 1 },
      { ...HEALTHY, current: 0 }
    ];
    for (const s of states) {
      for (const h of diagnose(s)) {
        expect(h.observation.length, h.kind).toBeGreaterThan(15);
        expect(h.explanation.length, h.kind).toBeGreaterThan(40);
        expect(h.action.length, h.kind).toBeGreaterThan(20);
        expect(h.action, h.kind).not.toMatch(/\bclick\b|\bbutton\b|\btap\b/i);
      }
    }
  });
});
