import type { ReactNode } from 'react';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import { BatteryCell, Lead, MeterFace, Rheostat, Switch } from '@/components/instruments/Instruments';
import { SvgDefs } from '@/components/shell/Viewport';

/** A resistance box with its dial value on the lid. */
export function ResistanceBox({
  x,
  y,
  value,
  label,
  live
}: {
  x: number;
  y: number;
  value: number | string;
  label?: string;
  live?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className="component">
      <rect x={-42} y={-22} width={84} height={44} rx={5} fill="#1d2836" stroke="#3a5069" strokeWidth={1.3} />
      <rect x={-34} y={-14} width={68} height={20} rx={3} fill="#0b1119" stroke="#293a4e" strokeWidth={1} />
      <text y={1} textAnchor="middle" fontSize={11.5} fill={live ? '#25d0ee' : '#8497ad'} fontFamily="ui-monospace, monospace">
        {typeof value === 'number' ? `${value.toFixed(1)} Ω` : value}
      </text>
      {[-24, -8, 8, 24].map((cx) => (
        <circle key={cx} cx={cx} cy={14} r={3} fill="#c79a4d" />
      ))}
      <line x1={-52} y1={0} x2={-42} y2={0} className={`lead${live ? ' lead-live' : ''}`} />
      <line x1={42} y1={0} x2={52} y2={0} className={`lead${live ? ' lead-live' : ''}`} />
      {label ? (
        <text y={-28} textAnchor="middle" fontSize={11} fill="#b9c7d8">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** A voltmeter bridged across a component, drawn as a real parallel branch. */
export function VoltmeterBranch({
  x,
  y,
  voltage,
  span = 140
}: {
  x: number;
  y: number;
  voltage: number;
  span?: number;
}) {
  const half = span / 2;
  return (
    <g className="voltmeter-branch">
      <path d={`M ${x - half} ${y + 50} L ${x - half} ${y} L ${x - 34} ${y}`} className="lead" fill="none" />
      <path d={`M ${x + 34} ${y} L ${x + half} ${y} L ${x + half} ${y + 50}`} className="lead" fill="none" />
      <MeterFace x={x} y={y} deflection={Math.min(Math.abs(voltage) / 12, 1)} symbol="V" scale={0.6} value={`${voltage.toFixed(2)} V`} />
    </g>
  );
}

export interface SeriesLoopProps {
  emf: number;
  current: number;
  terminalV: number;
  rheostatFraction?: number;
  closed: boolean;
  /** Extra apparatus drawn inside the loop — the load, meters, stage handles. */
  extraLead?: ReactNode;
}

/**
 * The standard single-loop circuit board: cell, key, rheostat, ammeter and the
 * lead rectangle that carries them. Everything is positioned on a fixed
 * 820 × 470 stage so the placement audit can assert against it.
 */
export function SeriesLoop({
  emf,
  current,
  terminalV,
  rheostatFraction = 0.5,
  closed,
  extraLead
}: SeriesLoopProps) {
  const live = closed && Math.abs(current) > 1e-9;
  const loop = 'M 120 350 L 120 200 L 700 200 L 700 350 L 120 350';

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={100} width={780} height={330} rx={14} />
      <Lead d={loop} live={live} flow={live ? current : undefined} width={2.4} />

      <BatteryCell x={200} y={200} emf={emf} live={live} label="Cell ε" />
      <Switch x={330} y={200} closed={closed} live={live} label="Key K" />
      <Rheostat x={480} y={200} fraction={rheostatFraction} live={live} label="Rheostat" />
      <MeterFace
        x={620}
        y={200}
        deflection={Math.min(Math.abs(current) / 1.2, 1)}
        symbol="A"
        scale={0.62}
        value={`${current.toFixed(3)} A`}
        label="Ammeter"
      />

      <text x={410} y={132} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Series circuit · terminal voltage {terminalV.toFixed(2)} V
      </text>
      <text x={410} y={450} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        {closed ? 'Key closed — current flows through the loop' : 'Key open — the circuit is broken'}
      </text>

      {extraLead}
    </svg>
  );
}
