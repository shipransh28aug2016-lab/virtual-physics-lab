import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ExperimentMeta } from '@/experiments/registry';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { SolenoidSvg, CoilLoop, Rheostat, BatteryCell, Switch } from '@/components/instruments/Instruments';
import { idealSolenoidField } from '@/physics-engine/magnetism';
import { CONSTANTS } from '@/physics-engine/constants';
import type { ObservationRow } from '@/types/lab';
import { formatSI } from '@/utils/format';
import { col, num, ro } from '../experiments/_shared';
import { DragX, Knob, type StageApi } from '@/components/controls/StageKit';
import { BenchBoard } from '@/components/instruments/BenchBoard';

/**
 * Solenoid, Helmholtz and anti-Helmholtz coils are one apparatus with three
 * winding geometries. A single factory keeps the field profiles and the bench
 * drawing consistent across all three.
 */
export interface CoilConfig {
  mode: 'solenoid' | 'helmholtz' | 'anti-helmholtz';
  /**
   * The catalogue entry this simulator is built from. Taking the listing fields
   * straight off the meta is what stops the definition drifting away from the
   * unit and chapter the catalogue advertises.
   */
  meta: ExperimentMeta;
}

const TURNS = 200;

/**
 * Axial magnetic field for each coil geometry, in tesla.
 * Solenoid: finite-solenoid result B = (mu0 n I / 2)(cos theta1 + cos theta2),
 * which reduces to mu0 n I at the centre and half of it at an open end.
 */
/** Axial field of a single circular coil of N turns, radius R, at distance x. */
const coilField = (current: number, turns: number, radius: number, x: number): number => {
  const denom = Math.pow(radius * radius + x * x, 1.5);
  return denom === 0 ? 0 : (CONSTANTS.MU_0 * turns * current * radius * radius) / (2 * denom);
};

export function fieldAt(
  mode: CoilConfig['mode'],
  current: number,
  radius: number,
  x: number,
  length: number,
  separation?: number
): number {
  if (mode === 'solenoid') {
    const n = TURNS / Math.max(length, 1e-6);
    const half = Math.max(length, 1e-6) / 2;
    const c1 = (half - x) / Math.hypot(radius, half - x);
    const c2 = (half + x) / Math.hypot(radius, half + x);
    return 0.5 * idealSolenoidField(current, n) * (c1 + c2);
  }
  // Separation defaults to the Helmholtz condition a = R when not supplied.
  const a = separation ?? radius;
  const half = a / 2;
  const sum = coilField(current, TURNS, radius, x - half) + coilField(current, TURNS, radius, x + half);
  return mode === 'helmholtz' ? sum : -sum + 2 * coilField(current, TURNS, radius, x - half);
}

export function makeCoilDefinition(c: CoilConfig): ExperimentDefinition {
  return {
    id: c.meta.id, slug: c.meta.slug, title: c.meta.title, shortTitle: c.meta.shortTitle,
    aim: c.meta.aim, unit: c.meta.unit, chapter: c.meta.chapter, kind: c.meta.kind,
    difficulty: c.meta.difficulty, practicalNo: c.meta.practicalNo,
    thumbLabel: c.meta.shortTitle, accent: '#45d68b',
    controls: [
      { kind: 'slider', key: 'current', label: 'Coil current', symbol: 'I', unit: 'A', min: 0.1, max: 10, step: 0.1, initial: 2, precision: 1 },
      { kind: 'slider', key: 'radius', label: 'Coil radius', symbol: 'R', unit: 'cm', min: 2, max: 30, step: 0.5, initial: c.mode === 'solenoid' ? 5 : 10, precision: 1 },
      { kind: 'slider', key: 'length', label: c.mode === 'solenoid' ? 'Solenoid length' : 'Coil separation', symbol: c.mode === 'solenoid' ? 'L' : 'a', unit: 'cm', min: 2, max: 60, step: 0.5, initial: c.mode === 'solenoid' ? 40 : 10, precision: 1 },
      { kind: 'slider', key: 'x', label: 'Axial position of probe', symbol: 'x', unit: 'cm', min: -30, max: 30, step: 0.2, initial: 0, precision: 1 },
      { kind: 'toggle', key: 'compass', label: 'Show field compass', initial: true }
    ],
    defaults: {
      current: 2,
      radius: c.mode === 'solenoid' ? 5 : 10,
      length: c.mode === 'solenoid' ? 40 : 10,
      x: 0,
      compass: true
    }
  };
}

