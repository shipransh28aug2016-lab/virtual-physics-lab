import { useMemo } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues, ValidationIssue } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill } from '@/components/shell/Viewport';
import { CircuitBench } from '@/components/bench';
import {
  decodeWires,
  detectFaults,
  hasClosedPath,
  solveCircuit,
  type CircuitGraph,
  type Fault,
  type Part
} from '@/physics-engine/circuit';
import { galvanometerResistanceHalfDeflection } from '@/physics-engine/circuits';
import { useConnect } from '@/lab/interaction/useConnect';
import { useSound } from '@/lab/audio';
import { num, ro, str, bool } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './galvanometer-half-deflection.meta';

export { meta };

/* ── the instruments in the cupboard ────────────────────────────────────── */

/**
 * Three galvanometers, told apart only by the label on the case. Their coil
 * resistance is what the experiment exists to measure, so it is deliberately
 * not a control the student can dial: they can pick a different instrument,
 * they cannot set the answer.
 */
const CUPBOARD = {
  a: { label: 'Galvanometer A', resistance: 62, fullScale: 300e-6 },
  b: { label: 'Galvanometer B', resistance: 118, fullScale: 150e-6 },
  c: { label: 'Galvanometer C', resistance: 45, fullScale: 500e-6 }
} as const;

type Instrument = keyof typeof CUPBOARD;
const instrumentOf = (params: ParamValues): Instrument => {
  const k = str(params, 'galvanometer', 'a');
  return k in CUPBOARD ? (k as Instrument) : 'a';
};

function benchParts(params: ParamValues): Part[] {
  const g = CUPBOARD[instrumentOf(params)];
  const divisions = num(params, 'divisions', 30);
  return [
    {
      id: 'rbox',
      kind: 'resistor',
      resistance: num(params, 'seriesR', 10000),
      label: 'High resistance R',
      layout: { x: 250, y: 180 }
    },
    {
      id: 'g',
      kind: 'galvanometer',
      resistance: g.resistance,
      // Current per division follows from the instrument and the scale it is
      // read on, so the figure of merit is derived, never typed in.
      figureOfMerit: g.fullScale / Math.max(divisions, 1),
      divisions,
      label: g.label,
      layout: { x: 470, y: 180 }
    },
    {
      id: 'sbox',
      kind: 'resistor',
      resistance: num(params, 'shunt', 55),
      label: 'Shunt S',
      layout: { x: 400, y: 300 }
    },
    {
      id: 'k2',
      kind: 'key',
      closed: bool(params, 'shuntClosed', false),
      label: 'Shunt key K₂',
      layout: { x: 560, y: 300 }
    },
    { id: 'k1', kind: 'key', closed: bool(params, 'k1Closed', true), label: 'Key K₁', layout: { x: 250, y: 392 } },
    {
      id: 'c',
      kind: 'cell',
      emf: num(params, 'emf', 3),
      internalResistance: 0.5,
      label: 'Battery E',
      layout: { x: 470, y: 392 }
    }
  ];
}

const encode = (pairs: string[]): string =>
  pairs.map((p) => p.split('-').sort().join('-')).sort().join(';');

/** The circuit the practical asks for: R in series, S bridged across G. */
const CORRECT_WIRING = encode([
  'c.a-k1.b',
  'k1.a-rbox.a',
  'rbox.b-g.a',
  'g.b-c.b',
  'g.a-sbox.a',
  'sbox.b-k2.a',
  'k2.b-g.b'
]);

/**
 * The classic mistake: the shunt put in the loop rather than across the coil.
 * It is offered as a named layout so a student can be shown it deliberately —
 * the deflection barely changes, and the reason is the whole point of the
 * experiment.
 */
const SHUNT_IN_SERIES = encode([
  'c.a-k1.b',
  'k1.a-rbox.a',
  'rbox.b-sbox.a',
  'sbox.b-k2.a',
  'k2.b-g.a',
  'g.b-c.b'
]);

