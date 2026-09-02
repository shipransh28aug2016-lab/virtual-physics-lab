import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { MeterFace, Resistor, BatteryCell, Switch } from '@/components/instruments/Instruments';
import { ammeterShunt, voltmeterMultiplier } from '@/physics-engine/circuits';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './galvanometer-conversion.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'segmented', key: 'mode', label: 'Conversion', initial: 'ammeter', options: [{ value: 'ammeter', label: 'Ammeter (shunt)' }, { value: 'voltmeter', label: 'Voltmeter (multiplier)' }] },
    { kind: 'slider', key: 'g', label: 'Galvanometer resistance', symbol: 'G', unit: '\u03a9', min: 20, max: 200, step: 1, initial: 60 },
    { kind: 'slider', key: 'ig', label: 'Full-scale current', symbol: 'I_g', unit: '\u00b5A', min: 10, max: 1000, step: 10, initial: 100 },
    { kind: 'slider', key: 'range', label: 'Desired ammeter range', symbol: 'I', unit: 'A', min: 0.1, max: 5, step: 0.1, initial: 1, precision: 1, hint: 'Ammeter mode only', disabledIf: (v) => String(v.mode ?? 'ammeter') !== 'ammeter' },
    { kind: 'slider', key: 'vrange', label: 'Desired voltmeter range', symbol: 'V', unit: 'V', min: 1, max: 15, step: 0.5, initial: 5, precision: 1, hint: 'Voltmeter mode only', disabledIf: (v) => String(v.mode ?? 'ammeter') !== 'voltmeter' },
    { kind: 'slider', key: 'measured', label: 'Quantity being measured', symbol: 'X', unit: '', min: 0, max: 5, step: 0.01, initial: 0.4, precision: 2, hint: 'Current in A or voltage in V depending on the mode' }
  ],
  defaults: { mode: 'ammeter', g: 60, ig: 100, range: 1, vrange: 5, measured: 0.4 }
};

const education: EducationPack = {
  theory: [
    'A moving coil galvanometer is a sensitive instrument that gives full-scale deflection for a current of only a few microamperes. It cannot measure large currents or voltages directly, so it is modified.',
    'To make an ammeter a very small resistance called a shunt is connected in parallel with the galvanometer. Most of the current then bypasses the coil, and the combination has a very low resistance so that it does not disturb the circuit it measures.',
    'To make a voltmeter a large resistance called a multiplier is connected in series with the galvanometer. The combination then has a very high resistance and draws only a negligible current from the circuit whose potential difference it measures.'
  ],
  formulas: [
    { tex: 'S = \\frac{I_g G}{I - I_g}', caption: 'Shunt for an ammeter of range I.' },
    { tex: 'R_A = \\frac{SG}{S + G}', caption: 'Resistance of the ammeter.' },
    { tex: 'R_V = \\frac{V}{I_g} - G', caption: 'Multiplier for a voltmeter of range V.' },
    { tex: 'n = \\frac{I}{I_g} = 1 + \\frac{G}{S}', caption: 'Multiplying power of the shunt.' }
  ],
  variables: [
    { symbol: 'G', name: 'Galvanometer resistance', unit: '\u03a9' },
    { symbol: 'I_g', name: 'Full-scale current', unit: 'A' },
    { symbol: 'S', name: 'Shunt resistance', unit: '\u03a9' },
    { symbol: 'R_V', name: 'Multiplier resistance', unit: '\u03a9' },
    { symbol: 'I', name: 'Ammeter range', unit: 'A' },
    { symbol: 'V', name: 'Voltmeter range', unit: 'V' }
  ],
  procedure: [
    'Note the galvanometer resistance G and its full-scale current I_g from the figure of merit.',
    'For an ammeter of range I, calculate the shunt S = I_gG/(I − I_g) and connect it in parallel with the coil.',
    'For a voltmeter of range V, calculate the multiplier R = V/I_g − G and connect it in series with the coil.',
    'Connect the converted meter in a circuit and compare its reading with a standard meter at several settings.'
  ],
  precautions: ['An ammeter is always connected in series and a voltmeter always in parallel.', 'The shunt must be of very low resistance and of low temperature coefficient.', 'Never connect an ammeter directly across a source.', 'Check the polarity before switching on.'],
  tips: ['Increasing the ammeter range reduces the shunt resistance; increasing the voltmeter range increases the multiplier.'],
  viva: [
    { q: 'Why is the shunt connected in parallel?', a: 'So that the excess current bypasses the delicate coil while the coil still carries its full-scale current.' },
    { q: 'Why must an ammeter have low resistance?', a: 'So that inserting it in series does not change the current it is meant to measure.' },
    { q: 'Why must a voltmeter have high resistance?', a: 'So that it draws negligible current and does not lower the potential difference it is measuring.' },
    { q: 'What is the multiplying power of a shunt?', a: 'The factor n = I/I_g by which the range of the galvanometer is increased.' },
    { q: 'How does an ideal ammeter differ from an ideal voltmeter?', a: 'An ideal ammeter has zero resistance and an ideal voltmeter has infinite resistance.' }
  ],
  resultTemplate: 'The galvanometer is converted into an ammeter of range … A using a shunt of … ohm and into a voltmeter of range … V using a multiplier of … ohm.'
};