export function makeCoilCompute(c: CoilConfig) {
  return function compute(params: ParamValues): ModelOutput {
    const current = num(params, 'current', 2);
    const radius = num(params, 'radius', 10) / 100;
    const length = num(params, 'length', 40) / 100;
    const x = num(params, 'x', 0) / 100;

    const sep = c.mode === 'solenoid' ? undefined : length;
    const centre = fieldAt(c.mode, current, radius, 0, length, sep);
    const at = fieldAt(c.mode, current, radius, x, length, sep);
    const gradient =
      (fieldAt(c.mode, current, radius, x + 1e-4, length, sep) -
        fieldAt(c.mode, current, radius, x - 1e-4, length, sep)) /
      2e-4;
    const ideal = idealSolenoidField(current, TURNS / Math.max(length, 1e-6));

    const points: { x: number; y: number }[] = [];
    for (let k = -100; k <= 100; k += 2) {
      const xx = (k / 100) * 0.3;
      points.push({ x: xx * 100, y: fieldAt(c.mode, current, radius, xx, length, sep) * 1e4 });
    }

    return {
      readouts: [
        ro('b', 'Field at the probe', at, 'T', 8, { sub: `${(at * 1e4).toFixed(3)} gauss` }),
        ro('bc', 'Field at the centre', centre, 'T', 8, { sub: `${(centre * 1e4).toFixed(3)} gauss` }),
        ro('dbdx', 'Field gradient dB/dx', gradient, 'T/m', 6),
        c.mode === 'solenoid'
          ? ro('ideal', 'Ideal long-solenoid field', ideal, 'T', 8, { sub: '\u03bc\u2080nI' })
          : ro('ratio', 'Uniformity B(x)/B(0)', centre === 0 ? 0 : at / centre, '\u2014', 4),
        c.mode === 'solenoid'
          ? ro('sep', 'Solenoid length', length, 'm', 3, { sub: `${(length * 100).toFixed(0)} cm` })
          : ro('sep', 'Coil separation a', length, 'm', 4, {
              sub: `a/R = ${(length / radius).toFixed(3)}${Math.abs(length - radius) < 1e-6 ? ' · Helmholtz condition' : ''}`
            }),
        ro('i', 'Coil current', current, 'A', 2),
        ro('n', 'Turns', TURNS, '\u2014', 0)
      ],
      graph: {
        title: 'Axial field profile along the coil axis',
        xLabel: 'x (cm)', yLabel: 'B (gauss)',
        series: [{ key: 'b', label: 'B', color: '#45d68b', points }]
      },
      live: { x: x * 100, y: at * 1e4 },
      description:
        c.mode === 'anti-helmholtz'
          ? `Two identical coils carrying current in opposite directions produce a field that passes through zero at the mid-point with a constant gradient of ${formatSI(gradient, 3)} tesla per metre — the field used to trap neutral atoms.`
          : `With ${TURNS} turns, ${current.toFixed(1)} ampere and a ${radius * 100} cm radius the field at x = ${(x * 100).toFixed(1)} cm is ${formatSI(at, 3)} tesla (${(at * 1e4).toFixed(2)} gauss), against ${formatSI(centre, 3)} tesla at the centre.`,
      result:
        c.mode === 'solenoid'
          ? `B(centre) = ${formatSI(centre, 4)} T, close to the ideal \u03bc\u2080nI = ${formatSI(ideal, 4)} T for n = ${(TURNS / length).toFixed(0)} turns/m. At x = ${(x * 100).toFixed(1)} cm the field is ${formatSI(at, 4)} T.`
          : `B(0) = ${formatSI(centre, 4)} T and B(x = ${(x * 100).toFixed(1)} cm) = ${formatSI(at, 4)} T. ${c.mode === 'helmholtz' ? 'The profile is flat within about 1% over the central region.' : `The field crosses zero at the mid-point with a gradient of ${formatSI(gradient, 3)} T/m.`}`
    };
  };
}

