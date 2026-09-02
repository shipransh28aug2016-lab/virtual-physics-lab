import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BatteryCell, MeterFace, MetreBridgeWire, Switch } from '@/components/instruments/Instruments';
import { num, ro } from './_shared';
import { DragX, type StageApi } from '@/components/controls/StageKit';

import { meta } from './emf-comparison.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#25d0ee', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'slider', key: 'emf1', label: 'EMF of cell E₁', symbol: '\\varepsilon_1', unit: 'V', min: 1.0, max: 2.5, step: 0.01, initial: 1.5, precision: 2 },
    { kind: 'slider', key: 'emf2', label: 'EMF of cell E₂', symbol: '\\varepsilon_2', unit: 'V', min: 1.0, max: 2.5, step: 0.01, initial: 1.2, precision: 2 },
    { kind: 'slider', key: 'driver', label: 'Driver cell emf', symbol: '\\varepsilon_D', unit: 'V', min: 2.6, max: 8, step: 0.1, initial: 4, precision: 1 },
    { kind: 'slider', key: 'l1', label: 'Balance length for E₁', symbol: 'l_1', unit: 'cm', min: 10, max: 100, step: 0.5, initial: 80, precision: 1 },
    { kind: 'slider', key: 'l2', label: 'Balance length for E₂', symbol: 'l_2', unit: 'cm', min: 10, max: 100, step: 0.5, initial: 64, precision: 1 }
  ],
  defaults: { emf1: 1.5, emf2: 1.2, driver: 4, l1: 80, l2: 64 }
};

const education: EducationPack = {
  theory: [
    'A potentiometer measures an emf by balancing it against a known potential drop along a uniform wire. At the balance point the galvanometer shows null deflection, so no current is drawn from the cell under test and its true emf, not its terminal voltage, is measured.',
    'Because the wire is uniform, the potential drop is directly proportional to its length. Two cells balanced against the same wire therefore give balance lengths in the ratio of their emfs.',
    'A driver cell of higher emf than either test cell maintains a steady current through the wire, and a rheostat keeps that current constant so that both measurements use the same potential gradient.'
  ],
  formulas: [
    { tex: '\\frac{\\varepsilon_1}{\\varepsilon_2} = \\frac{l_1}{l_2}', caption: 'Comparison of two emfs.' },
    { tex: '\\varepsilon = k l', caption: 'emf equals potential gradient times balance length.' },
    { tex: 'k = \\frac{\\varepsilon_D}{L}', caption: 'Potential gradient for a uniform wire.' }
  ],
  variables: [
    { symbol: 'l_1', name: 'Balance length for E₁', unit: 'cm' },
    { symbol: 'l_2', name: 'Balance length for E₂', unit: 'cm' },
    { symbol: 'k', name: 'Potential gradient', unit: 'V/cm' },
    { symbol: '\\varepsilon', name: 'EMF', unit: 'V' }
  ],
  procedure: [
    'Connect the driver cell, rheostat and key in series with the potentiometer wire and set a steady current.',
    'Connect cell E₁ through the two-way key and slide the jockey until the galvanometer shows null deflection. Record l₁.',
    'Switch the two-way key to cell E₂, keeping the driver current unchanged, and record l₂.',
    'Repeat the pair of readings several times and compute ε₁/ε₂ = l₁/l₂.'
  ],
  precautions: ['The driver emf must exceed both test emfs.', 'The rheostat must not be disturbed between the two readings.', 'The positive terminals of both cells go to the positive end of the wire.', 'Tap the jockey instead of sliding it.'],
  tips: ['If no null point is found, the driver current is too low or the cell connections are reversed.'],
  viva: [
    { q: 'Why does a potentiometer measure emf rather than terminal voltage?', a: 'At null deflection no current flows through the cell, so there is no internal drop to subtract.' },
    { q: 'Why must the driver emf be larger than both test emfs?', a: 'Otherwise the total potential drop along the wire is less than the cell emf and no balance point exists.' },
    { q: 'Why must the rheostat stay fixed between the two readings?', a: 'So that the potential gradient k is the same for both cells and cancels in the ratio.' },
    { q: 'What is the advantage over a voltmeter?', a: 'A voltmeter draws current and reads V = ε − Ir, which is always less than the emf.' }
  ],
  resultTemplate: 'The ratio of the emfs of the two cells is ε₁/ε₂ = l₁/l₂ = … .'
};

