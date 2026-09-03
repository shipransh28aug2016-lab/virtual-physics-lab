import type { EducationPack, ExperimentDefinition, ParamValues, ValidationIssue } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill } from '@/components/shell/Viewport';
import { SeriesLoop, ResistanceBox, VoltmeterBranch } from '@/components/instruments/CircuitBoard';
import { loopCurrent, terminalVoltage } from '@/physics-engine/circuits';
import { mergeIssues, validateResistance, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, bool, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './ohms-law.meta';

export { meta };

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
    { kind: 'toggle', key: 'closed', label: 'Key K closed', initial: true, hint: 'Open the key to break the circuit', onStage: true }
  ],
  defaults: { emf: 6, rInt: 0.5, load: 20, rheostat: 10, closed: true }
};

const education: EducationPack = {
  theory: [
    'Ohm’s law states that the current through a conductor is directly proportional to the potential difference across its ends, provided the physical conditions such as temperature remain unchanged. The constant of proportionality is the resistance of the conductor.',
    'In a real cell the emf is not the voltage available to the circuit. Part of it is spent driving current through the internal resistance, so the terminal voltage is always less than the emf while current flows. The gap between them grows with the current.',
    'A rheostat in series lets you sweep the current without changing the cell. Plotting the voltmeter reading against the ammeter reading gives a straight line through the origin for an ohmic conductor, and its slope is the reciprocal of the resistance.'
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
    'Close the key and set the rheostat to its maximum so the current starts small.',
    'Note the ammeter and voltmeter readings and press Record reading.',
    'Reduce the rheostat in steps, recording at least six pairs of readings.',
    'Plot V against I; the graph should be a straight line through the origin.',
    'Find the slope of the line — its reciprocal is the resistance of the conductor.',
    'Open the key and confirm that both meters return to zero.'
  ],
  precautions: [
    'Pass current only briefly; continuous heating changes the resistance and ruins the linearity.',
    'Check the zero error of both meters before starting.',
    'Connect the ammeter in series and the voltmeter in parallel — reversing them damages the instruments.',
    'Keep the rheostat at maximum before closing the key.'
  ],
  sourcesOfError: [
    'Heating of the wire raises its resistance and bends the graph at high current.',
    'Contact resistance at the terminals and plug keys.',
    'Finite resistance of the ammeter and finite loading by the voltmeter.'
  ],
  tips: [
    'Set r = 0 to model an ideal cell: the terminal voltage then stays equal to the emf.',
    'Sweep the load from 1 Ω to 100 Ω and watch the current saturate — the internal resistance dominates at low load.'
  ],
  viva: [
    { q: 'State Ohm’s law.', a: 'At constant temperature the current through a conductor is directly proportional to the potential difference across its ends, V = IR.' },
    { q: 'Why is the terminal voltage of a cell less than its emf when current flows?', a: 'Because part of the emf is dropped across the internal resistance: V = ε − Ir.' },
    { q: 'Is Ohm’s law a universal law?', a: 'No. Diodes, transistors, electrolytes and filament lamps are non-ohmic; their V–I graphs are not straight lines.' },
    { q: 'Why is the ammeter connected in series and the voltmeter in parallel?', a: 'The ammeter must carry the same current as the load, so it has very low resistance; the voltmeter must not draw current, so it has very high resistance.' },
    { q: 'What is the resistance of an ideal ammeter and an ideal voltmeter?', a: 'Zero and infinity respectively.' }
  ],
  resultTemplate:
    'The V–I graph is a straight line through the origin, so the conductor obeys Ohm’s law and its resistance equals the reciprocal of the slope.'
};