export function makeCoilStage(c: CoilConfig) {
  return function Stage({ params, set, control }: StageApi) {
    const current = num(params, 'current', 2);
    const radius = num(params, 'radius', 10) / 100;
    const length = num(params, 'length', 40) / 100;
    const x = num(params, 'x', 0) / 100;
    const showCompass = Boolean(params.compass ?? true);
    const sep = c.mode === 'solenoid' ? undefined : length;
    const centre = fieldAt(c.mode, current, radius, 0, length, sep);
    const at = fieldAt(c.mode, current, radius, x, length, sep);
    const scale = c.mode === 'solenoid' ? 6 : 9;
    const cx = 400;
    const probeX = cx + x * 100 * scale;
    const sign = at >= 0 ? 1 : -1;
    const arrowLen = Math.min(Math.abs(at / (centre || 1)) * 46, 60);

    return (
      <svg viewBox="0 0 800 460" className="svg-lab" preserveAspectRatio="xMidYMid meet">
        <SvgDefs />
        <BenchBoard x={20} y={50} width={760} height={260} rx={12} />
        {c.mode === 'solenoid' ? (
          <SolenoidSvg x={cx - (length * 100 * scale) / 2} y={180} length={length * 100 * scale} radius={radius * 100 * scale} turns={16} live />
        ) : (
          <>
            <g transform={`translate(${cx - (radius * 100 * scale) / 2} 180)`}>
              <CoilLoop radius={radius * 100 * scale} turns={12} current={current} direction={1} />
            </g>
            <g transform={`translate(${cx + (radius * 100 * scale) / 2} 180)`}>
              <CoilLoop radius={radius * 100 * scale} turns={12} current={current} direction={c.mode === 'helmholtz' ? 1 : -1} />
            </g>
          </>
        )}
        <line x1={60} y1={180} x2={740} y2={180} stroke="#22303f" strokeDasharray="4 5" />
        {showCompass ? (
          <g transform={`translate(${probeX} 180)`} style={{ transition: 'transform 160ms cubic-bezier(0.2,0.7,0.3,1)' }}>
            <line x1={0} y1={0} x2={sign * arrowLen} y2={0} stroke="#ffc65c" strokeWidth={3} markerEnd="url(#lab-arrow)" />
            <circle r={4} fill="#ffc65c" />
            <text y={-14} textAnchor="middle" fontSize={10} fill="#ffc65c" fontFamily="ui-monospace, monospace">
              {(at * 1e4).toFixed(2)} G
            </text>
          </g>
        ) : null}
        <text x={400} y={76} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
          {c.meta.title}
        </text>
        <text x={400} y={296} textAnchor="middle" fontSize={10.5} fill="#5e7189">
          {c.mode === 'solenoid'
            ? `L = ${(length * 100).toFixed(0)} cm · R = ${(radius * 100).toFixed(1)} cm · ${TURNS} turns`
            : `coil radius R = ${(radius * 100).toFixed(1)} cm · separation a = ${(length * 100).toFixed(1)} cm (a/R = ${(length / radius).toFixed(2)}) · ${TURNS} turns each`}
        </text>
        <g transform="translate(400 370)">
          <BatteryCell x={-230} y={0} emf={current * 2} live label="supply" />
          <Rheostat x={-90} y={0} fraction={current / 10} label="Rh" live />
          <Switch x={70} y={0} closed live label="K" />
          <text x={170} y={5} fontSize={11} fill="#45d68b" fontFamily="ui-monospace, monospace">
            I = {current.toFixed(1)} A
          </text>
        </g>
        <text x={400} y={358} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          {c.mode === 'anti-helmholtz'
            ? 'coils carry current in opposite senses · B = 0 at the mid-point'
            : c.mode === 'helmholtz'
            ? 'coils carry current in the same sense · separation a = R gives the flattest field'
            : 'field inside a long solenoid is nearly uniform'}
        </text>
        {/* The search coil is dragged along the axis; the supply has its own dial. */}
        <DragX
          spec={control('x', 'slider')}
          params={params}
          onChange={(key, value) => set(key, value)}
          x={400}
          y={404}
          length={20 * scale}
          mapping={{ toValue: (dx) => dx / scale, invert: (cm) => 400 + cm * scale }}
          label="Axial position of the search coil — drag it along the axis"
        />
        <Knob
          spec={control('current', 'slider')}
          params={params}
          onChange={(key, value) => set(key, value)}
          x={62}
          y={404}
          radius={18}
          label="Coil current I — turn the supply"
        />
            </svg>
    );
  };
}

