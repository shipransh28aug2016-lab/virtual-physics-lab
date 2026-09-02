import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BatteryCell, MeterFace, MetreBridgeWire, Resistor, Switch } from '@/components/instruments/Instruments';
import { internalResistanceFromPotentiometer, terminalVoltage } from '@/physics-engine/circuits';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { DragX, Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './internal-resistance.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#25d0ee', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'slider', key: 'emf', label: 'Cell emf', symbol: '\\varepsilon', unit: 'V', min: 1.0, max: 2.5, step: 0.01, initial: 1.5, precision: 2 },
    { kind: 'slider', key: 'rInt', label: 'True internal resistance', symbol: 'r', unit: '\u03a9', min: 0.2, max: 20, step: 0.1, initial: 2, precision: 1 },
    { kind: 'slider', key: 'driver', label: 'Driver cell emf', symbol: '\\varepsilon_D', unit: 'V', min: 2.5, max: 6, step: 0.1, initial: 4, precision: 1 },
    { kind: 'slider', key: 'l1', label: 'Balance length (open circuit)', symbol: 'l_1', unit: 'cm', min: 20, max: 100, step: 0.5, initial: 75, precision: 1 },
    { kind: 'slider', key: 'shunt', label: 'Shunt across the cell', symbol: 'R', unit: '\u03a9', min: 1, max: 100, step: 1, initial: 10 },
    { kind: 'slider', key: 'l2', label: 'Balance length (with shunt)', symbol: 'l_2', unit: 'cm', min: 5, max: 100, step: 0.5, initial: 60, precision: 1 },
    { kind: 'toggle', key: 'shunted', label: 'Shunt key closed', initial: true, hint: 'Draws current through the cell so its terminal voltage falls' }
  ],
  defaults: { emf: 1.5, rInt: 2, driver: 4, l1: 75, shunt: 10, l2: 60, shunted: true }
};

const education: EducationPack = {
  theory: [
    'Every cell has an internal resistance because the electrolyte offers resistance to the flow of ions. When the cell delivers current its terminal voltage falls below the emf by the drop Ir across this internal resistance.',
    'A potentiometer compares two voltages without drawing current from either of them. With the shunt key open the balance length is proportional to the emf of the cell; with the shunt closed the cell supplies current and the balance length becomes proportional to its terminal voltage.',
    'The ratio of the two lengths therefore gives the internal resistance directly, because emf divided by terminal voltage equals (R + r)/R.'
  ],
  formulas: [
    { tex: 'V = \\varepsilon - Ir', caption: 'Terminal voltage.' },
    { tex: 'r = R\\left(\\frac{l_1}{l_2} - 1\\right)', caption: 'Internal resistance from the two balance lengths.' },
    { tex: '\\frac{\\varepsilon}{V} = \\frac{l_1}{l_2}', caption: 'Potentiometer comparison.' },
    { tex: 'I = \\frac{\\varepsilon}{R + r}', caption: 'Current through the shunt.' }
  ],
  variables: [
    { symbol: 'l_1', name: 'Balance length, open circuit', unit: 'cm' },
    { symbol: 'l_2', name: 'Balance length, shunted', unit: 'cm' },
    { symbol: 'R', name: 'Shunt resistance', unit: '\u03a9' },
    { symbol: 'r', name: 'Internal resistance', unit: '\u03a9' },
    { symbol: '\\varepsilon', name: 'Cell emf', unit: 'V' }
  ],
  procedure: [
    'Set up the potentiometer with the driver cell and check that the galvanometer deflects in opposite senses at the two ends of the wire.',
    'With the shunt key open, find the balance length l₁ and record it.',
    'Insert a known shunt R across the cell, close the key and find the new balance length l₂.',
    'Repeat for several values of R and compute r from r = R(l₁/l₂ − 1).',
    'Take the mean of the individual values of r.'
  ],
  precautions: ['The driver cell emf must be greater than the emf of the test cell or no balance point exists.', 'Do not leave the shunt key closed for long, as the cell polarises.', 'Tap the jockey rather than sliding it along the wire.', 'The positive terminal of the test cell must be connected to the positive end of the wire.'],
  tips: ['Use a shunt of the same order as the internal resistance so that l₂ is well separated from l₁.'],
  viva: [
    { q: 'Why is a potentiometer preferred to a voltmeter here?', a: 'Because it draws no current at the balance point, so it measures the emf rather than the loaded terminal voltage.' },
    { q: 'What happens to the terminal voltage when the shunt is connected?', a: 'It falls below the emf by the amount Ir.' },
    { q: 'Why should the driver cell emf exceed the test cell emf?', a: 'Otherwise the potential drop along the whole wire is less than the cell emf and no null point can be found.' },
    { q: 'How does internal resistance change with use?', a: 'It increases as the cell is discharged and as the electrolyte is depleted.' }
  ],
  resultTemplate: 'The internal resistance of the given cell is r = … ohm (mean of the readings).'
};

