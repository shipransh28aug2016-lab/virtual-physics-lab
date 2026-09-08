import type { Part } from '@/physics-engine/circuit';
import { BatteryCell, MeterFace, Resistor, Rheostat, Switch } from '@/components/instruments/Instruments';

/** How far each terminal sits from the part's centre, in stage units. */
export function halfWidth(part: Part): number {
  switch (part.kind) {
    case 'cell':
      return 42;
    case 'resistor':
    case 'bulb':
      return 46;
    case 'rheostat':
      return 56;
    case 'key':
      return 34;
    case 'ammeter':
    case 'voltmeter':
    case 'galvanometer':
      return 46;
    case 'diode':
      return 36;
    case 'lead':
      return 30;
  }
}

/** Where a terminal is on the stage, given the part's layout. */
export function terminalPoint(part: Part, name: 'a' | 'b'): { x: number; y: number } {
  const { x, y } = part.layout ?? { x: 0, y: 0 };
  const dx = halfWidth(part) * (name === 'a' ? -1 : 1);
  const rotate = ((part.layout?.rotate ?? 0) * Math.PI) / 180;
  return {
    x: x + dx * Math.cos(rotate),
    y: y + dx * Math.sin(rotate)
  };
}

/** Plain-language name for one terminal, for the screen reader and the tooltip. */
export function terminalLabel(part: Part, name: 'a' | 'b'): string {
  const base = part.label ?? part.kind;
  switch (part.kind) {
    case 'cell':
      return `${base}, ${name === 'a' ? 'positive' : 'negative'} terminal`;
    case 'diode':
      return `${base}, ${name === 'a' ? 'anode' : 'cathode'}`;
    case 'ammeter':
    case 'voltmeter':
    case 'galvanometer':
      return `${base}, ${name === 'a' ? 'positive' : 'negative'} terminal`;
    default:
      return `${base}, ${name === 'a' ? 'left' : 'right'} terminal`;
  }
}

export function polarityOf(part: Part, name: 'a' | 'b'): '+' | '-' | null {
  if (part.kind === 'cell' || part.kind === 'ammeter' || part.kind === 'voltmeter' || part.kind === 'galvanometer') {
    return name === 'a' ? '+' : '-';
  }
  return null;
}

export interface BenchPartProps {
  part: Part;
  /** Current through the part, from the solved model. */
  current: number;
  /** Potential difference across the part, from the solved model. */
  voltage: number;
  /** True when the part is carrying current worth drawing as live. */
  live: boolean;
}

/**
 * The apparatus glyph for one part, drawn at its layout position.
 *
 * Every glyph is driven by the solved model: a meter's needle angle, a bulb's
 * brightness and a diode's conducting state are all read off `current` and
 * `voltage`, never off the control that happens to be nearby.
 */
export function BenchPart({ part, current, voltage, live }: BenchPartProps) {
  const { x, y } = part.layout ?? { x: 0, y: 0 };
  const half = halfWidth(part);
  const stub = (
    <>
      <line x1={-half} y1={0} x2={-half + 12} y2={0} className={`lead${live ? ' lead-live' : ''}`} />
      <line x1={half - 12} y1={0} x2={half} y2={0} className={`lead${live ? ' lead-live' : ''}`} />
    </>
  );

  return (
    <g className="bench-part" transform={`translate(${x} ${y})`} data-part={part.id}>
      {stub}
      {renderGlyph(part, current, voltage, live)}
      <text y={half > 44 ? 46 : 40} textAnchor="middle" className="bench-part-label">
        {part.label ?? part.id}
      </text>
    </g>
  );
}

function renderGlyph(part: Part, current: number, voltage: number, live: boolean) {
  switch (part.kind) {
    case 'cell':
      return <BatteryCell emf={part.emf} live={live} />;

    case 'resistor':
      return <Resistor value={`${part.resistance.toFixed(1)} Ω`} live={live} />;

    case 'bulb': {
      // Brightness is the computed power as a fraction of the rated power —
      // a lamp that glows is a lamp the model says is dissipating.
      const rated = part.ratedPower && part.ratedPower > 0 ? part.ratedPower : 1;
      const glow = Math.max(0, Math.min(1, Math.abs(current * voltage) / rated));
      return (
        <g className="bench-bulb">
          {glow > 0.02 ? <circle r={30} fill="url(#lab-bulb)" opacity={0.25 + glow * 0.75} /> : null}
          <circle r={15} fill="#101a26" stroke="#5e7189" strokeWidth={1.3} />
          <path
            d="M -7 6 L -3 -4 L 0 4 L 3 -4 L 7 6"
            fill="none"
            stroke={glow > 0.02 ? '#ffd77a' : '#5e7189'}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <rect x={-6} y={13} width={12} height={7} rx={1.5} fill="#8fa1b4" />
        </g>
      );
    }

    case 'rheostat':
      return <Rheostat fraction={part.fraction} live={live} />;

    case 'key':
      return <Switch closed={part.closed} live={live} />;

    case 'ammeter':
      return (
        <MeterFace
          deflection={Math.min(Math.abs(current) / Math.max(part.range, 1e-9), 1.06)}
          symbol="A"
          scale={0.6}
          value={`${current.toFixed(3)} A`}
        />
      );

    case 'voltmeter':
      return (
        <MeterFace
          deflection={Math.min(Math.abs(voltage) / Math.max(part.range, 1e-9), 1.06)}
          symbol="V"
          scale={0.6}
          value={`${voltage.toFixed(2)} V`}
        />
      );

    case 'galvanometer': {
      const full = Math.max(part.figureOfMerit * part.divisions, 1e-12);
      return (
        <MeterFace
          deflection={Math.max(-1.06, Math.min(current / full, 1.06))}
          symbol="G"
          scale={0.6}
          zeroCentre
          value={`${(current / Math.max(part.figureOfMerit, 1e-15)).toFixed(0)} div`}
        />
      );
    }

    case 'diode': {
      const conducting = current > 1e-6;
      return (
        <g className="bench-diode">
          <path d="M -11 -11 L 11 0 L -11 11 Z" fill={conducting ? '#45d68b' : '#5e7189'} stroke="#cfdcea" strokeWidth={1.2} />
          <line x1={11} y1={-12} x2={11} y2={12} stroke="#cfdcea" strokeWidth={2.4} />
        </g>
      );
    }

    case 'lead':
      return <line x1={-12} y1={0} x2={12} y2={0} className={`lead${live ? ' lead-live' : ''}`} />;
  }
}