const graphOf = (params: ParamValues): CircuitGraph => ({
  parts: benchParts(params),
  wires: decodeWires(str(params, 'wiring', CORRECT_WIRING))
});

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff', practicalNo: meta.practicalNo,
  controls: [
    {
      kind: 'segmented', key: 'galvanometer', label: 'Instrument from the cupboard', initial: 'a',
      options: [
        { value: 'a', label: 'Galvanometer A' },
        { value: 'b', label: 'Galvanometer B' },
        { value: 'c', label: 'Galvanometer C' }
      ],
      hint: 'The coil resistance is what you are measuring — it is not marked on the case'
    },
    { kind: 'slider', key: 'emf', label: 'Battery emf', symbol: '\\varepsilon', unit: 'V', min: 1, max: 6, step: 0.1, initial: 3, precision: 1, onStage: true },
    { kind: 'slider', key: 'seriesR', label: 'High resistance in series', symbol: 'R', unit: 'Ω', min: 1000, max: 20000, step: 100, initial: 10000, onStage: true },
    { kind: 'slider', key: 'shunt', label: 'Shunt across the galvanometer', symbol: 'S', unit: 'Ω', min: 5, max: 500, step: 1, initial: 55, onStage: true },
    { kind: 'slider', key: 'divisions', label: 'Full-scale deflection', symbol: 'n', unit: 'div', min: 10, max: 60, step: 1, initial: 30, onStage: true },
    { kind: 'toggle', key: 'k1Closed', label: 'Key K₁ closed', initial: true, onStage: true },
    { kind: 'toggle', key: 'shuntClosed', label: 'Shunt key K₂ closed', initial: false, onStage: true, hint: 'Close after full-scale deflection is set, then adjust S for half deflection' },
    {
      kind: 'select', key: 'wiring', label: 'Circuit wiring', initial: CORRECT_WIRING, onStage: true,
      options: [
        { value: CORRECT_WIRING, label: 'Shunt across the galvanometer' },
        { value: SHUNT_IN_SERIES, label: 'Shunt in the loop (the classic mistake)' },
        { value: '', label: 'Bare bench — wire it yourself' }
      ]
    }
  ],
  defaults: { galvanometer: 'a', emf: 3, seriesR: 10000, shunt: 55, divisions: 30, k1Closed: true, shuntClosed: false, wiring: CORRECT_WIRING }
};

