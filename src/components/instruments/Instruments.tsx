import type { ReactNode } from 'react';
import { degToRad } from '@/physics-engine/units';

/* ── shared bits ────────────────────────────────────────────────────────── */

interface Placed {
  /** Optional so an instrument can also be positioned by a parent transform. */
  x?: number;
  y?: number;
}

const liveClass = (live?: boolean) => `lead${live ? ' lead-live' : ''}`;

/** A wire lead between two points, brighter when current flows. */
export function Lead({ d, live }: { d: string; live?: boolean }) {
  return <path d={d} className={liveClass(live)} fill="none" />;
}

/* ── meters ─────────────────────────────────────────────────────────────── */

export interface MeterFaceProps extends Placed {
  /** Needle position, −1 … 1 (or 0 … 1 for a normal meter). */
  deflection: number;
  symbol: string;
  value?: string;
  label?: string;
  scale?: number;
  zeroCentre?: boolean;
}

/**
 * A moving-coil meter with a real arc scale. The needle angle is driven only by
 * `deflection`, which comes straight out of the physics model.
 */
export function MeterFace({
  x = 0,
  y = 0,
  deflection,
  symbol,
  value,
  label,
  scale = 1,
  zeroCentre = false
}: MeterFaceProps) {
  const R = 42;
  const sweep = zeroCentre ? 100 : 110;
  const clamped = Math.max(zeroCentre ? -1 : 0, Math.min(1, deflection));
  const angle = zeroCentre ? clamped * (sweep / 2) : -sweep / 2 + clamped * sweep;
  const rad = degToRad(angle - 90);

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const f = i / 10;
    const a = zeroCentre ? -sweep / 2 + f * sweep : -sweep / 2 + f * sweep;
    const ar = degToRad(a - 90);
    return { x1: Math.cos(ar) * (R - 4), y1: Math.sin(ar) * (R - 4), x2: Math.cos(ar) * R, y2: Math.sin(ar) * R, major: i % 5 === 0 };
  });

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="meter">
      <circle r={R + 9} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={1.2} />
      <circle r={R + 3} fill="url(#lab-dial)" stroke="#9fb0c2" strokeWidth={1} />
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.major ? '#1c2836' : '#66788c'} strokeWidth={t.major ? 1.6 : 0.9} />
      ))}
      <line
        x1={0}
        y1={0}
        x2={Math.cos(rad) * (R - 8)}
        y2={Math.sin(rad) * (R - 8)}
        stroke="#c0392b"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle r={3.4} fill="#1c2836" className="stage-pin" />
      <text y={-14} textAnchor="middle" fontSize={15} fontWeight={700} fill="#1c2836">
        {symbol}
      </text>
      {value ? (
        <text y={R - 8} textAnchor="middle" fontSize={10} fill="#1c2836" fontFamily="ui-monospace, monospace">
          {value}
        </text>
      ) : null}
      {label ? (
        <text y={R + 24} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/* ── passive components ─────────────────────────────────────────────────── */

export interface ResistorProps extends Placed {
  value?: string | number;
  label?: string;
  live?: boolean;
}

/** The zig-zag resistor symbol with its value plate. */
export function Resistor({ x = 0, y = 0, value, label, live }: ResistorProps) {
  return (
    <g transform={`translate(${x} ${y})`} className="component">
      <path d="M -36 0 L -24 0 L -20 -8 L -12 8 L -4 -8 L 4 8 L 12 -8 L 20 8 L 24 0 L 36 0" className={liveClass(live)} fill="none" />
      {label ? (
        <text y={-16} textAnchor="middle" fontSize={11} fill="#b9c7d8">
          {label}
        </text>
      ) : null}
      {value !== undefined ? (
        <text y={24} textAnchor="middle" fontSize={10.5} fill="#eaf1f8" fontFamily="ui-monospace, monospace">
          {typeof value === 'number' ? `${value} Ω` : value}
        </text>
      ) : null}
    </g>
  );
}

/** A rheostat: a resistance box with a sliding contact showing its setting. */
export function Rheostat({
  x = 0,
  y = 0,
  fraction,
  label,
  live
}: Placed & { fraction: number; label?: string; live?: boolean }) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <g transform={`translate(${x} ${y})`} className="component">
      <rect x={-44} y={-11} width={88} height={22} rx={4} fill="#1d2836" stroke="#3a5069" strokeWidth={1.2} />
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1={-40 + i * 6} y1={-9} x2={-40 + i * 6} y2={9} stroke="#5e7189" strokeWidth={1.4} />
      ))}
      <line x1={-48} y1={0} x2={-44} y2={0} className={liveClass(live)} />
      <line x1={44} y1={0} x2={48} y2={0} className={liveClass(live)} />
      <g transform={`translate(${-40 + f * 80} 0)`}>
        <line x1={0} y1={-20} x2={0} y2={-11} stroke="#25d0ee" strokeWidth={2} />
        <path d="M -5 -20 L 5 -20 L 0 -12 Z" fill="#25d0ee" className="stage-pin" />
      </g>
      {label ? (
        <text y={26} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** A cell or battery; `gap` widens it into a multi-cell battery symbol. */
export function BatteryCell({
  x = 0,
  y = 0,
  emf,
  label,
  live,
  gap = 0
}: Placed & { emf?: number; label?: string; live?: boolean; gap?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="component">
      <line x1={-30 - gap} y1={0} x2={-8 - gap} y2={0} className={liveClass(live)} />
      <line x1={-8 - gap} y1={-14} x2={-8 - gap} y2={14} stroke="#cfdcea" strokeWidth={2.4} />
      <line x1={0} y1={-7} x2={0} y2={7} stroke="#cfdcea" strokeWidth={4} />
      <line x1={0} y1={0} x2={30} y2={0} className={liveClass(live)} />
      <text x={-14 - gap} y={-20} textAnchor="middle" fontSize={12} fill="#b9c7d8">+</text>
      <text x={6} y={-20} textAnchor="middle" fontSize={13} fill="#b9c7d8">−</text>
      {label ? (
        <text y={30} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
          {emf !== undefined ? ` = ${emf.toFixed(2)} V` : ''}
        </text>
      ) : null}
    </g>
  );
}

/** A plug key. `closed` is model state, never a local toggle. */
export function Switch({
  x = 0,
  y = 0,
  closed,
  label,
  live
}: Placed & { closed: boolean; label?: string; live?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className="component">
      <line x1={-26} y1={0} x2={-10} y2={0} className={liveClass(live && closed)} />
      <line x1={10} y1={0} x2={26} y2={0} className={liveClass(live && closed)} />
      <circle cx={-10} cy={0} r={3} fill="#cfdcea" />
      <circle cx={10} cy={0} r={3} fill="#cfdcea" />
      <line
        x1={-10}
        y1={0}
        x2={closed ? 10 : 6}
        y2={closed ? 0 : -14}
        stroke={closed ? '#45d68b' : '#8497ad'}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      {label ? (
        <text y={24} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/* ── optics primitives ──────────────────────────────────────────────────── */

export interface RayProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  width?: number;
  markerId?: string;
  dashed?: boolean;
}

/** A light ray with an arrowhead — the workhorse of every optics bench. */
export function Ray({ from, to, color = '#ffd257', width = 1.8, markerId = 'ray-head', dashed }: RayProps) {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? '5 4' : undefined}
      markerEnd={`url(#${markerId})`}
      className="ray"
    />
  );
}

/** A labelled angle arc, used to mark i, r and δ on the bench. */
export function AngleArc({
  centre,
  fromAngleDeg,
  toAngleDeg,
  radius = 40,
  label,
  color = '#8497ad'
}: {
  centre: { x: number; y: number };
  fromAngleDeg: number;
  toAngleDeg: number;
  radius?: number;
  label?: string;
  color?: string;
}) {
  const a = degToRad(fromAngleDeg);
  const b = degToRad(toAngleDeg);
  const p1 = { x: centre.x + Math.cos(a) * radius, y: centre.y + Math.sin(a) * radius };
  const p2 = { x: centre.x + Math.cos(b) * radius, y: centre.y + Math.sin(b) * radius };
  const large = Math.abs(toAngleDeg - fromAngleDeg) > 180 ? 1 : 0;
  const sweepFlag = toAngleDeg > fromAngleDeg ? 1 : 0;
  const mid = degToRad((fromAngleDeg + toAngleDeg) / 2);

  return (
    <g className="angle-arc">
      <path
        d={`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 ${large} ${sweepFlag} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      {label ? (
        <text
          x={centre.x + Math.cos(mid) * (radius + 14)}
          y={centre.y + Math.sin(mid) * (radius + 14) + 4}
          textAnchor="middle"
          fontSize={10.5}
          fill={color}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** A biconvex or biconcave lens outline. */
export function LensSvg({
  x = 0,
  y = 0,
  height = 150,
  thickness = 16,
  convex = true,
  label
}: Placed & { height?: number; thickness?: number; convex?: boolean; label?: string }) {
  const h = height / 2;
  const t = thickness / 2;
  const d = convex
    ? `M ${x} ${y - h} Q ${x + t * 2} ${y} ${x} ${y + h} Q ${x - t * 2} ${y} ${x} ${y - h} Z`
    : `M ${x - t} ${y - h} Q ${x + t} ${y} ${x - t} ${y + h} L ${x + t} ${y + h} Q ${x - t} ${y} ${x + t} ${y - h} Z`;
  return (
    <g className="optic">
      <path d={d} fill="url(#lab-glass)" stroke="#8fc7e8" strokeWidth={1.4} />
      {label ? (
        <text x={x} y={y + h + 18} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** A spherical mirror arc with its silvered back. */
export function MirrorSvg({
  x = 0,
  y = 0,
  radius,
  concave = true,
  height = 190,
  label
}: Placed & { radius: number; concave?: boolean; height?: number; label?: string }) {
  const h = height / 2;
  const r = Math.max(Math.abs(radius), h + 4);
  const bulge = r - Math.sqrt(Math.max(r * r - h * h, 0));
  const dir = concave ? -1 : 1;
  const d = `M ${x} ${y - h} Q ${x + dir * bulge * 1.6} ${y} ${x} ${y + h}`;
  return (
    <g className="optic">
      <path d={d} fill="none" stroke="#cfdcea" strokeWidth={3} />
      <path d={d} fill="none" stroke="#5e7189" strokeWidth={9} transform={`translate(${dir * -5} 0)`} opacity={0.55} />
      {label ? (
        <text x={x} y={y + h + 18} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/* ── magnetism ──────────────────────────────────────────────────────────── */

/** A bar magnet with N and S poles, rotatable about its centre. */
export function BarMagnet({
  x = 0,
  y = 0,
  width = 120,
  height = 34,
  rotate = 0
}: Placed & { width?: number; height?: number; rotate?: number }) {
  const w = width / 2;
  const h = height / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`} className="magnet">
      <rect x={-w} y={-h} width={w} height={height} rx={3} fill="#ff6b7d" stroke="#8f2f3c" strokeWidth={1.2} />
      <rect x={0} y={-h} width={w} height={height} rx={3} fill="#5aa9ff" stroke="#2c5c92" strokeWidth={1.2} />
      <text x={-w / 2} y={5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#2a0d12">N</text>
      <text x={w / 2} y={5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#0b2138">S</text>
    </g>
  );
}

/** A circular coil seen edge-on, with the current direction marked. */
export function CoilLoop({
  radius,
  turns = 1,
  current = 0,
  direction = 1
}: {
  radius: number;
  turns?: number;
  current?: number;
  direction?: 1 | -1;
}) {
  const live = Math.abs(current) > 1e-9;
  return (
    <g className="coil">
      <ellipse rx={radius * 0.3} ry={radius} fill="none" stroke={live ? '#25d0ee' : '#94a8bd'} strokeWidth={2.4} />
      <text y={-radius - 10} textAnchor="middle" fontSize={10} fill="#8497ad">
        N = {turns}
      </text>
      <text y={radius + 18} textAnchor="middle" fontSize={10} fill={live ? '#25d0ee' : '#5e7189'}>
        {direction > 0 ? '⊙ out of page' : '⊗ into page'}
      </text>
    </g>
  );
}

/** A solenoid drawn as a spiral of `turns` loops. */
export function SolenoidSvg({
  x = 0,
  y = 0,
  length,
  radius,
  turns,
  live
}: Placed & { length: number; radius: number; turns: number; live?: boolean }) {
  const n = Math.max(3, Math.min(Math.round(turns), 40));
  const step = length / n;
  return (
    <g transform={`translate(${x} ${y})`} className="solenoid">
      {Array.from({ length: n }, (_, i) => (
        <ellipse
          key={i}
          cx={i * step + step / 2}
          cy={0}
          rx={step * 0.34}
          ry={radius}
          fill="none"
          stroke={live ? '#25d0ee' : '#94a8bd'}
          strokeWidth={2}
        />
      ))}
      <line x1={-18} y1={0} x2={0} y2={0} className={liveClass(live)} />
      <line x1={length} y1={0} x2={length + 18} y2={0} className={liveClass(live)} />
    </g>
  );
}

/* ── electrostatics ─────────────────────────────────────────────────────── */

/** A point charge; the sign and size are read from the model, never assumed. */
export function ChargeGlyph({
  x = 0,
  y = 0,
  q,
  radius = 14,
  label
}: Placed & { q: number; radius?: number; label?: string }) {
  const positive = q >= 0;
  return (
    <g transform={`translate(${x} ${y})`} className="charge">
      <circle r={radius} fill={positive ? '#ff6b7d' : '#5aa9ff'} stroke={positive ? '#8f2f3c' : '#2c5c92'} strokeWidth={1.4} />
      <text y={5} textAnchor="middle" fontSize={radius * 1.2} fontWeight={700} fill="#0b1119">
        {positive ? '+' : '−'}
      </text>
      {label ? (
        <text y={radius + 16} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/* ── metre bridge ───────────────────────────────────────────────────────── */

/** The 1 m constantan wire with its metre scale and the jockey at `jockeyCm`. */
export function MetreBridgeWire({
  x = 0,
  y = 0,
  length,
  jockeyCm,
  live,
  showScale = true
}: Placed & { length: number; jockeyCm: number; live?: boolean; showScale?: boolean }) {
  const f = Math.max(0, Math.min(100, jockeyCm)) / 100;
  return (
    <g className="metre-bridge">
      <line x1={x} y1={y} x2={x + length} y2={y} stroke="#c79a4d" strokeWidth={3.2} />
      {showScale
        ? Array.from({ length: 21 }, (_, i) => {
            const px = x + (i / 20) * length;
            const major = i % 5 === 0;
            return (
              <g key={i}>
                <line x1={px} y1={y + 4} x2={px} y2={y + (major ? 14 : 9)} stroke="#5e7189" strokeWidth={major ? 1.4 : 0.8} />
                {major ? (
                  <text x={px} y={y + 42} textAnchor="middle" fontSize={9} fill="#8497ad">
                    {i * 5}
                  </text>
                ) : null}
              </g>
            );
          })
        : null}
      <g transform={`translate(${x + f * length} ${y})`}>
        <line x1={0} y1={-26} x2={0} y2={0} stroke={live ? '#25d0ee' : '#8497ad'} strokeWidth={2} />
        <path d="M -6 -26 L 6 -26 L 0 -14 Z" fill={live ? '#25d0ee' : '#8497ad'} />
      </g>
    </g>
  );
}

/* ── semiconductor ──────────────────────────────────────────────────────── */

/** A junction diode symbol; it glows only when it is actually conducting. */
export function DiodeSvg({
  forward,
  current = 0,
  live
}: {
  forward: boolean;
  current?: number;
  live?: boolean;
}) {
  const conducting = live !== undefined ? live : Math.abs(current) > 1e-9;
  return (
    <g className="diode" transform={forward ? undefined : 'scale(-1 1)'}>
      <path d="M -12 -12 L 12 0 L -12 12 Z" fill={conducting ? '#45d68b' : '#5e7189'} stroke="#cfdcea" strokeWidth={1.2} />
      <line x1={12} y1={-13} x2={12} y2={13} stroke="#cfdcea" strokeWidth={2.4} />
      <line x1={-30} y1={0} x2={-12} y2={0} className={liveClass(conducting)} />
      <line x1={12} y1={0} x2={30} y2={0} className={liveClass(conducting)} />
    </g>
  );
}

/** Wraps stage content that must sit above the bench board. */
export function Instrument({ children }: { children: ReactNode }) {
  return <g className="instrument">{children}</g>;
}
