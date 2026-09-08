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
import { useConnect } from '@/lab/interaction/useConnect';
import { useSound } from '@/lab/audio';
import { nextHint, type FeedbackState } from '@/lab/feedback/rules';
import { formatSI } from '@/utils/format';
import { col, num, bool, ro, singleSeriesGraph, str } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './ohms-law.meta';

export { meta };

/* ── the apparatus on the bench ─────────────────────────────────────────── */

const AMMETER_RANGE = 1.5;
const VOLTMETER_RANGE = 15;
/** A real moving-coil voltmeter, not an ideal one: it loads the branch. */
const VOLTMETER_RESISTANCE = 20_000;
/** A real ammeter, not an ideal one: it drops a little of the loop voltage. */
const AMMETER_RESISTANCE = 0.08;

/** Where each part sits. Layout is a drawing hint — the solver never reads it. */
function benchParts(params: ParamValues): Part[] {
  return [
    {
      id: 'r',
      kind: 'resistor',
      resistance: num(params, 'load', 20),
      label: 'Resistor R',
      layout: { x: 232, y: 180 }
    },
    {
      id: 'am',
      kind: 'ammeter',
      resistance: AMMETER_RESISTANCE,
      range: AMMETER_RANGE,
      label: 'Ammeter',
      layout: { x: 430, y: 180 }
    },
    {
      id: 'rh',
      kind: 'rheostat',
      maxResistance: 50,
      fraction: num(params, 'rheostat', 10) / 50,
      label: 'Rheostat',
      layout: { x: 620, y: 180 }
    },
    {
      id: 'k',
      kind: 'key',
      closed: bool(params, 'closed', true),
      label: 'Key K',
      layout: { x: 250, y: 310 }
    },
    {
      id: 'c',
      kind: 'cell',
      emf: num(params, 'emf', 6),
      internalResistance: num(params, 'rInt', 0.5),
      label: 'Cell',
      layout: { x: 470, y: 310 }
    },
    {
      id: 'vm',
      kind: 'voltmeter',
      resistance: VOLTMETER_RESISTANCE,
      range: VOLTMETER_RANGE,
      label: 'Voltmeter',
      layout: { x: 232, y: 392 }
    }
  ];
}

/**
 * The circuit the practical asks for: cell, key, rheostat and ammeter in one
 * series loop, with the voltmeter bridged across the resistor alone.
 */
const CORRECT_WIRING = [
  'c.a-k.b',
  'k.a-r.a',
  'r.b-am.a',
  'am.b-rh.a',
  'c.b-rh.b',
  'r.a-vm.a',
  'r.b-vm.b'
]
  .map((p) => p.split('-').sort().join('-'))
  .sort()
  .join(';');

const graphOf = (params: ParamValues): CircuitGraph => ({
  parts: benchParts(params),
  wires: decodeWires(str(params, 'wiring', CORRECT_WIRING))
});

const definition: ExperimentDefinition = {
  id: meta.id,
  slug: meta.slug,
  title: meta.title,
  shortTitle: meta.shortTitle,
  aim: meta.aim,
  unit: meta.unit,
  chapter: meta.chapter,
  kind: meta.kind,
  difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle,
  accent: '#25d0ee',
  controls: [
    { kind: 'slider', key: 'emf', label: 'Battery emf', symbol: '\\varepsilon', unit: 'V', min: 0, max: 12, step: 0.1, initial: 6, precision: 1, onStage: true },
    { kind: 'slider', key: 'rInt', label: 'Internal resistance', symbol: 'r', unit: 'Ω', min: 0, max: 5, step: 0.05, initial: 0.5, onStage: true },
    { kind: 'slider', key: 'load', label: 'Load resistance', symbol: 'R', unit: 'Ω', min: 1, max: 100, step: 0.5, initial: 20, precision: 1, scale: 'log', onStage: true },
    { kind: 'slider', key: 'rheostat', label: 'Rheostat setting', symbol: 'R_h', unit: 'Ω', min: 0, max: 50, step: 0.5, initial: 10, precision: 1, hint: 'Adds in series with the load', onStage: true },
    { kind: 'toggle', key: 'closed', label: 'Key K closed', initial: true, hint: 'Open the key to break the circuit', onStage: true },
    {
      // The student's wiring, carried as an ordinary parameter so the netlist a
      // reading came from is as recordable and resettable as a knob position.
      // The named options are the two starting layouts; free wiring stores its
      // own encoding.
      kind: 'select',
      key: 'wiring',
      label: 'Circuit wiring',
      initial: CORRECT_WIRING,
      onStage: true,
      options: [
        { value: CORRECT_WIRING, label: 'Wired as the practical asks' },
        { value: '', label: 'Bare bench — wire it yourself' }
      ]
    }
  ],
  defaults: { emf: 6, rInt: 0.5, load: 20, rheostat: 10, closed: true, wiring: CORRECT_WIRING }
};

