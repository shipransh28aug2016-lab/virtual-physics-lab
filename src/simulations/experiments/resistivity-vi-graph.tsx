import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill } from '@/components/shell/Viewport';
import { SeriesLoop, ResistanceBox, VoltmeterBranch } from '@/components/instruments/CircuitBoard';
import { loopCurrent, resistivityFromWire, wireResistance } from '@/physics-engine/circuits';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, bool, ro, str, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './resistivity-vi-graph.meta';

export { meta };

/** The three wires supplied with the CBSE kit, with their true resistivities. */
const WIRES = [
  { value: 'constantan', label: 'Constantan', rho: 4.9e-7 },
  { value: 'nichrome', label: 'Nichrome', rho: 1.1e-6 },
  { value: 'manganin', label: 'Manganin', rho: 4.4e-7 }
] as const;

const wireOf = (key: string) => WIRES.find((w) => w.value === key) ?? WIRES[0];

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
  practicalNo: meta.practicalNo,
  thumbLabel: meta.shortTitle,
  accent: '#25d0ee',
  controls: [
    {
      kind: 'segmented',
      key: 'wire',
      label: 'Wire under test',
      initial: 'constantan',
      options: WIRES.map((w) => ({ value: w.value, label: w.label })),
      hint: 'Change the wire and repeat the whole set of readings'
    },
    { kind: 'slider', key: 'length', label: 'Length between clips', symbol: 'L', unit: 'cm', min: 20, max: 100, step: 1, initial: 60, precision: 0, onStage: true },
    { kind: 'slider', key: 'dia', label: 'Wire diameter', symbol: 'd', unit: 'mm', min: 0.2, max: 1.2, step: 0.01, initial: 0.45, precision: 2, hint: 'Measured with a screw gauge', onStage: true },
    { kind: 'slider', key: 'emf', label: 'Battery emf', symbol: '\\varepsilon', unit: 'V', min: 1.5, max: 6, step: 0.5, initial: 3, precision: 1, onStage: true },
    { kind: 'slider', key: 'rheostat', label: 'Rheostat setting', symbol: 'R_h', unit: 'Ω', min: 0.5, max: 40, step: 0.5, initial: 12, precision: 1, hint: 'Sweep this to collect the V–I pairs', onStage: true },
    { kind: 'toggle', key: 'closed', label: 'Key K closed', initial: true, onStage: true }
  ],
  defaults: { wire: 'constantan', length: 60, dia: 0.45, emf: 3, rheostat: 12, closed: true }
};

