import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { MetreBridgeWire, MeterFace, Resistor, BatteryCell, Switch } from '@/components/instruments/Instruments';
import { resistivityFromMetreBridge, metreBridgeBalanceLength, seriesResistance } from '@/physics-engine/circuits';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { DragX, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './meter-bridge-resistivity.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#25d0ee', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'slider', key: 'length', label: 'Length of the test wire', symbol: 'L', unit: 'cm', min: 20, max: 200, step: 1, initial: 100 },
    { kind: 'slider', key: 'dia', label: 'Diameter of the wire', symbol: 'd', unit: 'mm', min: 0.05, max: 1.5, step: 0.01, initial: 0.5, precision: 2 },
    { kind: 'slider', key: 'rhoTrue', label: 'Resistivity of the material', symbol: '\\rho', unit: '\u00b5\u03a9 m', min: 1, max: 120, step: 0.1, initial: 44.1, precision: 1 },
    { kind: 'slider', key: 'known', label: 'Known resistance', symbol: 'S', unit: '\u03a9', min: 0.5, max: 200, step: 1, initial: 100, precision: 0, hint: 'Pick a resistance box value close to the unknown so that the balance point falls between 30 cm and 70 cm.' },
    { kind: 'slider', key: 'balance', label: 'Balance length', symbol: 'l', unit: 'cm', min: 1, max: 99, step: 0.1, initial: 69.2, precision: 1, stage: { x: 3, y: 8, length: 24 } },
    { kind: 'slider', key: 'emf', label: 'Battery emf', symbol: '\\varepsilon', unit: 'V', min: 1, max: 6, step: 0.1, initial: 2, precision: 1 }
  ],
  defaults: { length: 100, dia: 0.5, rhoTrue: 44.1, known: 100, balance: 69.2, emf: 2 }
};

const education: EducationPack = {
  theory: [
    'A metre bridge is a practical form of the Wheatstone bridge in which one of the ratio arms is replaced by a uniform wire one metre long. At balance the galvanometer shows no deflection and the ratio of the two known resistances equals the ratio of the two lengths of the wire.',
    'Because the wire is uniform, its resistance is proportional to its length, so the unknown resistance can be found from the balance length and the known resistance.',
    'Once the resistance is known, the resistivity of the material follows from the measured length and cross-sectional area of the wire.'
  ],
  formulas: [
    { tex: '\\frac{R}{S} = \\frac{l}{100 - l}', caption: 'Balance condition of the metre bridge.' },
    { tex: 'R = S \\frac{l}{100 - l}', caption: 'Unknown resistance.' },
    { tex: '\\rho = \\frac{RA}{L} = \\frac{\\pi d^2 R}{4L}', caption: 'Resistivity of the material.' }
  ],
  variables: [
    { symbol: 'R', name: 'Unknown resistance', unit: '\u03a9' },
    { symbol: 'S', name: 'Known resistance', unit: '\u03a9' },
    { symbol: 'l', name: 'Balance length', unit: 'cm' },
    { symbol: '\\rho', name: 'Resistivity', unit: '\u03a9 m' },
    { symbol: 'd', name: 'Diameter of the wire', unit: 'm' }
  ],
  procedure: [
    'Measure the length of the test wire and its diameter with a screw gauge at several places.',
    'Connect the wire in the left gap and a known resistance in the right gap.',
    'Slide the jockey along the wire until the galvanometer shows null deflection and record the balance length.',
    'Interchange the known and unknown resistances, take the balance length again and use the mean to remove end corrections.',
    'Compute R and then the resistivity from the measured dimensions.'
  ],
  precautions: ['The jockey must be tapped, not dragged, to avoid wearing the wire.', 'Connections must be clean and tight.', 'The known resistance should be chosen so that the balance point lies near the middle of the wire.', 'Do not keep the key closed for long, as heating changes the resistance.'],
  tips: ['If the balance point is very close to one end, change the known resistance to bring it near 50 cm.'],
  viva: [
    { q: 'On what principle does the metre bridge work?', a: 'The Wheatstone bridge balance condition, P/Q = R/S.' },
    { q: 'Why should the balance point be near the middle?', a: 'Because the bridge is most sensitive there and the percentage error in the length is smallest.' },
    { q: 'Why are the known and unknown resistances interchanged?', a: 'To cancel the end corrections of the wire.' },
    { q: 'What is the effect of a non-uniform wire?', a: 'The resistance is no longer proportional to the length, so the balance condition fails.' },
    { q: 'Why is the galvanometer protected by a high resistance at first?', a: 'To limit the current through it while the balance point is being located roughly.' }
  ],
  resultTemplate: 'The resistance of the given wire is R = … ohm and the resistivity of its material is ρ = … ohm metre.'
};