function compute(params: ParamValues): ModelOutput {
  const mode = String(params.mode ?? 'ammeter') as 'ammeter' | 'voltmeter';
  const g = num(params, 'g', 60);
  const ig = num(params, 'ig', 100) * 1e-6;
  const range = num(params, 'range', 1);
  const vrange = num(params, 'vrange', 5);
  const measured = num(params, 'measured', 0.4);

  const shunt = ammeterShunt(g, ig, range);
  const multiplier = voltmeterMultiplier(g, ig, vrange);
  const ammeterR = (shunt * g) / (shunt + g);
  const voltmeterR = multiplier + g;

  const galCurrent = mode === 'ammeter'
    ? (measured / range) * ig
    : (measured / vrange) * ig;
  const deflection = galCurrent / ig;

  const points: { x: number; y: number }[] = [];
  const span = mode === 'ammeter' ? range : vrange;
  for (let k = 0; k <= 100; k += 1) {
    const x = (k / 100) * span;
    points.push({ x, y: mode === 'ammeter' ? (x / range) * ig * 1e6 : (x / vrange) * ig * 1e6 });
  }

  return {
    readouts: [
      mode === 'ammeter'
        ? ro('s', 'Shunt resistance', shunt, '\u03a9', 5, { sub: formatSI(shunt, 3) })
        : ro('mv', 'Multiplier resistance', multiplier, '\u03a9', 1, { sub: formatSI(multiplier, 3) }),
      ro('mr', mode === 'ammeter' ? 'Ammeter resistance' : 'Voltmeter resistance', mode === 'ammeter' ? ammeterR : voltmeterR, '\u03a9', 4),
      ro('range', 'Meter range', mode === 'ammeter' ? range : vrange, mode === 'ammeter' ? 'A' : 'V', 2),
      ro('x', 'Reading', measured, mode === 'ammeter' ? 'A' : 'V', 3),
      ro('ig2', 'Coil current', galCurrent, 'A', 7, { sub: `${(galCurrent * 1e6).toFixed(1)} \u00b5A` }),
      ro('defl', 'Deflection', deflection, 'fraction', 3, { sub: `${(deflection * 100).toFixed(1)}% of scale`, tone: deflection > 1 ? 'alert' : 'normal' }),
      ro('n', 'Multiplying power', mode === 'ammeter' ? range / ig : voltmeterR / g, '\u2014', 1)
    ],
    graph: {
      title: mode === 'ammeter' ? 'Coil current against measured current' : 'Coil current against measured voltage',
      xLabel: mode === 'ammeter' ? 'I (A)' : 'V (V)',
      yLabel: 'coil current (\u00b5A)',
      series: [{ key: 'c', label: 'I_g', color: '#9d8cff', points }],
      guides: [{ axis: 'y', value: ig * 1e6, label: 'full scale', color: '#ffc65c' }]
    },
    live: { x: Math.min(measured, span), y: Math.min(deflection, 1) * ig * 1e6 },
    description: mode === 'ammeter'
      ? `A shunt of ${formatSI(shunt, 4)} ohm across the ${g.toFixed(0)} ohm coil converts it into an ammeter of range ${range.toFixed(1)} ampere with a total resistance of only ${formatSI(ammeterR, 3)} ohm. At ${measured.toFixed(2)} ampere the coil carries ${(galCurrent * 1e6).toFixed(1)} microampere.`
      : `A multiplier of ${formatSI(multiplier, 3)} ohm in series with the ${g.toFixed(0)} ohm coil converts it into a voltmeter of range ${vrange.toFixed(1)} volt with a total resistance of ${formatSI(voltmeterR, 3)} ohm. At ${measured.toFixed(2)} volt the coil carries ${(galCurrent * 1e6).toFixed(1)} microampere.`,
    result: mode === 'ammeter'
      ? `S = I_gG/(I \u2212 I_g) = ${(ig * 1e6).toFixed(0)} \u00b5A \u00d7 ${g.toFixed(0)} \u03a9 / (${range.toFixed(1)} \u2212 ${ig.toExponential(2)} A) = ${formatSI(shunt, 4)} \u03a9. Ammeter resistance ${formatSI(ammeterR, 3)} \u03a9.`
      : `R = V/I_g \u2212 G = ${vrange.toFixed(1)} V / ${ig.toExponential(2)} A \u2212 ${g.toFixed(0)} \u03a9 = ${formatSI(multiplier, 4)} \u03a9. Voltmeter resistance ${formatSI(voltmeterR, 3)} \u03a9.`,
    issues: deflection > 1
      ? [{ field: 'measured', severity: 'error', message: `The meter is overloaded: ${measured.toFixed(2)} exceeds its ${span.toFixed(2)} range.` }]
      : []
  };
}

