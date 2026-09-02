import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BatteryCell, MeterFace, Resistor, Switch } from '@/components/instruments/Instruments';
import { galvanometerFigureOfMerit, galvanometerResistanceHalfDeflection } from '@/physics-engine/circuits';
import { num, ro } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './galvanometer-half-deflection.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'slider', key: 'emf', label: 'Battery emf', symbol: '\\varepsilon', unit: 'V', min: 1, max: 6, step: 0.1, initial: 3, precision: 1 },
    { kind: 'slider', key: 'seriesR', label: 'High resistance in series', symbol: 'R', unit: '\u03a9', min: 1000, max: 20000, step: 500, initial: 10000 },
    { kind: 'slider', key: 'shunt', label: 'Shunt across the galvanometer', symbol: 'S', unit: '\u03a9', min: 5, max: 500, step: 1, initial: 55 },
    { kind: 'slider', key: 'divisions', label: 'Full-scale deflection', symbol: 'n', unit: 'div', min: 10, max: 60, step: 1, initial: 30 },
    { kind: 'slider', key: 'trueG', label: 'True galvanometer resistance', symbol: 'G', unit: '\u03a9', min: 20, max: 200, step: 1, initial: 60 },
    { kind: 'toggle', key: 'shuntClosed', label: 'Shunt key closed', initial: false, hint: 'Close after full-scale deflection is set, then adjust S for half deflection' }
  ],
  defaults: { emf: 3, seriesR: 10000, shunt: 55, divisions: 30, trueG: 60, shuntClosed: false }
};

const education: EducationPack = {
  theory: [
    'A moving coil galvanometer has a coil resistance G and gives full-scale deflection for a small current. To measure G without a second meter, a high resistance R is placed in series so that a known small current produces full-scale deflection.',
    'A variable shunt S is then connected across the galvanometer and adjusted until the deflection falls to exactly half. At that setting the shunt carries the same current as the galvanometer, so the two resistances are related by G = RS/(R − S).',
    'The figure of merit is the current needed for one division of deflection. A galvanometer with a small figure of merit is more sensitive because less current is required to move the pointer.'
  ],
  formulas: [
    { tex: 'G = \\frac{RS}{R - S}', caption: 'Half-deflection relation.' },
    { tex: 'I_g = \\frac{\\varepsilon}{R + G}', caption: 'Current for full-scale deflection.' },
    { tex: 'k = \\frac{I_g}{n}', caption: 'Figure of merit, current per division.' },
    { tex: 'S = \\frac{G}{2} \\text{ when } R \\gg G', caption: 'Approximate shunt for half deflection.' }
  ],
  variables: [
    { symbol: 'G', name: 'Galvanometer resistance', unit: '\u03a9' },
    { symbol: 'R', name: 'Series resistance', unit: '\u03a9' },
    { symbol: 'S', name: 'Shunt resistance', unit: '\u03a9' },
    { symbol: 'n', name: 'Number of divisions', unit: 'div' },
    { symbol: 'k', name: 'Figure of merit', unit: 'A/div' }
  ],
  procedure: [
    'Connect the battery, high resistance R and galvanometer in series with a key.',
    'Adjust R until the galvanometer shows full-scale deflection n and record R.',
    'Without changing R, connect the shunt S across the galvanometer and adjust it for exactly half deflection n/2.',
    'Record S and compute G = RS/(R − S).',
    'Repeat with different values of R and take the mean; then compute the figure of merit k = I_g/n.'
  ],
  precautions: ['R must be much larger than G, otherwise the approximation G = RS/(R − S) breaks down.', 'The battery emf must remain constant throughout.', 'Do not exceed the full-scale current of the galvanometer.', 'Make connections tight and check polarity before switching on.'],
  tips: ['If the deflection is barely reduced by the shunt, S is too large; reduce it until the pointer sits at exactly n/2.'],
  viva: [
    { q: 'Why is a high resistance used in series?', a: 'To limit the current so that full-scale deflection is obtained without damaging the coil, and so that R ≫ G makes the half-deflection relation accurate.' },
    { q: 'What is the figure of merit?', a: 'The current required to produce one division of deflection, k = I_g/n.' },
    { q: 'Why is the deflection halved rather than reduced to some other fraction?', a: 'Because at exactly half deflection the shunt current equals the galvanometer current, which gives the simple relation G = RS/(R − S).' },
    { q: 'Why is the measured G slightly less than the true value?', a: 'Because adding the shunt lowers the total resistance of the circuit and increases the total current, so the assumption of constant current is only approximate.' }
  ],
  resultTemplate: 'The resistance of the given galvanometer is G = … ohm and its figure of merit is k = … ampere per division.'
};