function compute(params: ParamValues): ModelOutput {
  const emf = num(params, 'emf', 1.5);
  const rInt = num(params, 'rInt', 2);
  const driver = num(params, 'driver', 4);
  const l1 = num(params, 'l1', 75);
  const l2 = num(params, 'l2', 60);
  const shunt = num(params, 'shunt', 10);
  const shunted = Boolean(params.shunted ?? true);

  const measured = internalResistanceFromPotentiometer(l1, l2, shunt);
  const current = shunted ? emf / (shunt + rInt) : 0;
  const terminal = shunted ? terminalVoltage({ emf, internalResistance: rInt }, current) : emf;
  const expectedL2 = l1;
  const expectedShuntedL2 = l1 * (terminal / emf);

  const points: { x: number; y: number }[] = [];
  for (let sh = 1; sh <= 100; sh += 1) {
    const cur = emf / (sh + rInt);
    const term = terminalVoltage({ emf, internalResistance: rInt }, cur);
    points.push({ x: sh, y: internalResistanceFromPotentiometer(l1, l1 * (term / emf), sh) });
  }

  return {
    readouts: [
      ro('r', 'Measured internal resistance', measured, '\u03a9', 3),
      ro('l1', 'Balance length l₁', l1, 'cm', 1),
      ro('l2', 'Balance length l₂', l2, 'cm', 1),
      ro('l2e', 'Expected l₂ for this cell', expectedShuntedL2, 'cm', 1, { tone: Math.abs(l2 - expectedShuntedL2) > 1.5 ? 'alert' : 'normal' }),
      ro('v', 'Terminal voltage', terminal, 'V', 3),
      ro('i', 'Current through the cell', current, 'A', 4),
      ro('k', 'Potential gradient', driver / 100, 'V/cm', 4, { sub: `${((driver / 100) * 1000).toFixed(1)} mV/cm` }),
      ro('lmax', 'Longest balance length', Math.min(100, (emf / Math.max(driver / 100, 1e-9))), 'cm', 1, { tone: driver > emf ? 'normal' : 'alert', sub: driver > emf ? 'driver > cell, null point exists' : 'raise the driver emf' }),
      ro('ok', 'Balance achievable', driver > emf ? 1 : 0, '\u2014', 0, { tone: driver > emf ? 'normal' : 'alert', text: driver > emf ? 'yes' : 'no' })
    ],
    graph: {
      title: 'Measured r against shunt resistance',
      xLabel: 'Shunt R (\u03a9)', yLabel: 'r (\u03a9)',
      series: [{ key: 'r', label: 'r', color: '#25d0ee', points }]
    },
    live: { x: shunt, y: measured },
    description: shunted
      ? `With the shunt closed the cell delivers ${formatSI(current, 3)} ampere and its terminal voltage drops to ${terminal.toFixed(3)} volt. The balance lengths give r = ${shunt.toFixed(0)}(${l1.toFixed(1)}/${l2.toFixed(1)} − 1) = ${measured.toFixed(3)} ohm.`
      : `With the shunt open no current flows, so the balance length corresponds to the emf itself (${emf.toFixed(2)} volt) and no internal resistance can be deduced from a single reading.`,
    result: shunted
      ? `r = R(l₁/l₂ − 1) = ${shunt.toFixed(0)}(${l1.toFixed(1)}/${l2.toFixed(1)} − 1) = ${measured.toFixed(3)} \u03a9. The expected balance length for a ${rInt.toFixed(1)} ohm cell with a ${shunt.toFixed(0)} ohm shunt is ${expectedShuntedL2.toFixed(1)} cm; the reading used was ${l2.toFixed(1)} cm.`
      : `With the shunt open only the emf (${emf.toFixed(2)} V, balance length ${expectedL2.toFixed(1)} cm) is measured. Close the shunt key to obtain r.`,
    issues: shunted && Math.abs(l2 - expectedShuntedL2) > 1.5
      ? [{ field: 'l2', severity: 'warning', message: `l₂ = ${l2.toFixed(1)} cm does not match the ${expectedShuntedL2.toFixed(1)} cm expected for this cell and shunt. Move the jockey there.`}]
      : []
  };
}

