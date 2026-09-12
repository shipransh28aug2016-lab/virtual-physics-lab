import { useMemo, type ReactNode } from 'react';
import { SvgDefs } from '@/components/shell/Viewport';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import { decodeWires, terminal, type CircuitSolution, type Part } from '@/physics-engine/circuit';
import type { ConnectApi } from '@/lab/interaction/useConnect';
import { BenchPart, polarityOf, terminalLabel, terminalPoint } from './parts';
import { Terminal } from './Terminal';
import { BenchWire } from './Wire';
import { wireCurrent } from './geometry';

export interface CircuitBenchProps {
  parts: Part[];
  /** Encoded netlist — the same string the model was solved from. */
  wiring: string;
  solution: CircuitSolution;
  connect: ConnectApi;
  title: string;
  subtitle?: string;
  /** On-apparatus handles: knobs, keys, the wiring hint. */
  children?: ReactNode;
  /** True while any part of the circuit is carrying current. */
  live: boolean;
}

const VIEW_W = 820;
const VIEW_H = 470;

/**
 * The digital circuit bench.
 *
 * Parts sit on a board; the student joins their terminals with leads. The
 * drawing is a projection of two things and nothing else: the netlist the
 * student built, and the solution the engine computed from it. No glyph decides
 * whether it is live — it is told, from the model.
 *
 * The apparatus carries its own honesty label: the moving cue on a live lead
 * shows the direction of conventional current, not electrons travelling at
 * drift speed.
 */
export function CircuitBench({
  parts,
  wiring,
  solution,
  connect,
  title,
  subtitle,
  children,
  live
}: CircuitBenchProps) {
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  const points = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const p of parts) {
      map.set(terminal(p.id, 'a'), terminalPoint(p, 'a'));
      map.set(terminal(p.id, 'b'), terminalPoint(p, 'b'));
    }
    return map;
  }, [parts]);

  const wires = useMemo(() => decodeWires(wiring), [wiring]);


  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={96} width={780} height={330} rx={14} />

      <text x={VIEW_W / 2} y={128} textAnchor="middle" className="bench-title">
        {title}
      </text>
      {subtitle ? (
        <text x={VIEW_W / 2} y={146} textAnchor="middle" className="bench-subtitle">
          {subtitle}
        </text>
      ) : null}

      {/* Leads first, so a socket is always on top of the cable in it. */}
      <g className="bench-wires">
        {wires.map((w) => {
          const a = points.get(w.from);
          const b = points.get(w.to);
          if (!a || !b) return null;
          const i = wireCurrent(w.from, w.to, byId, solution);
          return (
            <BenchWire key={w.id} from={a} to={b} live={live && Math.abs(i) > 1e-9} />
          );
        })}
      </g>

      <g className="bench-parts">
        {parts.map((p) => (
          <BenchPart
            key={p.id}
            part={p}
            current={solution.current.get(p.id) ?? 0}
            voltage={solution.voltage.get(p.id) ?? 0}
            live={live && Math.abs(solution.current.get(p.id) ?? 0) > 1e-9}
          />
        ))}
      </g>

      <g className="bench-terminals">
        {parts.flatMap((p) =>
          (['a', 'b'] as const).map((name) => {
            const id = terminal(p.id, name);
            const at = points.get(id);
            if (!at) return null;
            const label = terminalLabel(p, name);
            const measuring =
              p.kind === 'voltmeter' || p.kind === 'ammeter' || p.kind === 'galvanometer';
            return (
              <Terminal
                key={id}
                id={id}
                x={at.x}
                y={at.y}
                label={label}
                description={connect.describe(id, label)}
                state={connect.stateOf(id, {
                  current: solution.current.get(p.id) ?? 0,
                  measuring: measuring && live
                })}
                held={connect.held === id}
                polarity={polarityOf(p, name)}
                onPress={connect.press}
                onDetach={connect.detach}
              />
            );
          })
        )}
      </g>

      {children}
      {/*
        The flow disclosure is drawn by the canvas carrier scene, which is what
        actually animates now — printing it here as well put the same sentence
        on the stage twice.
      */}
    </svg>
  );
}