function compute(params: ParamValues): ModelOutput {
  const length = num(params, 'length', 100) / 100;
  const dia = num(params, 'dia', 0.3) / 1000;
  const rhoTrue = num(params, 'rhoTrue', 10.6) * 1e-6; // µΩ·m → Ω·m
  const known = num(params, 'known', 2);
  const balance = num(params, 'balance', 30);
  const emf = num(params, 'emf', 2);

  const area = (Math.PI * dia * dia) / 4;
  const trueR = (rhoTrue * length) / area;
  const bridge = resistivityFromMetreBridge(known, balance, dia / 2, length);
  const measuredR = bridge.unknownResistance;
  const idealBalance = metreBridgeBalanceLength(known, trueR);
  const rhoMeasured = bridge.resistivity;
  const current = emf / seriesResistance([trueR, known, 5]);

  const points: { x: number; y: number }[] = [];
  for (let l = 1; l <= 99; l += 0.5) points.push({ x: l, y: resistivityFromMetreBridge(known, l, dia / 2, length).unknownResistance });

  return {
    readouts: [
      ro('r', 'Resistance from the bridge', measuredR, '\u03a9', 4),
      ro('rt', 'True resistance of the wire', trueR, '\u03a9', 4, { sub: formatSI(trueR, 3) }),
      ro('l', 'Balance length', balance, 'cm', 2),
      ro('le', 'Expected balance length', idealBalance, 'cm', 2, { tone: Math.abs(balance - idealBalance) > 1 ? 'alert' : 'normal' }),
      ro('rho', 'Resistivity measured', rhoMeasured, '\u03a9 m', 10, { sub: formatSI(rhoMeasured, 3) }),
      ro('rhot', 'Resistivity of the material', rhoTrue, '\u03a9 m', 10, { sub: formatSI(rhoTrue, 3) }),
      ro('a', 'Cross-sectional area', area * 1e6, 'mm²', 4, { sub: `\u03c0d²/4, d = ${(dia * 1000).toFixed(2)} mm` }),
      ro('i', 'Bridge current', current, 'A', 5)
    ],
    graph: {
      title: 'Unknown resistance against the balance length',
      xLabel: 'l (cm)', yLabel: 'R (Ω)',
      series: [{ key: 'r', label: 'R', color: '#25d0ee', points }]
    },
    live: { x: balance, y: measuredR },
    description: `A balance length of ${balance.toFixed(1)} cm against a known ${known.toFixed(1)} ohm gives R = ${measuredR.toFixed(3)} ohm. For a wire ${(length * 100).toFixed(0)} cm long and ${(dia * 1000).toFixed(2)} mm in diameter this corresponds to a resistivity of ${formatSI(rhoMeasured, 3)} ohm metre.`,
    result: `R = S\u00b7l/(100\u2212l) = ${known.toFixed(1)} \u00d7 ${balance.toFixed(1)}/${(100 - balance).toFixed(1)} = ${measuredR.toFixed(4)} \u03a9. \u03c1 = \u03c0d²R/4L = ${formatSI(rhoMeasured, 4)} \u03a9 m (material value ${formatSI(rhoTrue, 4)} \u03a9 m).`,
    issues: Math.abs(balance - idealBalance) > 1
      ? [{ field: 'balance', severity: 'warning', message: `For this wire the null point should be at ${idealBalance.toFixed(1)} cm, not ${balance.toFixed(1)} cm.` }]
      : []
  };
}