export function makeCoilEducation(c: CoilConfig): EducationPack {
  const solenoid = c.mode === 'solenoid';
  const helmholtz = c.mode === 'helmholtz';
  return {
    theory: [
      solenoid
        ? 'A long solenoid carrying current produces a magnetic field that is nearly uniform inside it and very weak outside. The field lines run parallel to the axis, which is why the solenoid is the standard way to produce a known field.'
        : 'A single circular coil produces a field along its axis that falls off quickly with distance. Two identical coils placed coaxially can be arranged either to reinforce each other or to cancel each other.',
      helmholtz
        ? 'When the two coils carry current in the same sense and are separated by exactly their radius, the second derivative of the field along the axis vanishes at the mid-point. The field is then flat to within about one percent over a useful volume — this is the Helmholtz pair.'
        : solenoid
        ? 'The field at the centre is \u03bc\u2080nI, where n is the number of turns per unit length. Near the ends it falls to about half of this value.'
        : 'When the two coils carry current in opposite senses the fields subtract. The field is zero at the mid-point but changes steadily with position, giving a constant field gradient — this is the anti-Helmholtz pair used in magneto-optical traps.',
      'Moving the probe along the axis lets the shape of the field be traced directly and compared with the theoretical profile.'
    ],
    formulas: solenoid
      ? [
          { tex: 'B = \\mu_0 n I', caption: 'Field inside a long solenoid.' },
          { tex: 'n = \\frac{N}{L}', caption: 'Turns per unit length.' },
          { tex: 'B_{end} = \\frac{1}{2}\\mu_0 n I', caption: 'Field at the open end.' }
        ]
      : helmholtz
      ? [
          { tex: 'B = \\left(\\frac{4}{5}\\right)^{3/2} \\frac{\\mu_0 N I}{R}', caption: 'Helmholtz field at the mid-point.' },
          { tex: 'a = R', caption: 'Separation for maximum uniformity.' },
          { tex: 'B(x) = \\frac{\\mu_0 N I R^2}{2}\\left[\\frac{1}{(R^2+(x-a/2)^2)^{3/2}} + \\frac{1}{(R^2+(x+a/2)^2)^{3/2}}\\right]', caption: 'Axial field of the pair.' }
        ]
      : [
          { tex: 'B(x) = \\frac{\\mu_0 N I R^2}{2}\\left[\\frac{1}{(R^2+(x-a/2)^2)^{3/2}} - \\frac{1}{(R^2+(x+a/2)^2)^{3/2}}\\right]', caption: 'Axial field with opposing currents.' },
          { tex: 'B(0) = 0', caption: 'Field vanishes at the mid-point.' },
          { tex: '\\frac{dB}{dx}\\bigg|_{0} \\neq 0', caption: 'Constant gradient near the centre.' }
        ],
    variables: [
      { symbol: 'B', name: 'Magnetic field', unit: 'T' },
      { symbol: 'I', name: 'Coil current', unit: 'A' },
      { symbol: 'N', name: 'Number of turns', unit: '\u2014' },
      { symbol: 'R', name: 'Coil radius', unit: 'm' },
      solenoid ? { symbol: 'n', name: 'Turns per metre', unit: 'm\u207b\u00b9' } : { symbol: 'a', name: 'Coil separation', unit: 'm' }
    ],
    procedure: [
      'Set the coil current and the coil radius.',
      solenoid ? 'Change the solenoid length and note how the field approaches \u03bc\u2080nI as it gets longer.' : 'Set the separation and compare the flatness of the axial profile.',
      'Move the probe along the axis and record the field at regular intervals.',
      'Plot B against x and compare the shape with the theoretical profile.'
    ],
    precautions: [
      'The coil heats up at high current, which changes its resistance and the reading.',
      'The Earth\u2019s field adds a small background to every reading; the coil axis should be aligned east\u2013west to minimise it.',
      'The search coil used as a probe must be kept perpendicular to the axis.'
    ],
    tips: helmholtz
      ? ['Set the separation equal to the radius and compare the field at the centre with the field 10% away.']
      : solenoid
      ? ['Double the length and watch the central field move closer to \u03bc\u2080nI.']
      : ['The gradient, not the field, is what traps atoms in an anti-Helmholtz pair.'],
    viva: [
      { q: 'What is the field inside a long solenoid?', a: 'B = \u03bc\u2080nI, uniform and parallel to the axis.' },
      helmholtz
        ? { q: 'Why is the separation equal to the radius in a Helmholtz pair?', a: 'Because that is the separation at which the second derivative of the axial field vanishes, giving the flattest possible field.' }
        : { q: 'Why do anti-Helmholtz coils carry opposite currents?', a: 'So that their fields subtract and produce a zero field with a constant gradient at the mid-point.' },
      { q: 'What is the field at the open end of a solenoid?', a: 'About half the central field, \u00bd\u03bc\u2080nI.' },
      { q: 'Why is a Helmholtz pair used to cancel the Earth\u2019s field?', a: 'Because it can produce a uniform field of known magnitude in a chosen direction over a large volume.' }
    ],
    resultTemplate: 'The measured axial field agrees with the theoretical profile for the coil geometry used.'
  };
}

export const coilNotebook = (c: CoilConfig) => ({ params: p }: { params: ParamValues; rows: Record<string, number | string>[] }) => {
  const current = num(p, 'current', 2);
  const radius = num(p, 'radius', 10) / 100;
  const length = num(p, 'length', 40) / 100;
  const x = num(p, 'x', 0) / 100;
  const b = fieldAt(c.mode, current, radius, x, length);
  const sep = c.mode === 'solenoid' ? undefined : length;
    const centre = fieldAt(c.mode, current, radius, 0, length, sep);
  return {
    title: `Observation table — ${c.meta.shortTitle}`,
    columns: [
      col('x', 'x', 'cm', 1),
      col('b', 'B', 'gauss', 4, true),
      col('ratio', 'B/B(0)', '\u2014', 4, true)
    ],
    capture: () => ({ x: x * 100, b: b * 1e4, ratio: 0 }),
    derive: (row: ObservationRow) => ({ ...row, ratio: centre === 0 ? 0 : Number(row.b) / (centre * 1e4) }),
    extraFoot: [{ label: 'B(0)', value: `${(centre * 1e4).toFixed(4)} gauss at I = ${current.toFixed(1)} A` }]
  };
};
