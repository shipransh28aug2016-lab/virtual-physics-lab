import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useConnect } from './useConnect';

/** Drives the hook the way a bench does: state lives outside, the hook edits it. */
function bench(initial = '') {
  let wiring = initial;
  const cues: string[] = [];
  const view = renderHook(() =>
    useConnect({
      wiring,
      onChange: (w) => {
        wiring = w;
        view.rerender();
      },
      onCue: (c) => cues.push(c)
    })
  );
  return { view, cues, get wiring() { return wiring; } };
}

describe('connecting a lead', () => {
  it('takes two presses: pick up, then put down', () => {
    const b = bench();
    act(() => b.view.result.current.press('c.a'));
    expect(b.view.result.current.held).toBe('c.a');
    expect(b.wiring).toBe('');

    act(() => b.view.result.current.press('r.a'));
    expect(b.view.result.current.held).toBeNull();
    expect(b.wiring).toBe('c.a-r.a');
    expect(b.cues).toEqual(['plug']);
  });

  it('puts the lead back down when the same terminal is pressed twice', () => {
    const b = bench();
    act(() => b.view.result.current.press('c.a'));
    act(() => b.view.result.current.press('c.a'));
    expect(b.view.result.current.held).toBeNull();
    expect(b.wiring).toBe('');
  });

  it('pressing a pair that is already joined disconnects it', () => {
    const b = bench('c.a-r.a');
    act(() => b.view.result.current.press('c.a'));
    act(() => b.view.result.current.press('r.a'));
    expect(b.wiring).toBe('');
    expect(b.cues).toEqual(['unplug']);
  });

  it('pulls every lead out of a terminal on detach', () => {
    const b = bench('c.a-r.a;c.a-v.a;r.b-c.b');
    act(() => b.view.result.current.detach('c.a'));
    expect(b.wiring).toBe('c.b-r.b');
  });

  it('does not cue an unplug on a terminal that has nothing in it', () => {
    const b = bench('');
    act(() => b.view.result.current.detach('c.a'));
    expect(b.cues).toEqual([]);
  });

  it('abandons a held lead on release', () => {
    const b = bench();
    act(() => b.view.result.current.press('c.a'));
    act(() => b.view.result.current.release());
    expect(b.view.result.current.held).toBeNull();
    expect(b.wiring).toBe('');
  });
});

describe('the terminal state machine', () => {
  it('walks disconnected → aligned → connected → active', () => {
    const b = bench();
    expect(b.view.result.current.stateOf('c.a')).toBe('disconnected');

    act(() => b.view.result.current.press('c.a'));
    expect(b.view.result.current.stateOf('c.a')).toBe('aligned');
    expect(b.view.result.current.stateOf('r.a')).toBe('aligned');

    act(() => b.view.result.current.press('r.a'));
    expect(b.view.result.current.stateOf('c.a')).toBe('connected');
    expect(b.view.result.current.stateOf('c.a', { current: 0.3 })).toBe('active');
    expect(b.view.result.current.stateOf('c.a', { measuring: true })).toBe('measuring');
  });

  it('does not call a terminal active on a current below the noise floor', () => {
    const b = bench('c.a-r.a');
    expect(b.view.result.current.stateOf('c.a', { current: 1e-15 })).toBe('connected');
  });

  it('counts the connections on the bench', () => {
    const b = bench('c.a-r.a;r.b-c.b');
    expect(b.view.result.current.connections).toBe(2);
  });
});

describe('what a screen reader hears', () => {
  it('describes every stage of the gesture in words, not colours', () => {
    const b = bench();
    expect(b.view.result.current.describe('c.a', 'Cell, positive')).toMatch(/not connected.*pick up a lead/i);

    act(() => b.view.result.current.press('c.a'));
    expect(b.view.result.current.describe('c.a', 'Cell, positive')).toMatch(/lead held here/i);
    expect(b.view.result.current.describe('r.a', 'Resistor, left')).toMatch(/press to connect the held lead/i);

    act(() => b.view.result.current.press('r.a'));
    expect(b.view.result.current.describe('c.a', 'Cell, positive')).toMatch(/connected by 1 lead/i);
  });

  it('says how many leads a busy terminal carries', () => {
    const b = bench('c.a-r.a;c.a-v.a');
    expect(b.view.result.current.describe('c.a', 'Cell, positive')).toMatch(/connected by 2 leads/i);
  });

  it('never describes a terminal by colour alone', () => {
    const b = bench('c.a-r.a');
    const words = b.view.result.current.describe('c.a', 'Cell, positive');
    expect(words).not.toMatch(/\b(green|red|amber|blue|yellow)\b/i);
  });
});

describe('the keyboard path is the same path', () => {
  it('reaches an identical netlist however the presses arrive', () => {
    const pointer = bench();
    act(() => pointer.view.result.current.press('c.a'));
    act(() => pointer.view.result.current.press('r.a'));

    const keyboard = bench();
    act(() => keyboard.view.result.current.press('r.a'));
    act(() => keyboard.view.result.current.press('c.a'));

    expect(keyboard.wiring).toBe(pointer.wiring);
  });

  it('fires exactly one cue per completed connection', () => {
    const b = bench();
    const spy = vi.fn();
    void spy;
    act(() => b.view.result.current.press('c.a'));
    act(() => b.view.result.current.press('r.a'));
    act(() => b.view.result.current.press('r.b'));
    act(() => b.view.result.current.press('c.b'));
    expect(b.cues).toEqual(['plug', 'plug']);
  });
});
