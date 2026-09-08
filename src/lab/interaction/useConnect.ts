import { useCallback, useMemo, useState } from 'react';
import {
  addWire,
  clearTerminal,
  decodeWires,
  isConnected,
  removeWire,
  wiresAt,
  type TerminalId
} from '@/physics-engine/circuit';
import type { CueName } from '@/lab/audio';

/**
 * The apparatus state machine for one connection point.
 *
 *   DISCONNECTED → ALIGNED → CONNECTED → ACTIVE → MEASURING
 *
 * `aligned` is the state a terminal is in while a lead is being held against
 * it: either it is the end the student picked up, or it is a legal place to put
 * the other end. The visual state is read off this machine, never off a
 * coordinate — a terminal that merely *looks* touched is not connected.
 */
export type TerminalState = 'disconnected' | 'aligned' | 'connected' | 'active' | 'measuring';

export interface ConnectApi {
  /** The terminal the student is holding a lead against, if any. */
  held: TerminalId | null;
  /** State of one terminal, given what the model says is happening in it. */
  stateOf: (id: TerminalId, opts?: { current?: number; measuring?: boolean }) => TerminalState;
  /** Picks a terminal up, or completes a connection onto it. */
  press: (id: TerminalId) => void;
  /** Pulls every lead out of a terminal. */
  detach: (id: TerminalId) => void;
  /** Abandons a lead that is being held. */
  release: () => void;
  /** Whether pressing this terminal now would complete a connection. */
  wouldConnect: (id: TerminalId) => boolean;
  /** What a screen reader should say about this terminal. */
  describe: (id: TerminalId, label: string) => string;
  connections: number;
}

export interface ConnectOptions {
  /** The encoded netlist this bench is wired with. */
  wiring: string;
  /** Called with the new encoding whenever the wiring changes. */
  onChange: (wiring: string) => void;
  /** Fired for the audio bus; the caller decides whether it makes a sound. */
  onCue?: (cue: CueName) => void;
  /** Current flowing above this counts a connection as carrying current. */
  liveThreshold?: number;
}

/**
 * Connecting is two presses: pick a terminal up, then put the lead down on
 * another. That is the same gesture with a mouse, a finger and a keyboard —
 * which is why there is no separate accessible path to keep in step. Pressing
 * the held terminal again puts the lead back down.
 */
export function useConnect({
  wiring,
  onChange,
  onCue,
  liveThreshold = 1e-9
}: ConnectOptions): ConnectApi {
  const [held, setHeld] = useState<TerminalId | null>(null);

  const connections = useMemo(() => decodeWires(wiring).length, [wiring]);

  const release = useCallback(() => setHeld(null), []);

  const press = useCallback(
    (id: TerminalId) => {
      if (held === null) {
        setHeld(id);
        return;
      }
      if (held === id) {
        setHeld(null);
        return;
      }
      const already = wiresAt(wiring, held).some((w) => w.from === id || w.to === id);
      if (already) {
        onChange(removeWire(wiring, held, id));
        onCue?.('unplug');
      } else {
        onChange(addWire(wiring, held, id));
        onCue?.('plug');
      }
      setHeld(null);
    },
    [held, wiring, onChange, onCue]
  );

  const detach = useCallback(
    (id: TerminalId) => {
      if (!isConnected(wiring, id)) return;
      onChange(clearTerminal(wiring, id));
      onCue?.('unplug');
      setHeld(null);
    },
    [wiring, onChange, onCue]
  );

  const wouldConnect = useCallback((id: TerminalId) => held !== null && held !== id, [held]);

  const stateOf = useCallback<ConnectApi['stateOf']>(
    (id, opts) => {
      // While a lead is held every terminal is a legal place to put it, so they
      // all show as aligned; the view tells the held one apart with `held`.
      if (held !== null) return 'aligned';
      if (!isConnected(wiring, id)) return 'disconnected';
      if (opts?.measuring) return 'measuring';
      if (Math.abs(opts?.current ?? 0) > liveThreshold) return 'active';
      return 'connected';
    },
    [held, wiring, liveThreshold]
  );

  const describe = useCallback<ConnectApi['describe']>(
    (id, label) => {
      const attached = wiresAt(wiring, id).length;
      if (held === id) return `${label}, lead held here. Choose another terminal to connect, or press again to put it down.`;
      if (held !== null) return `${label}, ${attached ? 'connected' : 'free'}. Press to connect the held lead here.`;
      if (attached === 0) return `${label}, not connected. Press to pick up a lead.`;
      return `${label}, connected by ${attached} lead${attached === 1 ? '' : 's'}. Press to start another lead, or Delete to disconnect.`;
    },
    [held, wiring]
  );

  return { held, stateOf, press, detach, release, wouldConnect, describe, connections };
}