function compute(params: ParamValues): ModelOutput {
  const emf = num(params, 'emf', 6);
  const rInt = num(params, 'rInt', 0.5);
  const load = num(params, 'load', 20);
  const rheostat = num(params, 'rheostat', 10);
  const closed = bool(params, 'closed', true);

  const total = load + rheostat;
  const cell = { emf, internalResistance: rInt };
  const current = closed ? loopCurrent(cell, total) : 0;
  const vLoad = current * load;
  const vTerm = terminalVoltage(cell, current);
  const power = current * current * load;

  const issues: ValidationIssue[] = mergeIssues(
    validateResistance('load', load),
    validateRange('emf', 'Battery emf', emf, 0, 12),
    validateRange('rInt', 'Internal resistance', rInt, 0, 5)
  );
  if (current > 0.8) {
    issues.push({
      field: 'load',
      severity: 'warning',
      message: 'Current above 0.8 A would heat the wire and make the resistance drift in a real bench setup.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let i = 1; i <= 40; i += 1) {
    const v = (emf * i) / 40;
    points.push({ x: v, y: v / Math.max(load, 1e-6) });
  }

  return {
    readouts: [
      ro('i', 'Current I', current, 'A', 4),
      ro('v', 'Voltage across R', vLoad, 'V', 3),
      ro('vt', 'Terminal voltage', vTerm, 'V', 3),
      ro('r', 'Total resistance', total + rInt, 'Ω', 2),
      ro('p', 'Power in R', power, 'W', 3),
      ro('lost', 'Lost in cell', current * current * rInt, 'W', 3, { tone: current * rInt > 0.3 ? 'alert' : 'normal' })
    ],
    graph: singleSeriesGraph({
      title: 'Current against potential difference across the load',
      xLabel: 'V (V)',
      yLabel: 'I (A)',
      seriesLabel: 'I = V / R',
      points,
      live: { x: vLoad, y: current },
      markers: current > 0 ? [{ x: vLoad, y: current, label: `slope = 1/${load.toFixed(1)} Ω`, color: '#ffc65c' }] : []
    }),
    description: `A cell of emf ${emf.toFixed(1)} volts and internal resistance ${rInt.toFixed(2)} ohm drives a current of ${current.toFixed(4)} ampere through a total external resistance of ${total.toFixed(1)} ohm. The key is ${closed ? 'closed' : 'open'}.`,
    result: `With the key ${closed ? 'closed' : 'open'}, the circuit carries ${current.toFixed(4)} A. The potential difference across the ${load.toFixed(1)} Ω load is ${vLoad.toFixed(3)} V, so V/I = ${(current > 0 ? vLoad / current : load).toFixed(2)} Ω, equal to the resistance as expected from Ohm’s law.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const emf = num(params, 'emf', 6);
  const rInt = num(params, 'rInt', 0.5);
  const load = num(params, 'load', 20);
  const rheostat = num(params, 'rheostat', 10);
  const closed = bool(params, 'closed', true);
  const current = closed ? loopCurrent({ emf, internalResistance: rInt }, load + rheostat) : 0;
  const vLoad = current * load;
  return (
    <SeriesLoop
      emf={emf}
      current={current}
      terminalV={emf - current * rInt}
      rheostatFraction={Math.min(rheostat / 50, 1)}
      closed={closed}
      extraLead={
        <>
          <ResistanceBox x={400} y={350} value={load} label="R" live={current > 0} />
<VoltmeterBranch x={400} y={300} voltage={vLoad} span={150} />
          {/* The rheostat dial and the key are part of the circuit on the board. */}
          {/* Every control lives on the apparatus, in the clear top margin. */}
          <Knob
            spec={control('emf', 'slider')}
            params={params}
            onChange={(key, value) => set(key, value)}
            x={120}
            y={62}
            radius={20}
            label="Battery emf — turn the dial"
          />
          <Knob
            spec={control('rInt', 'slider')}
            params={params}
            onChange={(key, value) => set(key, value)}
            x={250}
            y={62}
            radius={18}
            label="Internal resistance r — turn the dial"
          />
          <Knob
            spec={control('load', 'slider')}
            params={params}
            onChange={(key, value) => set(key, value)}
            x={380}
            y={62}
            radius={20}
            label="Load resistance R — turn the dial"
          />
          <Knob
            spec={control('rheostat', 'slider')}
            params={params}
            onChange={(key, value) => set(key, value)}
            x={510}
            y={62}
            radius={20}
            label="Rheostat R_h — turn the dial"
          />
          <StageSwitch
            spec={control('closed', 'toggle')}
            params={params}
            onChange={(key, value) => set(key, value)}
            x={640}
            y={62}
            label="Key K"
          />
        </>
      }
    />
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
        const emf = num(params, 'emf', 6);
        const rInt = num(params, 'rInt', 0.5);
        const total = num(params, 'load', 20) + num(params, 'rheostat', 10);
        const i = bool(params, 'closed', true) ? loopCurrent({ emf, internalResistance: rInt }, total) : 0;
        return (
          <>
            <ViewPill label="I" value={formatSI(i, 3)} unit="A" />
            <ViewPill label="V" value={(i * num(params, 'load', 20)).toFixed(3)} unit="V" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const emf = num(p, 'emf', 6);
        const rInt = num(p, 'rInt', 0.5);
        const load = num(p, 'load', 20);
        const rheostat = num(p, 'rheostat', 10);
        const i = loopCurrent({ emf, internalResistance: rInt }, load + rheostat);
        return {
          title: 'Observation table — V–I characteristic of the resistor',
          columns: [
            col('rheo', 'Rheostat', 'Ω', 1),
            col('v', 'V', 'V', 3),
            col('i', 'I', 'A', 4),
            col('r', 'R = V/I', 'Ω', 2, true)
          ],
          capture: () => ({ rheo: rheostat, v: i * load, i, r: 0 }),
          derive: (row) => {
            const v = Number(row.v);
            const ii = Number(row.i);
            return { ...row, r: Math.abs(ii) < 1e-12 ? Number.NaN : v / ii };
          },
          captureHint: 'Change the rheostat between readings, then record.'
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