const education: EducationPack = {
  theory: [
    'A moving coil galvanometer has a coil resistance G and gives full-scale deflection for a small current. To measure G without a second meter, a high resistance R is placed in series so that a known small current produces full-scale deflection.',
    'A variable shunt S is then connected across the galvanometer and adjusted until the deflection falls to exactly half. At that setting the shunt carries the same current as the galvanometer, so the two resistances are related by G = RS/(R − S).',
    'The word across is doing the work. A shunt placed in the loop instead of across the coil simply adds a few tens of ohms to ten thousand, and the deflection hardly changes at all. Wiring it both ways on this bench is the quickest way to see why the method depends on the parallel path.',
    'The figure of merit is the current needed for one division of deflection. A galvanometer with a small figure of merit is more sensitive because less current is required to move the pointer.'
  ],
  formulas: [
    { tex: 'G = \\frac{RS}{R - S}', caption: 'Half-deflection relation.' },
    { tex: 'S = \\frac{RG}{R + G}', caption: 'The shunt that halves the deflection — the parallel combination of R and G.' },
    { tex: 'I_g = \\frac{\\varepsilon}{R + G}', caption: 'Current for full-scale deflection.' },
    { tex: 'k = \\frac{I_g}{n}', caption: 'Figure of merit, current per division.' },
    { tex: 'S \\approx G \\text{ when } R \\gg G', caption: 'Why the shunt reads close to the coil resistance itself.' }
  ],
  variables: [
    { symbol: 'G', name: 'Galvanometer resistance', unit: 'Ω' },
    { symbol: 'R', name: 'Series resistance', unit: 'Ω' },
    { symbol: 'S', name: 'Shunt resistance', unit: 'Ω' },
    { symbol: 'n', name: 'Number of divisions', unit: 'div' },
    { symbol: 'k', name: 'Figure of merit', unit: 'A/div' }
  ],
  procedure: [
    'Wire the battery, the key K₁, the high resistance R and the galvanometer in one series loop.',
    'Bridge the shunt box and its key K₂ across the galvanometer terminals — across the coil, not in the loop.',
    'With K₂ open, adjust R until the galvanometer shows full-scale deflection n, and record R.',
    'Without changing R, close K₂ and adjust the shunt until the deflection is exactly half.',
    'Record S and compute G = RS/(R − S).',
    'Repeat with different values of R and take the mean; then compute the figure of merit k = I_g/n.'
  ],
  precautions: [
    'R must be much larger than G, otherwise the approximation G = RS/(R − S) breaks down.',
    'The battery emf must remain constant throughout.',
    'Do not exceed the full-scale current of the galvanometer — the bench reports it when the pointer reaches the stop.',
    'Make connections tight and check polarity before switching on.',
    'Open K₂ before changing R, or the deflection you set is not the full-scale one.'
  ],
  sourcesOfError: [
    'Adding the shunt lowers the total resistance and raises the total current, so the assumption of a constant current is only approximate. The bench solves the real circuit, so this shows up as a small systematic difference between the measured and the marked value.',
    'Contact resistance at the plug keys and the resistance box.',
    'Reading the pointer against a scale of finite least count.'
  ],
  tips: [
    'If the deflection is barely reduced by the shunt, S is too large; reduce it until the pointer sits at exactly n/2.',
    'Wire the shunt in the loop instead and watch the deflection hardly move — that is the experiment telling you why it must be in parallel.'
  ],
  viva: [
    { q: 'Why is a high resistance used in series?', a: 'To limit the current so that full-scale deflection is obtained without damaging the coil, and so that R ≫ G makes the half-deflection relation accurate.' },
    { q: 'What is the figure of merit?', a: 'The current required to produce one division of deflection, k = I_g/n.' },
    { q: 'Why is the deflection halved rather than reduced to some other fraction?', a: 'Because at exactly half deflection the shunt current equals the galvanometer current, which gives the simple relation G = RS/(R − S).' },
    { q: 'Why is the measured G slightly less than the true value?', a: 'Because adding the shunt lowers the total resistance of the circuit and increases the total current, so the assumption of constant current through R is only approximate.' },
    { q: 'What would happen if the shunt were connected in series with the galvanometer?', a: 'Almost nothing. A shunt of a few tens of ohms added to a series resistance of several kilohms barely changes the current, so the deflection would hardly fall and no half-deflection point could be found.' }
  ],
  resultTemplate: 'The resistance of the given galvanometer is G = RS/(R − S) ohm and its figure of merit is k = I_g/n ampere per division.'
};

/* ── model ──────────────────────────────────────────────────────────────── */

const safe = (v: number, digits: number): string => (Number.isFinite(v) ? v.toFixed(digits) : '—');

export interface GalvanometerReading {
  /** Current through the coil, amperes. */
  coilCurrent: number;
  /** Where the pointer is sitting, in divisions. */
  deflection: number;
  /** The instrument's own coil resistance — the quantity being measured. */
  trueG: number;
  fullScale: number;
  faults: Fault[];
  closedPath: boolean;
  /** Shunt that would give exactly half deflection, RG/(R + G). */
  idealShunt: number;
  /** G computed from the reading the way the student computes it. */
  measuredG: number;
}

export function readBench(params: ParamValues): GalvanometerReading {
  const graph = graphOf(params);
  const solution = solveCircuit(graph);
  const faults = detectFaults(graph, solution);
  const instrument = CUPBOARD[instrumentOf(params)];
  const divisions = num(params, 'divisions', 30);
  const perDivision = instrument.fullScale / Math.max(divisions, 1);
  const seriesR = num(params, 'seriesR', 10000);
  const coilCurrent = solution.current.get('g') ?? 0;

  return {
    coilCurrent,
    deflection: coilCurrent / perDivision,
    trueG: instrument.resistance,
    fullScale: instrument.fullScale,
    faults,
    closedPath: hasClosedPath(graph, solution.nodes, 'c'),
    idealShunt: (seriesR * instrument.resistance) / (seriesR + instrument.resistance),
    measuredG: galvanometerResistanceHalfDeflection(seriesR, num(params, 'shunt', 55))
  };
}