const education: EducationPack = {
  theory: [
    'Ohm’s law states that the current through a conductor is directly proportional to the potential difference across its ends, provided the physical conditions such as temperature remain unchanged. The constant of proportionality is the resistance of the conductor.',
    'In a real cell the emf is not the voltage available to the circuit. Part of it is spent driving current through the internal resistance, so the terminal voltage is always less than the emf while current flows. The gap between them grows with the current.',
    'A rheostat in series lets you sweep the current without changing the cell. Plotting the voltmeter reading against the ammeter reading gives a straight line through the origin for an ohmic conductor, and its slope is the reciprocal of the resistance.',
    'The meters on this bench are real instruments, not ideal ones. The ammeter has a small resistance that it adds to the loop, and the voltmeter has a large but finite resistance that draws a little current of its own. That is why V/I from the meters is never exactly the marked value of the resistor — the difference is the loading error, and it is the same error a real bench has.'
  ],
  formulas: [
    { tex: 'V = IR', caption: 'Ohm’s law. R is constant for an ohmic conductor at fixed temperature.' },
    { tex: 'I = \\frac{\\varepsilon}{R + R_h + r}', caption: 'Current in a single loop containing a cell of internal resistance r.' },
    { tex: 'V_{term} = \\varepsilon - Ir', caption: 'Terminal voltage of the cell under load.' },
    { tex: 'P = VI = I^2 R = \\frac{V^2}{R}', caption: 'Power dissipated in the resistor.' }
  ],
  variables: [
    { symbol: 'V', name: 'Potential difference', unit: 'V' },
    { symbol: 'I', name: 'Current', unit: 'A' },
    { symbol: 'R', name: 'Resistance', unit: 'Ω' },
    { symbol: '\\varepsilon', name: 'Electromotive force', unit: 'V', note: 'Open-circuit terminal voltage' },
    { symbol: 'r', name: 'Internal resistance', unit: 'Ω' },
    { symbol: 'P', name: 'Power', unit: 'W' }
  ],
  procedure: [
    'Wire the loop: take a lead from the positive terminal of the cell and connect it, through the key, the resistor, the ammeter and the rheostat, back to the negative terminal. Press a socket to pick a lead up and press a second socket to put it down.',
    'Bridge the voltmeter across the resistor alone — never in the loop, and never across the ammeter.',
    'Close the key and set the rheostat to its maximum so the current starts small.',
    'Note the ammeter and voltmeter readings and press Record reading.',
    'Reduce the rheostat in steps, recording at least six pairs of readings.',
    'Plot V against I; the graph should be a straight line through the origin, and its slope is the reciprocal of the resistance.',
    'Open the key and confirm that both meters return to zero.'
  ],
  precautions: [
    'Pass current only briefly; continuous heating changes the resistance and ruins the linearity.',
    'Check the zero error of both meters before starting.',
    'Connect the ammeter in series and the voltmeter in parallel — reversing them damages the instruments, and this bench will tell you when you have.',
    'Keep the rheostat at maximum before closing the key.',
    'Watch the polarity: current must enter each meter by its positive terminal or the pointer is driven backwards against the stop.'
  ],
  sourcesOfError: [
    'Heating of the wire raises its resistance and bends the graph at high current.',
    'Contact resistance at the terminals and plug keys.',
    'Finite resistance of the ammeter and finite loading by the voltmeter — both are modelled here, so V/I differs slightly from the marked resistance.'
  ],
  tips: [
    'Set r = 0 to model an ideal cell: the terminal voltage then stays equal to the emf.',
    'Sweep the load from 1 Ω to 100 Ω and watch the current saturate — the internal resistance dominates at low load.',
    'Try wiring the ammeter across the resistor instead of in series with it, and read what the bench says about it.'
  ],
  viva: [
    { q: 'State Ohm’s law.', a: 'At constant temperature the current through a conductor is directly proportional to the potential difference across its ends, V = IR.' },
    { q: 'Why is the terminal voltage of a cell less than its emf when current flows?', a: 'Because part of the emf is dropped across the internal resistance: V = ε − Ir.' },
    { q: 'Is Ohm’s law a universal law?', a: 'No. Diodes, transistors, electrolytes and filament lamps are non-ohmic; their V–I graphs are not straight lines.' },
    { q: 'Why is the ammeter connected in series and the voltmeter in parallel?', a: 'The ammeter must carry the same current as the load, so it has very low resistance; the voltmeter must not draw current, so it has very high resistance.' },
    { q: 'What is the resistance of an ideal ammeter and an ideal voltmeter?', a: 'Zero and infinity respectively.' },
    { q: 'Why does V/I from the meters differ a little from the marked resistance?', a: 'Because the voltmeter draws a small current of its own, so the ammeter reads slightly more than the current in the resistor alone. That is the loading error.' }
  ],
  resultTemplate:
    'The V–I graph is a straight line through the origin, so the conductor obeys Ohm’s law and its resistance equals the reciprocal of the slope.'
};