function compute(params: ParamValues): ModelOutput {
  const emf = num(params, 'emf', 3);
  const seriesR = num(params, 'seriesR', 10000);
  const shunt = num(params, 'shunt', 55);
  const divisions = num(params, 'divisions', 30);
  const trueG = num(params, 'trueG', 60);
  const shuntClosed = Boolean(params.shuntClosed);

  const ig = emf / (seriesR + trueG);
  const shuntCurrent = ig * (trueG / (trueG + shunt));
  const galCurrent = ig - shuntCurrent;
  const deflection = shuntClosed ? galCurrent / ig : 1;
  const measuredG = galvanometerResistanceHalfDeflection(seriesR, shunt);
  const idealShunt = (trueG * seriesR) / (seriesR + trueG);
  const fom = galvanometerFigureOfMerit(emf, seriesR + trueG, divisions);

  const points: { x: number; y: number }[] = [];
  for (let s = 5; s <= Math.min(seriesR * 0.5, 500); s += 2) {
    const sc = ig * (trueG / (trueG + s));
    points.push({ x: s, y: (1 - sc / ig) * divisions });
  }

  return {
    readouts: [
      ro('g', 'Measured G', measuredG, '\u03a9', 2),
      ro('gt', 'True G', trueG, '\u03a9', 1, { sub: 'instrument value' }),
      ro('defl', 'Deflection', deflection * divisions, 'div', 1, { sub: shuntClosed ? 'should read n/2' : 'full scale n', tone: shuntClosed && Math.abs(deflection * divisions - divisions / 2) > 1 ? 'alert' : 'normal' }),
      ro('idealS', 'Shunt for exact half', idealShunt, '\u03a9', 1, { tone: shuntClosed ? (Math.abs(shunt - idealShunt) < 1 ? 'normal' : 'alert') : 'dim' }),
      ro('ig', 'Full-scale current', ig, 'A', 6, { sub: `${(ig * 1e6).toFixed(1)} \u00b5A` }),
      ro('fom', 'Figure of merit', fom, 'A/div', 7, { sub: `${(fom * 1e6).toFixed(2)} \u00b5A/div` }),
      ro('n', 'Divisions', divisions, 'div', 0)
    ],
    graph: {
      title: 'Deflection against shunt resistance',
      xLabel: 'Shunt S (\u03a9)', yLabel: 'deflection (div)',
      series: [{ key: 'd', label: 'deflection', color: '#9d8cff', points }],
      markers: [{ x: idealShunt, y: divisions / 2, label: 'n/2', color: '#ffc65c' }],
      guides: [{ axis: 'y', value: divisions / 2, label: 'n/2', color: '#ffc65c' }]
    },
    live: { x: shunt, y: deflection * divisions },
    description: shuntClosed
      ? `With S = ${shunt.toFixed(0)} ohm the deflection is ${(deflection * divisions).toFixed(1)} divisions out of ${divisions.toFixed(0)}. For exact half deflection the shunt should read ${idealShunt.toFixed(1)} ohm, which would give G = ${galvanometerResistanceHalfDeflection(seriesR, idealShunt).toFixed(2)} ohm.`
      : `With no shunt the galvanometer shows full-scale deflection of ${divisions.toFixed(0)} divisions at ${ig.toFixed(2)} microampere. Close the shunt key and adjust S for exactly half of that.`,
    result: `G = RS/(R \u2212 S) = ${seriesR.toFixed(0)} \u00d7 ${shunt.toFixed(0)}/(${seriesR.toFixed(0)} \u2212 ${shunt.toFixed(0)}) = ${measuredG.toFixed(2)} \u03a9 (true value ${trueG.toFixed(0)} \u03a9). Figure of merit k = ${ig.toFixed(3)} \u00b5A / ${divisions.toFixed(0)} div = ${(fom * 1e6).toFixed(2)} \u00b5A/div.`,
    issues: shuntClosed && Math.abs(shunt - idealShunt) > 1
      ? [{ field: 'shunt', severity: 'warning', message: `The deflection is ${(deflection * divisions).toFixed(1)} div, not ${(divisions / 2).toFixed(0)} div. Set the shunt to ${idealShunt.toFixed(1)} \u03a9 for half deflection.` }]
      : []
  };
}