const education: EducationPack = {
  theory: [
    'For an ohmic conductor at constant temperature the potential difference across it is proportional to the current through it. Plotting V along one axis and I along the other therefore gives a straight line through the origin, and its slope is the resistance of the conductor.',
    'Resistance is not a property of the material alone: it depends on how long and how thick the sample is. Resistivity is the material property that remains once that geometry is divided out, ρ = RA/L, where A is the area of cross-section. Two wires of the same metal but different lengths give different resistances and the same resistivity.',
    'The area of cross-section comes from the diameter measured with a screw gauge, A = πd²/4. Because the diameter is squared, a small error there is the dominant contribution to the error in ρ — measuring the diameter at several places and averaging is what keeps the result honest.',
    'The rheostat is what makes this an experiment rather than a single reading. Sweeping it changes the current without touching the cell or the wire, so a whole set of (V, I) pairs can be collected for the same conductor and the slope taken from the best-fit line rather than from one point.'
  ],
  formulas: [
    { tex: 'V = IR', caption: 'Ohm’s law; the slope of the V–I line is R.' },
    { tex: '\\rho = \\frac{RA}{L}', caption: 'Resistivity from the measured resistance and the geometry.' },
    { tex: 'A = \\frac{\\pi d^2}{4}', caption: 'Area of cross-section from the screw-gauge diameter.' },
    { tex: 'R = \\frac{\\rho L}{A}', caption: 'The same relation solved for the resistance of the wire.' }
  ],
  variables: [
    { symbol: 'V', name: 'Potential difference', unit: 'V' },
    { symbol: 'I', name: 'Current', unit: 'A' },
    { symbol: 'R', name: 'Resistance of the wire', unit: 'Ω' },
    { symbol: 'L', name: 'Length between the clips', unit: 'm' },
    { symbol: 'd', name: 'Diameter of the wire', unit: 'm', note: 'Screw gauge, averaged over several positions' },
    { symbol: 'A', name: 'Area of cross-section', unit: 'm²' },
    { symbol: '\\rho', name: 'Resistivity', unit: 'Ω m' }
  ],
  procedure: [
    'Clip the first wire into the circuit and measure the length between the clips with a metre scale.',
    'Measure the diameter of the wire at three places with a screw gauge and set the mean value.',
    'Set the rheostat to its maximum so the current starts small, then close the key.',
    'Note the ammeter and voltmeter readings and press Record reading.',
    'Reduce the rheostat in steps and record at least six (V, I) pairs.',
    'Plot V against I; the graph is a straight line through the origin whose slope is R.',
    'Compute ρ = RA/L, then repeat the whole set for the second and third wires.'
  ],
  precautions: [
    'Keep the current small and pass it only while taking a reading — a hot wire has a higher resistance and bends the graph.',
    'Take the screw-gauge reading at several places along the wire and average; also correct for its zero error.',
    'Make sure the clips grip clean, straight wire — kinks and oxide add contact resistance.',
    'Connect the ammeter in series and the voltmeter in parallel with the wire, and check both for zero error.'
  ],
  sourcesOfError: [
    'Joule heating raises the resistance during a long set of readings.',
    'Zero error and backlash in the screw gauge, magnified by the squaring of d.',
    'Contact resistance at the clips is counted as part of the wire.',
    'The voltmeter draws a small current, so the ammeter reads slightly more than the wire carries.'
  ],
  tips: [
    'Halve the length and watch the resistance halve while the resistivity stays put — that is the whole point of the experiment.',
    'Switch between the three wires at the same length and diameter: only ρ distinguishes them.'
  ],
  viva: [
    { q: 'Define resistivity.', a: 'The resistance of a conductor of unit length and unit area of cross-section of that material, ρ = RA/L. Its SI unit is the ohm metre.' },
    { q: 'Does resistivity depend on the length of the wire?', a: 'No. Resistance does, but resistivity is a property of the material and its temperature only.' },
    { q: 'Why is a screw gauge used rather than a metre scale for the diameter?', a: 'The diameter is a fraction of a millimetre and it enters as d², so it needs an instrument with a least count of 0.01 mm.' },
    { q: 'Why should the current be kept small?', a: 'A large current heats the wire; its resistance rises with temperature and the V–I graph stops being straight.' },
    { q: 'What does the slope of the V–I graph give?', a: 'The resistance of the conductor between the clips.' },
    { q: 'Why is constantan or manganin used for the wire?', a: 'They have a very small temperature coefficient of resistance, so their resistance hardly changes as the wire warms.' }
  ],
  resultTemplate:
    'The V–I graph is a straight line through the origin, so the wire obeys Ohm’s law; the resistivity computed from its slope and geometry agrees with the accepted value for the material.'
};