/* ── model ──────────────────────────────────────────────────────────────── */

/** Never let a non-finite number reach the page: the audits fail the run for it. */
const safe = (v: number, digits: number): string => (Number.isFinite(v) ? v.toFixed(digits) : '—');

export interface BenchReading {
  ammeter: number;
  voltmeter: number;
  terminalVoltage: number;
  faults: Fault[];
  closedPath: boolean;
  loopResistance: number;
}

/** Solves the bench as the student wired it and reads the two meters. */
export function readBench(params: ParamValues): BenchReading {
  const graph = graphOf(params);
  const solution = solveCircuit(graph);
  const faults = detectFaults(graph, solution);
  return {
    ammeter: solution.current.get('am') ?? 0,
    voltmeter: solution.voltage.get('vm') ?? 0,
    terminalVoltage: solution.voltage.get('c') ?? 0,
    faults,
    closedPath: hasClosedPath(graph, solution.nodes, 'c'),
    loopResistance: num(params, 'load', 20) + num(params, 'rheostat', 10) + num(params, 'rInt', 0.5)
  };
}

/** The bench state the rule-based tutor is allowed to see. */
function feedbackState(reading: BenchReading): FeedbackState {
  const has = (kind: Fault['kind']) => reading.faults.some((f) => f.kind === kind);
  return {
    closedPath: reading.closedPath,
    shorted: has('short-circuit'),
    current: reading.ammeter,
    floatingTerminals: 0, // reported by the fault list, not repeated as a hint
    ammeterInParallel: has('ammeter-in-parallel'),
    voltmeterInSeries: has('voltmeter-in-series'),
    reversedPolarity: has('reversed-polarity'),
    meterFraction: Math.abs(reading.ammeter) / AMMETER_RANGE
  };
}