function Stage({ params, set, control }: StageApi) {
  const length = num(params, 'length', 100) / 100;
  const dia = num(params, 'dia', 0.3) / 1000;
  const known = num(params, 'known', 2);
  const balance = num(params, 'balance', 30);
  const emf = num(params, 'emf', 2);
  const measuredR = resistivityFromMetreBridge(known, balance, dia / 2, length).unknownResistance;

  return (
    <svg viewBox="0 0 900 460" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={450} y={34} textAnchor="middle" fontSize={14} fill="#eaf1f8" fontWeight={600}>
        Metre bridge · resistance and resistivity of a wire
      </text>
      <MetreBridgeWire x={130} y={250} length={640} jockeyCm={balance} live showScale />
      <text x={130 + (balance / 100) * 640} y={212} textAnchor="middle" fontSize={11} fill="#ffc65c" fontFamily="ui-monospace, monospace">
        l = {balance.toFixed(1)} cm
      </text>
      {/* The jockey is the control: drag it along the wire to find the null. */}
      <DragX
        spec={control('balance', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={130}
        y={292}
        length={640}
        mapping={{ toValue: (dx) => (dx / 640) * 100, invert: (cm) => 130 + (cm / 100) * 640 }}
        label="Jockey position l — drag along the wire"
      />
      <g transform="translate(150 360)">
        <Resistor x={0} y={0} value={`${measuredR.toFixed(2)} Ω`} label="R" live />
        <text y={40} textAnchor="middle" fontSize={9} fill="#8497ad">test wire</text>
      </g>
      <g transform="translate(760 360)">
        <Resistor x={0} y={0} value={`${known.toFixed(1)} Ω`} label="S" live />
        <text y={40} textAnchor="middle" fontSize={9} fill="#8497ad">known</text>
      </g>
      {/* The resistance box dial sets the known arm. */}
      <Knob
        spec={control('known', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={790}
        y={170}
        radius={19}
        label="Known resistance S — turn the resistance box"
      />
      <BatteryCell x={320} y={360} emf={emf} live label="E" />
      <Switch x={440} y={360} closed live label="K" />
      <MeterFace x={560} y={360} scale={0.55} deflection={0} symbol="G" zeroCentre value="null" />
      <text x={450} y={432} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        R/S = l/(100−l) → {measuredR.toFixed(3)}/{known.toFixed(1)} = {(balance / (100 - balance)).toFixed(4)} · wire {(length * 100).toFixed(0)} cm × {(dia * 1000).toFixed(2)} mm
      </text>
    </svg>
  );
}

export default function MeterBridgeResistivityExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const length = num(p, 'length', 100) / 100;
        const dia = num(p, 'dia', 0.3) / 1000;
        const known = num(p, 'known', 2);
        const balance = num(p, 'balance', 30);
        const rhoTrue = num(p, 'rhoTrue', 10.6) * 1e-6;
        const area = (Math.PI * dia * dia) / 4;
        const measuredR = resistivityFromMetreBridge(known, balance, dia / 2, length).unknownResistance;
        return {
          title: 'Observation table — metre bridge',
          columns: [
            { key: 'n', label: 'Reading', unit: '—', precision: 0 },
            { key: 's', label: 'S', unit: 'Ω', precision: 2 },
            { key: 'l', label: 'l', unit: 'cm', precision: 2 },
            { key: 'r', label: 'R', unit: 'Ω', precision: 4, derived: true },
            { key: 'rho', label: 'ρ', unit: 'Ω m', precision: 10, derived: true }
          ],
          capture: () => ({ n: 1, s: known, l: balance, r: 0, rho: 0 }),
          derive: (row) => {
            const r = Number(row.s) * (Number(row.l) / (100 - Number(row.l)));
            return { ...row, r, rho: (r * area) / length };
          },
          comparison: { label: 'resistivity', unit: 'Ω m', experimental: (measuredR * area) / length, theoretical: rhoTrue, precision: 10 }
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