function compute(params: ParamValues): ModelOutput {
  const r = readBench(params);
  const divisions = num(params, 'divisions', 30);
  const shunt = num(params, 'shunt', 55);
  const shuntClosed = bool(params, 'shuntClosed', false);
  const half = divisions / 2;
  const atHalf = shuntClosed && Math.abs(r.deflection - half) < 0.5;

  const issues: ValidationIssue[] = r.faults.map((f) => ({
    field: 'wiring',
    severity: f.severity,
    message: f.message
  }));
  if (shuntClosed && !atHalf && r.closedPath) {
    issues.push({
      field: 'shunt',
      severity: 'warning',
      message: `The pointer is at ${safe(r.deflection, 1)} divisions, not ${half.toFixed(0)}. Adjust the shunt until the deflection is exactly half.`
    });
  }

  // The deflection the model would give at each shunt setting — every point is
  // a solved circuit, not a formula drawn through the operating point.
  const points: { x: number; y: number }[] = [];
  const step = Math.max(2, Math.round(495 / 120));
  for (let s = 5; s <= 500; s += step) {
    const at = readBench({ ...params, shunt: s, shuntClosed: true });
    points.push({ x: s, y: at.deflection });
  }

  const fom = r.fullScale / Math.max(divisions, 1);

  return {
    readouts: [
      ro('defl', 'Pointer reads', r.deflection, 'div', 1, {
        sub: shuntClosed ? `aim for ${half.toFixed(0)} div` : `full scale is ${divisions.toFixed(0)} div`,
        tone: shuntClosed ? (atHalf ? 'normal' : 'alert') : 'normal'
      }),
      ro('ig', 'Coil current', r.coilCurrent, 'A', 8, { sub: `${(r.coilCurrent * 1e6).toFixed(2)} µA` }),
      ro('s', 'Shunt setting S', shunt, 'Ω', 0),
      ro('g', 'G = RS/(R − S)', r.measuredG, 'Ω', 2, {
        sub: atHalf ? 'valid — the pointer is at half deflection' : 'only valid at exactly half deflection',
        tone: atHalf ? 'normal' : 'dim'
      }),
      ro('fom', 'Figure of merit', fom, 'A/div', 8, { sub: `${(fom * 1e6).toFixed(2)} µA/div` }),
      ro('fs', 'Full-scale current', r.fullScale, 'A', 8, { sub: `${(r.fullScale * 1e6).toFixed(0)} µA` }),
      ro('n', 'Divisions on the scale', divisions, 'div', 0)
    ],
    graph: {
      title: 'Deflection against shunt resistance',
      xLabel: 'Shunt S (Ω)',
      yLabel: 'deflection (div)',
      series: [{ key: 'd', label: 'deflection', color: '#9d8cff', points }],
      markers: [{ x: r.idealShunt, y: half, label: 'n/2', color: '#ffc65c' }],
      guides: [{ axis: 'y', value: half, label: 'n/2', color: '#ffc65c' }]
    },
    live: { x: shunt, y: r.deflection },
    issues,
    description: shuntClosed
      ? `With the shunt at ${shunt.toFixed(0)} ohm the pointer reads ${safe(r.deflection, 1)} of ${divisions.toFixed(0)} divisions. Half deflection needs a shunt of ${safe(r.idealShunt, 1)} ohm.`
      : `With the shunt key open the pointer reads ${safe(r.deflection, 1)} of ${divisions.toFixed(0)} divisions, at a coil current of ${(r.coilCurrent * 1e6).toFixed(2)} microampere. Set full-scale deflection with R, then close K₂.`,
    result: r.faults.some((f) => f.severity === 'error')
      ? `No valid reading can be taken while the circuit is mis-wired: ${r.faults[0].message}`
      : atHalf
        ? `At half deflection the shunt reads ${shunt.toFixed(0)} Ω with R = ${num(params, 'seriesR', 10000).toFixed(0)} Ω, so G = RS/(R − S) = ${safe(r.measuredG, 2)} Ω, and the figure of merit is ${((r.fullScale / Math.max(divisions, 1)) * 1e6).toFixed(2)} µA per division.`
        : `The pointer is at ${safe(r.deflection, 1)} divisions. The half-deflection relation only applies at exactly ${half.toFixed(0)} divisions — adjust the shunt until it does before computing G.`
  };
}

