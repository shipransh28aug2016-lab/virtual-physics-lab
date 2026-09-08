/**
 * Wiring as a string.
 *
 * The lab keeps every experiment parameter as a primitive so state stays
 * serialisable and `compute` stays pure. A student's wiring is a list of
 * connections, so it is encoded canonically into one string and carried like
 * any other parameter — which means the netlist a reading came from is exactly
 * as recordable, resettable and testable as a knob position.
 *
 *   "c.a-k.a;k.b-r.a;r.b-c.b"
 *
 * Canonical form: each pair is sorted, then the pairs are sorted and
 * de-duplicated, so two students who wired the same circuit in a different
 * order produce the same string.
 */
import type { TerminalId, Wire } from './graph';

const PAIR = ';';
const JOIN = '-';

/** One connection, as it appears in the encoded string. */
export const wireKey = (from: TerminalId, to: TerminalId): string =>
  [from, to].sort().join(JOIN);

export function encodeWires(wires: Wire[]): string {
  const keys = wires
    .filter((w) => w.from !== w.to)
    .map((w) => wireKey(w.from, w.to));
  return [...new Set(keys)].sort().join(PAIR);
}

export function decodeWires(encoded: string): Wire[] {
  if (!encoded) return [];
  const out: Wire[] = [];
  const seen = new Set<string>();
  for (const chunk of encoded.split(PAIR)) {
    const [from, to] = chunk.split(JOIN);
    if (!from || !to || from === to) continue;
    const key = wireKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: key, from, to });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Adds a connection, returning the new encoding. Re-adding one is a no-op. */
export const addWire = (encoded: string, from: TerminalId, to: TerminalId): string =>
  from === to ? encoded : encodeWires([...decodeWires(encoded), { id: wireKey(from, to), from, to }]);

/** Removes one connection by either endpoint pair. */
export const removeWire = (encoded: string, from: TerminalId, to: TerminalId): string =>
  encodeWires(decodeWires(encoded).filter((w) => w.id !== wireKey(from, to)));

/** Removes every connection touching a terminal — pulling the lead out. */
export const clearTerminal = (encoded: string, id: TerminalId): string =>
  encodeWires(decodeWires(encoded).filter((w) => w.from !== id && w.to !== id));

/** Connections touching a terminal. */
export const wiresAt = (encoded: string, id: TerminalId): Wire[] =>
  decodeWires(encoded).filter((w) => w.from === id || w.to === id);

export const isConnected = (encoded: string, id: TerminalId): boolean =>
  wiresAt(encoded, id).length > 0;