function Stage({ params, set, control }: StageApi) {
  const emf = num(params, 'emf', 1.5);
  const rInt = num(params, 'rInt', 2);
  const driver = num(params, 'driver', 4);
  const l1 = num(params, 'l1', 75);
  const l2 = num(params, 'l2', 60);
  const shunt = num(params, 'shunt', 10);
  const shunted = Boolean(params.shunted ?? true);
  const wireOk = driver > emf;
  const active = shunted ? l2 : l1;
  const current = shunted ? emf / (shunt + rInt) : 0;

  return (
    <svg viewBox="0 0 900 500" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={450} y={34} textAnchor="middle" fontSize={14} fill="#eaf1f8" fontWeight={600}>
        Potentiometer · internal resistance of a cell
      </text>
      <MetreBridgeWire x={120} y={292} length={620} jockeyCm={active} live={wireOk} showScale />
      <text x={430} y={264} textAnchor="middle" fontSize={11} fill="#ffc65c" fontFamily="ui-monospace, monospace">
        jockey at {active.toFixed(1)} cm
      </text>
      <BatteryCell x={70} y={400} emf={driver} live={wireOk} label="driver" />
      <text x={70} y={436} textAnchor="middle" fontSize={9} fill="#8497ad">{driver.toFixed(1)} V</text>
      <BatteryCell x={170} y={400} emf={emf} live={shunted} label="cell" />
      <text x={170} y={436} textAnchor="middle" fontSize={9} fill="#8497ad">{emf.toFixed(2)} V</text>
      <Resistor x={300} y={400} value={shunt >= 1000 ? `${(shunt / 1000).toFixed(1)} k\u03a9` : `${shunt.toFixed(0)} \u03a9`} label="R" live={shunted} />
      <Switch x={430} y={400} closed={shunted} live={shunted} label="K\u2082" />
      <MeterFace x={560} y={400} scale={0.55} deflection={0} symbol="G" zeroCentre value="null" />
      <text x={560} y={452} textAnchor="middle" fontSize={9} fill="#45d68b">null deflection</text>
      <g transform="translate(730 400)">
        <rect x={-96} y={-52} width={192} height={104} rx={8} fill="#0d1621" stroke="#2b3c4f" />
        <text y={-30} textAnchor="middle" fontSize={10} fill="#8497ad">open circuit l₁ = {l1.toFixed(1)} cm</text>
        <text y={-12} textAnchor="middle" fontSize={10} fill="#8497ad">shunted l₂ = {l2.toFixed(1)} cm</text>
        <text y={12} textAnchor="middle" fontSize={14} fill="#25d0ee" fontFamily="ui-monospace, monospace">
          r = {(shunt * (l1 / l2 - 1)).toFixed(3)} Ω
        </text>
        <text y={34} textAnchor="middle" fontSize={9.5} fill="#8497ad">I = {(current * 1000).toFixed(1)} mA</text>
      </g>
      <text x={450} y={476} textAnchor="middle" fontSize={11} fill="#5e7189">
        driver {driver.toFixed(1)} V across the wire · test cell compared at null deflection · shunt {shunt.toFixed(0)} Ω
      </text>
{/* The jockey is the control: which balance length it sets depends on the shunt key. */}
      <DragX
        spec={control(shunted ? 'l2' : 'l1', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={120}
        y={334}
        length={620}
        mapping={{ toValue: (dx) => (dx / 620) * 100, invert: (cm) => 120 + (cm / 100) * 620 }}
        label={shunted ? 'Balance length l₂ — drag the jockey' : 'Balance length l₁ — drag the jockey'}
      />
      <Knob
        spec={control('shunt', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={70}
        y={330}
        radius={18}
        label="Shunt resistance R — turn the box"
      />
      <StageSwitch
        spec={control('shunted', 'toggle')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={430}
        y={360}
        label="Shunt key K₂"
      />
        </svg>
  );
}

export default function InternalResistanceExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const l1 = num(p, 'l1', 75);
        const l2 = num(p, 'l2', 60);
        const shunt = num(p, 'shunt', 10);
        const rInt = num(p, 'rInt', 2);
        return {
          title: 'Observation table — internal resistance',
          columns: [
            { key: 'n', label: 'Reading', unit: '—', precision: 0 },
            { key: 'shunt', label: 'R', unit: 'Ω', precision: 1 },
            { key: 'l1', label: 'l₁', unit: 'cm', precision: 1 },
            { key: 'l2', label: 'l₂', unit: 'cm', precision: 1 },
            { key: 'r', label: 'r', unit: 'Ω', precision: 3, derived: true }
          ],
          capture: () => ({ n: 1, shunt, l1, l2, r: 0 }),
          derive: (row) => ({ ...row, r: Number(row.shunt) * (Number(row.l1) / Number(row.l2) - 1) }),
          comparison: { label: 'internal resistance', unit: 'Ω', experimental: internalResistanceFromPotentiometer(l1, l2, shunt), theoretical: rInt, precision: 3 },
          captureEnabled: Boolean(p.shunted),
          captureHint: 'Close the shunt key K₂ to record a balance length.'
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