/* ── the apparatus ──────────────────────────────────────────────────────── */

function Stage({ params, set, control }: StageApi) {
  const wiring = str(params, 'wiring', CORRECT_WIRING);
  const { play } = useSound();
  const connect = useConnect({ wiring, onChange: (next) => set('wiring', next), onCue: play });

  const graph = useMemo(() => graphOf(params), [params]);
  const solution = useMemo(() => solveCircuit(graph), [graph]);
  const faults = useMemo(() => detectFaults(graph, solution), [graph, solution]);

  const live = Math.abs(solution.current.get('c') ?? 0) > 1e-12;
  const worst = faults[0];
  const r = readBench(params);
  const divisions = num(params, 'divisions', 30);

  const throwKey = (key: string, value: boolean) => {
    set(key, value);
    play(value ? 'switchOn' : 'switchOff');
  };

  return (
    <CircuitBench
      parts={graph.parts}
      wiring={wiring}
      solution={solution}
      connect={connect}
      live={live}
      title={`Half-deflection method · ${CUPBOARD[instrumentOf(params)].label}`}
      subtitle={
        worst
          ? worst.message.slice(0, 96)
          : `pointer ${safe(r.deflection, 1)} of ${divisions.toFixed(0)} div · coil current ${(r.coilCurrent * 1e6).toFixed(2)} µA`
      }
    >
      <Knob spec={control('emf', 'slider')} params={params} onChange={set} x={110} y={62} radius={19} label="Battery emf — turn the dial" />
      <Knob spec={control('seriesR', 'slider')} params={params} onChange={set} x={235} y={62} radius={19} label="High resistance R — turn the box" />
      <Knob spec={control('shunt', 'slider')} params={params} onChange={set} x={360} y={62} radius={19} label="Shunt resistance S — turn the box" />
      <Knob spec={control('divisions', 'slider')} params={params} onChange={set} x={485} y={62} radius={19} label="Divisions on the scale" />
      <StageSwitch spec={control('k1Closed', 'toggle')} params={params} onChange={(k, v) => throwKey(k, Boolean(v))} x={605} y={62} label="Key K₁" />
      <StageSwitch spec={control('shuntClosed', 'toggle')} params={params} onChange={(k, v) => throwKey(k, Boolean(v))} x={710} y={62} label="Shunt key K₂" />
    </CircuitBench>
  );
}

export default function GalvanometerHalfDeflectionExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      viewportOverlay={(params) => {
        const r = readBench(params);
        return (
          <>
            <ViewPill label="θ" value={safe(r.deflection, 1)} unit="div" />
            <ViewPill label="I_g" value={(r.coilCurrent * 1e6).toFixed(2)} unit="µA" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const r = readBench(p);
        const divisions = num(p, 'divisions', 30);
        const atHalf =
          bool(p, 'shuntClosed', false) && Math.abs(r.deflection - divisions / 2) < 0.5;
        return {
          title: 'Observation table — half-deflection method',
          columns: [
            { key: 'r', label: 'R', unit: 'Ω', precision: 0 },
            { key: 's', label: 'S', unit: 'Ω', precision: 1 },
            { key: 'd', label: 'Deflection', unit: 'div', precision: 1 },
            { key: 'g', label: 'G = RS/(R−S)', unit: 'Ω', precision: 2, derived: true }
          ],
          capture: () => ({
            r: num(p, 'seriesR', 10000),
            s: num(p, 'shunt', 55),
            d: r.deflection,
            g: 0
          }),
          derive: (row) => ({
            ...row,
            g: galvanometerResistanceHalfDeflection(Number(row.r), Number(row.s))
          }),
          comparison: {
            label: 'galvanometer resistance',
            unit: 'Ω',
            experimental: r.measuredG,
            theoretical: r.trueG,
            precision: 2
          },
          captureEnabled: atHalf,
          captureHint: atHalf
            ? 'The pointer is at half deflection — record this pair of readings.'
            : 'Set full-scale deflection with R, then close K₂ and adjust the shunt until the pointer reads exactly half.'
        };
      }}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education, CORRECT_WIRING, SHUNT_IN_SERIES };