function Stage({ params, set, control }: StageApi) {
  const mode = String(params.mode ?? 'ammeter') as 'ammeter' | 'voltmeter';
  const g = num(params, 'g', 60);
  const ig = num(params, 'ig', 100) * 1e-6;
  const range = num(params, 'range', 1);
  const vrange = num(params, 'vrange', 5);
  const measured = num(params, 'measured', 0.4);
  const shunt = ammeterShunt(g, ig, range);
  const multiplier = voltmeterMultiplier(g, ig, vrange);
  const deflection = mode === 'ammeter' ? measured / range : measured / vrange;
  const loop = mode === 'ammeter' ? 'M170 180 H660 V360 H170 Z' : 'M170 180 H660 V360 H170 Z';

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={90} width={780} height={320} rx={14} />
      <path d={loop} fill="none" className="lead lead-live" strokeWidth={2.4} />
      <BatteryCell x={170} y={270} emf={mode === 'ammeter' ? range * 2 : vrange} live label="E" />
      {mode === 'ammeter' ? (
        <>
          <Resistor x={400} y={180} value="load" label="R_L" live />
          <g transform="translate(430 290)">
            <Resistor x={0} y={0} value={`${formatSI(shunt, 3)} Ω`} label="S" live />
          </g>
          <g transform="translate(560 290)">
            <MeterFace scale={0.66} deflection={Math.min(deflection, 1)} symbol="A" zeroCentre value={`${measured.toFixed(2)} A`} />
            <text y={64} textAnchor="middle" fontSize={9.5} fill="#8497ad">shunt in parallel · G = {g.toFixed(0)} Ω</text>
          </g>
          <Switch x={250} y={360} closed live label="K" />
        </>
      ) : (
        <>
          <Resistor x={400} y={180} value="source divider" label="R" live />
          <g transform="translate(430 290)">
            <Resistor x={0} y={0} value={`${formatSI(multiplier, 3)} Ω`} label="R_V" live />
          </g>
          <g transform="translate(560 290)">
            <MeterFace scale={0.66} deflection={Math.min(deflection, 1)} symbol="V" zeroCentre value={`${measured.toFixed(2)} V`} />
            <text y={64} textAnchor="middle" fontSize={9.5} fill="#8497ad">multiplier in series · G = {g.toFixed(0)} Ω</text>
          </g>
          <Switch x={250} y={360} closed live label="K" />
        </>
      )}
      <text x={410} y={118} textAnchor="middle" fontSize={12.5} fill="#eaf1f8" fontWeight={600}>
        {mode === 'ammeter'
          ? `Ammeter · S = ${formatSI(shunt, 4)} Ω · range ${range.toFixed(1)} A`
          : `Voltmeter · R = ${formatSI(multiplier, 3)} Ω · range ${vrange.toFixed(1)} V`}
      </text>
      <text x={410} y={436} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        coil current {((Math.min(deflection, 1)) * ig * 1e6).toFixed(1)} µA of {(ig * 1e6).toFixed(0)} µA full scale
      </text>
      <Knob
        spec={control('range', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={130}
        y={428}
        radius={18}
        label="Desired range — turn the selector"
      />
        </svg>
  );
}

export default function GalvanometerConversionExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const mode = String(p.mode ?? 'ammeter');
        const g = num(p, 'g', 60);
        const ig = num(p, 'ig', 100) * 1e-6;
        const range = num(p, 'range', 1);
        const vrange = num(p, 'vrange', 5);
        const measured = num(p, 'measured', 0.4);
        const shunt = ammeterShunt(g, ig, range);
        const multiplier = voltmeterMultiplier(g, ig, vrange);
        return {
          title: `Observation table — conversion to ${mode}`,
          columns: [
            { key: 'x', label: mode === 'ammeter' ? 'I' : 'V', unit: mode === 'ammeter' ? 'A' : 'V', precision: 3 },
            { key: 'aux', label: mode === 'ammeter' ? 'S' : 'R', unit: 'Ω', precision: 4 },
            { key: 'ig', label: 'coil I_g', unit: 'µA', precision: 2, derived: true }
          ],
          capture: () => ({ x: measured, aux: mode === 'ammeter' ? shunt : multiplier, ig: 0 }),
          derive: (row) => ({
            ...row,
            ig: (Number(row.x) / (mode === 'ammeter' ? range : vrange)) * ig * 1e6
          })
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