function Stage({ params, set, control }: StageApi) {
  const emf = num(params, 'emf', 3);
  const seriesR = num(params, 'seriesR', 10000);
  const shunt = num(params, 'shunt', 55);
  const divisions = num(params, 'divisions', 30);
  const trueG = num(params, 'trueG', 60);
  const shuntClosed = Boolean(params.shuntClosed);
  const ig = emf / (seriesR + trueG);
  const deflection = shuntClosed ? 1 - trueG / (trueG + shunt) : 1;
  const loop = 'M180 170 H640 V360 H180 Z';

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={90} width={780} height={320} rx={14} />
      <path d={loop} fill="none" className="lead lead-live" strokeWidth={2.4} />
      <BatteryCell x={180} y={265} emf={emf} live label="E" />
      <Resistor x={400} y={170} value={`${(seriesR / 1000).toFixed(1)} kΩ`} label="R" live />
      <Resistor x={640} y={265} value={`${shunt.toFixed(0)} Ω`} label="S" live={shuntClosed} />
      <Switch x={640} y={200} closed={shuntClosed} live={shuntClosed} label="K₂" />
      <Switch x={300} y={360} closed live label="K₁" />
      <g transform="translate(430 265)">
        <MeterFace scale={0.72} deflection={deflection} symbol="G" zeroCentre value={`${(deflection * divisions).toFixed(1)} div`} />
        <text y={62} textAnchor="middle" fontSize={9.5} fill="#8497ad">
          {shuntClosed ? 'adjust S for n/2' : 'full-scale deflection n'}
        </text>
      </g>
      <text x={410} y={118} textAnchor="middle" fontSize={12.5} fill="#eaf1f8" fontWeight={600}>
        Half-deflection method · G = {galvanometerResistanceHalfDeflection(seriesR, shunt).toFixed(2)} Ω
      </text>
      <text x={410} y={436} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        R = {seriesR.toFixed(0)} Ω ≫ G = {trueG.toFixed(0)} Ω · full-scale current {(ig * 1e6).toFixed(2)} µA · n = {divisions.toFixed(0)} div
      </text>
      {/* The shunt box and its key sit on the bench beside the galvanometer. */}
      <Knob
        spec={control('shunt', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={640}
        y={330}
        radius={18}
        label="Shunt resistance S — turn the box"
      />
      <StageSwitch
        spec={control('shuntClosed', 'toggle')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={540}
        y={200}
        label="Shunt key K₂"
      />
        </svg>
  );
}

export default function GalvanometerHalfDeflectionExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const seriesR = num(p, 'seriesR', 10000);
        const shunt = num(p, 'shunt', 55);
        const trueG = num(p, 'trueG', 60);
        return {
          title: 'Observation table — half-deflection method',
          columns: [
            { key: 'n', label: 'Reading', unit: '—', precision: 0 },
            { key: 'r', label: 'R', unit: 'Ω', precision: 0 },
            { key: 's', label: 'S', unit: 'Ω', precision: 1 },
            { key: 'g', label: 'G', unit: 'Ω', precision: 2, derived: true }
          ],
          capture: () => ({ n: 1, r: seriesR, s: shunt, g: 0 }),
          derive: (row) => ({ ...row, g: galvanometerResistanceHalfDeflection(Number(row.r), Number(row.s)) }),
          comparison: { label: 'galvanometer resistance', unit: 'Ω', experimental: galvanometerResistanceHalfDeflection(seriesR, shunt), theoretical: trueG, precision: 2 },
          captureEnabled: Boolean(p.shuntClosed),
          captureHint: 'Close the shunt key K₂ and set half deflection before recording.'
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