function compute(params: ParamValues): ModelOutput {
  const emf1 = num(params, 'emf1', 1.5);
  const emf2 = num(params, 'emf2', 1.2);
  const driver = num(params, 'driver', 4);
  const l1 = num(params, 'l1', 80);
  const l2 = num(params, 'l2', 64);
  const k = driver / 100;
  const measuredRatio = l1 / l2;
  const trueRatio = emf1 / emf2;
  const expectedL2 = l1 * (emf2 / emf1);
  const points: { x: number; y: number }[] = [];
  for (let l = 10; l <= 100; l += 1) points.push({ x: l, y: l * (emf2 / emf1) });

  return {
    readouts: [
      ro('ratio', 'Measured ratio l₁/l₂', measuredRatio, '\u2014', 4),
      ro('true', 'Actual ratio ε₁/ε₂', trueRatio, '\u2014', 4, { tone: Math.abs(measuredRatio - trueRatio) / trueRatio > 0.02 ? 'alert' : 'normal' }),
      ro('l1', 'Balance length l₁', l1, 'cm', 1),
      ro('l2', 'Balance length l₂', l2, 'cm', 1),
      ro('l2e', 'Expected l₂', expectedL2, 'cm', 1),
      ro('k', 'Potential gradient', k, 'V/cm', 4),
      ro('e1', 'E₁ from k·l₁', k * l1, 'V', 3),
      ro('e2', 'E₂ from k·l₂', k * l2, 'V', 3)
    ],
    graph: {
      title: 'Balance length for E₂ against balance length for E₁',
      xLabel: 'l₁ (cm)', yLabel: 'l₂ (cm)',
      series: [{ key: 'l2', label: 'l₂', color: '#25d0ee', points }]
    },
    live: { x: l1, y: l2 },
    description: `With a potential gradient of ${k.toFixed(4)} volt per centimetre, cell E₁ balances at ${l1.toFixed(1)} cm and cell E₂ at ${l2.toFixed(1)} cm, giving a ratio of ${measuredRatio.toFixed(4)} against the actual ratio of ${trueRatio.toFixed(4)}.`,
    result: `\u03b5\u2081/\u03b5\u2082 = l\u2081/l\u2082 = ${l1.toFixed(1)}/${l2.toFixed(1)} = ${measuredRatio.toFixed(4)}. The actual ratio of the two cells is ${trueRatio.toFixed(4)}, a difference of ${((measuredRatio / trueRatio - 1) * 100).toFixed(2)}%.`,
    issues: Math.abs(measuredRatio - trueRatio) / trueRatio > 0.02
      ? [{ field: 'l2', severity: 'warning', message: `The readings imply a ratio ${(measuredRatio / trueRatio * 100 - 100) >= 0 ? '+' : ''}${((measuredRatio / trueRatio - 1) * 100).toFixed(1)}% away from the actual cells. A balanced reading for E\u2082 would be ${expectedL2.toFixed(1)} cm.` }]
      : []
  };
}

