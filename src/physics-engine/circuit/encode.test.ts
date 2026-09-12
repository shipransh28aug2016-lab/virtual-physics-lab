import { describe, expect, it } from 'vitest';
import { addWire, clearTerminal, decodeWires, encodeWires, isConnected, removeWire, wiresAt } from './encode';

describe('wiring encoding', () => {
  it('round-trips a netlist', () => {
    const s = 'c.a-k.a;k.b-r.a';
    expect(encodeWires(decodeWires(s))).toBe(s);
  });

  it('is canonical: the order a student wires in does not matter', () => {
    const one = encodeWires([
      { id: '1', from: 'r.b', to: 'c.b' },
      { id: '2', from: 'c.a', to: 'r.a' }
    ]);
    const two = encodeWires([
      { id: '1', from: 'r.a', to: 'c.a' },
      { id: '2', from: 'c.b', to: 'r.b' }
    ]);
    expect(one).toBe(two);
  });

  it('drops duplicates and self-connections', () => {
    expect(
      encodeWires([
        { id: '1', from: 'c.a', to: 'r.a' },
        { id: '2', from: 'r.a', to: 'c.a' },
        { id: '3', from: 'c.a', to: 'c.a' }
      ])
    ).toBe('c.a-r.a');
  });

  it('adds, removes and clears', () => {
    let w = '';
    w = addWire(w, 'c.a', 'r.a');
    w = addWire(w, 'r.b', 'c.b');
    expect(decodeWires(w)).toHaveLength(2);
    expect(addWire(w, 'r.a', 'c.a')).toBe(w); // re-adding changes nothing
    expect(decodeWires(removeWire(w, 'c.a', 'r.a'))).toHaveLength(1);
    expect(clearTerminal(w, 'c.a')).toBe('c.b-r.b');
  });

  it('answers what is attached to a terminal', () => {
    const w = 'c.a-r.a;c.a-v.a;r.b-c.b';
    expect(wiresAt(w, 'c.a')).toHaveLength(2);
    expect(isConnected(w, 'c.a')).toBe(true);
    expect(isConnected(w, 'k.a')).toBe(false);
  });

  it('survives a malformed string rather than throwing', () => {
    expect(decodeWires('')).toEqual([]);
    expect(decodeWires(';;')).toEqual([]);
    expect(decodeWires('rubbish')).toEqual([]);
    expect(decodeWires('a.x-;-b.y')).toEqual([]);
  });
});