function compute(params: ParamValues): ModelOutput {
  const emf = num(params, 'emf', 6);
  const rInt = num(params, 'rInt', 0.5);
  const load = num(params, 'load', 20);
  const reading = readBench(params);

  const i = reading.ammeter;
  const v = reading.voltmeter;
  const measuredR = Math.abs(i) > 1e-9 ? v / i : Number.NaN;

  const issues: ValidationIssue[] = reading.faults.map((f) => ({
    field: 'wiring',
    severity: f.severity,
    message: f.message
  }));

  // The tutor adds only what the fault list cannot say: whether the reading is
  // worth taking at all. Everything else is already an honest fault.
  const hint = nextHint(feedbackState(reading));
  if (hint && (hint.kind === 'off-scale' || hint.kind === 'no-deflection')) {
    issues.push({ field: 'rheostat', severity: hint.severity, message: `${hint.observation} ${hint.action}` });
  }
  if (Math.abs(i) > 0.8) {
    issues.push({
      field: 'load',
      severity: 'warning',
      message: 'Current above 0.8 A would heat the wire and make the resistance drift in a real bench setup.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let n = 1; n <= 40; n += 1) {
    const vv = (emf * n) / 40;
    points.push({ x: vv, y: vv / Math.max(load, 1e-6) });
  }

  return {
    readouts: [
      ro('i', 'Ammeter reads I', i, 'A', 4),
      ro('v', 'Voltmeter reads V', v, 'V', 3),
      ro('vt', 'Terminal voltage', reading.terminalVoltage, 'V', 3),
      ro('rm', 'V / I', Number.isFinite(measuredR) ? measuredR : 0, 'Ω', 2, {
        sub: Number.isFinite(measuredR) ? `marked ${load.toFixed(1)} Ω` : 'no current flowing',
        tone: Number.isFinite(measuredR) ? 'normal' : 'dim'
      }),
      ro('r', 'Loop resistance', reading.loopResistance, 'Ω', 2),
      ro('p', 'Power in R', i * v, 'W', 3),
      ro('lost', 'Lost in cell', i * i * rInt, 'W', 3, { tone: i * rInt > 0.3 ? 'alert' : 'normal' }),
      ro('links', 'Connections made', decodeWires(str(params, 'wiring', CORRECT_WIRING)).length, '', 0, {
        tone: 'dim'
      })
    ],
    graph: singleSeriesGraph({
      title: 'Current against potential difference across the load',
      xLabel: 'V (V)',
      yLabel: 'I (A)',
      seriesLabel: 'I = V / R',
      points,
      live: { x: v, y: i },
      markers:
        Math.abs(i) > 1e-9
          ? [{ x: v, y: i, label: `slope = 1/${load.toFixed(1)} Ω`, color: '#ffc65c' }]
          : []
    }),
    issues,
    description: `A cell of emf ${emf.toFixed(1)} volts and internal resistance ${rInt.toFixed(2)} ohm on a bench the student has wired with ${decodeWires(str(params, 'wiring', CORRECT_WIRING)).length} leads. The ammeter reads ${safe(i, 4)} ampere and the voltmeter ${safe(v, 3)} volt. The key is ${bool(params, 'closed', true) ? 'closed' : 'open'}.`,
    result: reading.faults.some((f) => f.severity === 'error')
      ? `No valid reading can be taken while the circuit is mis-wired: ${reading.faults[0].message}`
      : `With the key ${bool(params, 'closed', true) ? 'closed' : 'open'}, the ammeter reads ${safe(i, 4)} A and the voltmeter ${safe(v, 3)} V across the ${load.toFixed(1)} Ω resistor, so V/I = ${safe(measuredR, 2)} Ω — the resistance of the conductor, as Ohm’s law requires.`
  };
}

/* ── the apparatus ──────────────────────────────────────────────────────── */

function Stage({ params, set, control }: StageApi) {
  const wiring = str(params, 'wiring', CORRECT_WIRING);
  const { play } = useSound();

  const connect = useConnect({
    wiring,
    onChange: (next) => set('wiring', next),
    onCue: play
  });

  const graph = useMemo(() => graphOf(params), [params]);
  const solution = useMemo(() => solveCircuit(graph), [graph]);
  const faults = useMemo(() => detectFaults(graph, solution), [graph, solution]);

  const i = solution.current.get('am') ?? 0;
  const v = solution.voltage.get('vm') ?? 0;
  const live = Math.abs(solution.current.get('c') ?? 0) > 1e-9;
  const worst = faults[0];

  return (
    <CircuitBench
      parts={graph.parts}
      wiring={wiring}
      solution={solution}
      connect={connect}
      live={live}
      title={`Ohm’s law bench · ${connect.connections} lead${connect.connections === 1 ? '' : 's'} connected`}
      subtitle={
        worst
          ? worst.message.slice(0, 96)
          : `Ammeter ${safe(i, 3)} A · voltmeter ${safe(v, 2)} V · V/I = ${safe(Math.abs(i) > 1e-9 ? v / i : Number.NaN, 1)} Ω`
      }
    >
      <Knob spec={control('emf', 'slider')} params={params} onChange={set} x={120} y={62} radius={20} label="Battery emf — turn the dial" />
      <Knob spec={control('rInt', 'slider')} params={params} onChange={set} x={250} y={62} radius={18} label="Internal resistance r — turn the dial" />
      <Knob spec={control('load', 'slider')} params={params} onChange={set} x={380} y={62} radius={20} label="Load resistance R — turn the dial" />
      <Knob spec={control('rheostat', 'slider')} params={params} onChange={set} x={510} y={62} radius={20} label="Rheostat R_h — turn the dial" />
      <StageSwitch
        spec={control('closed', 'toggle')}
        params={params}
        onChange={(key, value) => {
          set(key, value);
          play(value ? 'switchOn' : 'switchOff');
        }}
        x={640}
        y={62}
        label="Key K"
      />
    </CircuitBench>
  );
}

export default function OhmsLawExperiment() {
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
            <ViewPill label="I" value={formatSI(r.ammeter, 3)} unit="A" />
            <ViewPill label="V" value={safe(r.voltmeter, 3)} unit="V" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const r = readBench(p);
        const load = num(p, 'load', 20);
        return {
          title: 'Observation table — V–I characteristic of the resistor',
          columns: [
            col('rheo', 'Rheostat', 'Ω', 1),
            col('v', 'V', 'V', 3),
            col('i', 'I', 'A', 4),
            col('r', 'R = V/I', 'Ω', 2, true)
          ],
          capture: () => ({ rheo: num(p, 'rheostat', 10), v: r.voltmeter, i: r.ammeter, r: 0 }),
          derive: (row) => {
            const vv = Number(row.v);
            const ii = Number(row.i);
            return { ...row, r: Math.abs(ii) < 1e-12 ? Number.NaN : vv / ii };
          },
          comparison: {
            label: 'Resistance of the conductor',
            unit: 'Ω',
            experimental: Math.abs(r.ammeter) > 1e-9 ? r.voltmeter / r.ammeter : load,
            theoretical: load,
            precision: 2
          },
          captureEnabled: !r.faults.some((f) => f.severity === 'error'),
          captureHint: r.faults.some((f) => f.severity === 'error')
            ? 'Fix the wiring before recording — a mis-wired circuit gives no valid reading.'
            : 'Change the rheostat between readings, then record.'
        };
      }}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education, CORRECT_WIRING };