function model(params: ParamValues) {
  const wire = wireOf(str(params, 'wire', 'constantan'));
  const lengthM = num(params, 'length', 60) / 100;
  const diaM = num(params, 'dia', 0.45) / 1000;
  const emf = num(params, 'emf', 3);
  const rheostat = num(params, 'rheostat', 12);
  const closed = bool(params, 'closed', true);

  const radius = diaM / 2;
  const area = Math.PI * radius * radius;
  const resistance = wireResistance(wire.rho, lengthM, radius);
  const cell = { emf, internalResistance: 0.4 };
  const current = closed ? loopCurrent(cell, resistance + rheostat) : 0;
  const voltage = current * resistance;

  return { wire, lengthM, diaM, radius, area, resistance, current, voltage, emf, rheostat, closed };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);
  const rho = resistivityFromWire(m.resistance, m.radius, m.lengthM);

  const issues = mergeIssues(
    validatePositive('length', 'Length between the clips', m.lengthM),
    validatePositive('dia', 'Wire diameter', m.diaM),
    validateRange('emf', 'Battery emf', m.emf, 1.5, 6)
  );
  if (m.current > 0.6) {
    issues.push({
      field: 'rheostat',
      severity: 'warning',
      message: 'Above about 0.6 A the wire warms noticeably; its resistance drifts and the V–I graph starts to bend.'
    });
  }

  // The whole V–I line for this wire, swept by the rheostat.
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const rh = 0.5 + (i / 40) * 39.5;
    const iCur = loopCurrent({ emf: m.emf, internalResistance: 0.4 }, m.resistance + rh);
    points.push({ x: iCur, y: iCur * m.resistance });
  }
  points.sort((a, b) => a.x - b.x);

  return {
    readouts: [
      ro('i', 'Current I', m.current, 'A', 4),
      ro('v', 'Voltage V', m.voltage, 'V', 3),
      ro('r', 'Resistance R = V/I', m.resistance, 'Ω', 3),
      ro('a', 'Area A = πd²/4', m.area, 'm²', 3, { sub: `d = ${(m.diaM * 1000).toFixed(2)} mm` }),
      ro('l', 'Length L', m.lengthM, 'm', 3),
      ro('rho', 'Resistivity ρ = RA/L', rho, 'Ω m', 3, { sub: m.wire.label })
    ],
    graph: singleSeriesGraph({
      title: 'Potential difference against current for the wire under test',
      xLabel: 'I (A)',
      yLabel: 'V (V)',
      seriesLabel: 'V = IR',
      points,
      live: m.current > 0 ? { x: m.current, y: m.voltage } : undefined,
      markers: m.current > 0 ? [{ x: m.current, y: m.voltage, label: `slope = ${m.resistance.toFixed(2)} Ω`, color: '#ffc65c' }] : []
    }),
    issues,
    description: `A ${m.wire.label.toLowerCase()} wire ${(m.lengthM * 100).toFixed(0)} centimetre long and ${(m.diaM * 1000).toFixed(2)} millimetre in diameter carries ${m.current.toFixed(4)} ampere with ${m.voltage.toFixed(3)} volt across it. The key is ${m.closed ? 'closed' : 'open'}.`,
    result: `The slope of the V–I line gives R = ${m.resistance.toFixed(3)} Ω for a length of ${(m.lengthM * 100).toFixed(0)} cm and a diameter of ${(m.diaM * 1000).toFixed(2)} mm, so ρ = RA/L = ${formatSI(rho, 3)} Ω m — the accepted value for ${m.wire.label.toLowerCase()} is ${formatSI(m.wire.rho, 3)} Ω m.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  return (
    <SeriesLoop
      emf={m.emf}
      current={m.current}
      terminalV={m.emf - m.current * 0.4}
      rheostatFraction={Math.min(m.rheostat / 40, 1)}
      closed={m.closed}
      extraLead={
        <>
          <ResistanceBox x={400} y={350} value={`${m.resistance.toFixed(2)} Ω`} label="wire under test" live={m.current > 0} />
          <VoltmeterBranch x={400} y={300} voltage={m.voltage} span={150} />
          <text x={400} y={392} textAnchor="middle" fontSize={10} fill="#8497ad">
            {m.wire.label} · L = {(m.lengthM * 100).toFixed(0)} cm · d = {(m.diaM * 1000).toFixed(2)} mm
          </text>

          {/* Every control lives on the apparatus, in the clear top margin. */}
          <Knob spec={control('length', 'slider')} params={params} onChange={set} x={120} y={62} radius={20} label="Length between the clips — turn the dial" />
          <Knob spec={control('dia', 'slider')} params={params} onChange={set} x={250} y={62} radius={18} label="Wire diameter from the screw gauge — turn the dial" />
          <Knob spec={control('emf', 'slider')} params={params} onChange={set} x={380} y={62} radius={20} label="Battery emf — turn the dial" />
          <Knob spec={control('rheostat', 'slider')} params={params} onChange={set} x={510} y={62} radius={20} label="Rheostat — turn the dial to change the current" />
          <StageSwitch spec={control('closed', 'toggle')} params={params} onChange={set} x={640} y={62} label="Key K" />
        </>
      }
    />
  );
}

export default function ResistivityViGraphExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      viewportOverlay={(params) => {
        const m = model(params);
        return (
          <>
            <ViewPill label="I" value={formatSI(m.current, 3)} unit="A" />
            <ViewPill label="V" value={m.voltage.toFixed(3)} unit="V" />
            <ViewPill label="R" value={m.resistance.toFixed(2)} unit="Ω" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        const rho = resistivityFromWire(m.resistance, m.radius, m.lengthM);
        return {
          title: 'Observation table — V–I readings for the wire under test',
          columns: [
            col('rheo', 'Rheostat', 'Ω', 1),
            col('v', 'V', 'V', 3),
            col('i', 'I', 'A', 4),
            col('r', 'R = V/I', 'Ω', 3, true),
            col('rho', 'ρ = RA/L', 'Ω m', 9, true)
          ],
          capture: () => ({ rheo: m.rheostat, v: m.voltage, i: m.current, r: 0, rho: 0 }),
          derive: (row) => {
            const v = Number(row.v);
            const i = Number(row.i);
            const r = Math.abs(i) < 1e-12 ? Number.NaN : v / i;
            return { ...row, r, rho: (r * m.area) / m.lengthM };
          },
          comparison: {
            label: `resistivity of ${m.wire.label.toLowerCase()}`,
            unit: '×10⁻⁷ Ω m',
            experimental: rho * 1e7,
            theoretical: m.wire.rho * 1e7,
            precision: 3
          },
          captureHint: 'Change the rheostat between readings, then record. Repeat the whole table for each wire.'
        };
      }}
    />
  );
}

export { definition, education };