function Stage({ params, set, control }: StageApi) {
  const emf1 = num(params, 'emf1', 1.5);
  const emf2 = num(params, 'emf2', 1.2);
  const driver = num(params, 'driver', 4);
  const l1 = num(params, 'l1', 80);
  const l2 = num(params, 'l2', 64);
  const wireOk = driver > Math.max(emf1, emf2);
  const twoWay = 'M250 430 H330 M330 430 L390 404 M330 430 V456';

  return (
    <svg viewBox="0 0 900 520" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={450} y={34} textAnchor="middle" fontSize={14} fill="#eaf1f8" fontWeight={600}>
        Potentiometer comparison of two cells
      </text>
      <MetreBridgeWire x={120} y={282} length={620} jockeyCm={l1} live={wireOk} showScale />
      <g transform={`translate(${120 + (l2 / 100) * 620} 0)`}>
        <line x1={0} y1={274} x2={0} y2={254} stroke="#9d8cff" strokeWidth={2} strokeDasharray="4 3" />
        <text y={248} textAnchor="middle" fontSize={10} fill="#9d8cff" fontFamily="ui-monospace, monospace">l₂ = {l2.toFixed(1)}</text>
      </g>
      <text x={120 + (l1 / 100) * 620} y={248} textAnchor="middle" fontSize={10} fill="#ffc65c" fontFamily="ui-monospace, monospace">
        l₁ = {l1.toFixed(1)}
      </text>
      <BatteryCell x={70} y={380} emf={driver} live={wireOk} label="driver" />
      <text x={70} y={416} textAnchor="middle" fontSize={9} fill="#8497ad">{driver.toFixed(1)} V</text>
      <BatteryCell x={250} y={430} emf={emf1} live label="E₁" />
      <BatteryCell x={250} y={490} emf={emf2} live label="E₂" />
      <path d={twoWay} fill="none" className="lead lead-live" strokeWidth={2} />
      <circle cx={390} cy={404} r={4} fill="#ffc65c" />
      <circle cx={330} cy={456} r={4} fill="#4a5c72" />
      <text x={410} y={408} fontSize={10} fill="#8497ad">two-way key selects E₁</text>
      <Switch x={560} y={380} closed live={wireOk} label="K" />
      <MeterFace x={700} y={430} scale={0.55} deflection={0} symbol="G" zeroCentre value="null" />
      <text x={700} y={482} textAnchor="middle" fontSize={9} fill="#45d68b">null deflection</text>
      <text x={450} y={510} textAnchor="middle" fontSize={11} fill="#5e7189">
        ε₁/ε₂ = l₁/l₂ = {l1.toFixed(1)}/{l2.toFixed(1)} = {(l1 / l2).toFixed(4)} · gradient {(driver / 100).toFixed(4)} V/cm
      </text>
      {/* Two jockeys on the potentiometer wire: one for each cell. */}
      <DragX
        spec={control('l1', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={120}
        y={324}
        length={620}
        mapping={{ toValue: (dx) => (dx / 620) * 100, invert: (cm) => 120 + (cm / 100) * 620 }}
        label="Balance length l₁ for E₁ — drag the jockey"
      />
      <DragX
        spec={control('l2', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={120}
        y={360}
        length={620}
        mapping={{ toValue: (dx) => (dx / 620) * 100, invert: (cm) => 120 + (cm / 100) * 620 }}
        label="Balance length l₂ for E₂ — drag the jockey"
      />
        </svg>
  );
}

export default function EmfComparisonExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const l1 = num(p, 'l1', 80);
        const l2 = num(p, 'l2', 64);
        const emf1 = num(p, 'emf1', 1.5);
        const emf2 = num(p, 'emf2', 1.2);
        return {
          title: 'Observation table — comparison of EMFs',
          columns: [
            { key: 'n', label: 'Reading', unit: '—', precision: 0 },
            { key: 'l1', label: 'l₁', unit: 'cm', precision: 1 },
            { key: 'l2', label: 'l₂', unit: 'cm', precision: 1 },
            { key: 'ratio', label: 'l₁/l₂', unit: '—', precision: 4, derived: true }
          ],
          capture: () => ({ n: 1, l1, l2, ratio: 0 }),
          derive: (row) => ({ ...row, ratio: Number(row.l1) / Number(row.l2) }),
          comparison: { label: 'ε₁/ε₂', unit: '—', experimental: l1 / l2, theoretical: emf1 / emf2, precision: 4 }
        };
      }}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education };
