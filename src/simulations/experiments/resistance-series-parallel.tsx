import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import { BatteryCell, MeterFace, MetreBridgeWire, Resistor, Switch } from '@/components/instruments/Instruments';
import { metreBridgeBalanceLength, parallelResistance, seriesResistance } from '@/physics-engine/circuits';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { col, num, ro, str, singleSeriesGraph } from './_shared';
import { DragX, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './resistance-series-parallel.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  practicalNo: meta.practicalNo, thumbLabel: meta.shortTitle, accent: '#45d68b',
  controls: [
    {
      kind: 'segmented', key: 'mode', label: 'Combination in the left gap', initial: 'series',
      options: [
        { value: 'r1', label: 'R₁ alone' },
        { value: 'r2', label: 'R₂ alone' },
        { value: 'series', label: 'R₁ + R₂ in series' },
        { value: 'parallel', label: 'R₁ ∥ R₂ in parallel' }
      ],
      hint: 'Measure each coil alone first, then the two combinations'
    },
    { kind: 'slider', key: 'r1', label: 'First coil', symbol: 'R_1', unit: 'Ω', min: 1, max: 12, step: 0.1, initial: 4, precision: 1, onStage: true },
    { kind: 'slider', key: 'r2', label: 'Second coil', symbol: 'R_2', unit: 'Ω', min: 1, max: 12, step: 0.1, initial: 6, precision: 1, onStage: true },
    { kind: 'slider', key: 'known', label: 'Resistance box', symbol: 'S', unit: 'Ω', min: 1, max: 20, step: 0.5, initial: 5, precision: 1, onStage: true },
    { kind: 'slider', key: 'balance', label: 'Jockey position', symbol: 'l', unit: 'cm', min: 1, max: 99, step: 0.1, initial: 50, precision: 1, onStage: true, hint: 'Slide until the galvanometer reads zero' }
  ],
  defaults: { mode: 'series', r1: 4, r2: 6, known: 5, balance: 50 }
};

const education: EducationPack = {
  theory: [
    'A metre bridge is a practical Wheatstone bridge in which two of the four arms are the two parts of a uniform one-metre wire. When the galvanometer shows no deflection the bridge is balanced, and the ratio of the unknown to the known resistance equals the ratio of the two lengths of wire on either side of the jockey.',
    'Because the wire is uniform, the resistance of each part is proportional to its length. That is what turns a length measurement, which is easy to make accurately, into a resistance measurement.',
    'Resistances in series carry the same current and their potential differences add, so the equivalent resistance is the sum. In parallel they share the same potential difference and their currents add, so it is the reciprocals that add. Measuring R₁ and R₂ separately and then the two combinations tests both laws with the same apparatus in one sitting.',
    'The parallel combination is always smaller than the smaller of the two resistances, while the series combination is always larger than the larger — a useful sanity check before you trust a balance point.'
  ],
  formulas: [
    { tex: '\\frac{R}{S} = \\frac{l}{100 - l}', caption: 'Balance condition of the metre bridge, l in centimetres.' },
    { tex: 'R_s = R_1 + R_2', caption: 'Law of series combination.' },
    { tex: '\\frac{1}{R_p} = \\frac{1}{R_1} + \\frac{1}{R_2}', caption: 'Law of parallel combination.' },
    { tex: 'R_p = \\frac{R_1 R_2}{R_1 + R_2}', caption: 'The same law for exactly two resistances.' }
  ],
  variables: [
    { symbol: 'R', name: 'Resistance in the left gap', unit: 'Ω' },
    { symbol: 'S', name: 'Known resistance from the box', unit: 'Ω' },
    { symbol: 'l', name: 'Balancing length from the left end', unit: 'cm' },
    { symbol: 'R_s', name: 'Series equivalent', unit: 'Ω' },
    { symbol: 'R_p', name: 'Parallel equivalent', unit: 'Ω' }
  ],
  procedure: [
    'Connect the first coil in the left gap and a suitable known resistance in the right gap.',
    'Slide the jockey along the wire until the galvanometer shows no deflection, and note the balancing length.',
    'Compute R₁ from R/S = l/(100 − l) and record the trial.',
    'Repeat for the second coil alone to obtain R₂.',
    'Join the two coils in series in the left gap, find the new balance point and compute R_s.',
    'Join them in parallel and repeat to obtain R_p.',
    'Compare the measured R_s and R_p with R₁ + R₂ and R₁R₂/(R₁ + R₂).'
  ],
  precautions: [
    'Press the jockey gently and only momentarily — sliding it while pressed scrapes the wire and spoils its uniformity.',
    'Choose the known resistance so that the balance point falls near the middle of the wire, where the fractional error in length is least.',
    'Keep the connecting leads short and their terminals clean; their resistance is counted into the gap.',
    'Do not leave the key closed between readings, or the coils will heat and drift.'
  ],
  sourcesOfError: [
    'End corrections at the two ends of the bridge wire, where the copper strips join it.',
    'Non-uniformity in the cross-section of the wire.',
    'Resistance of the connecting leads and of the terminals added into the gaps.',
    'Heating of the coils if the current is left on.'
  ],
  tips: [
    'Set R₁ = R₂ and note that the parallel combination is exactly half of either coil.',
    'Watch how the balance point crowds towards one end when the known resistance is badly chosen.'
  ],
  viva: [
    { q: 'Why is a metre bridge more accurate near the middle of the wire?', a: 'The fractional error in l/(100 − l) is smallest when l is close to 50 cm, so the error in R is minimised there.' },
    { q: 'State the law of combination of resistances in parallel.', a: 'The reciprocal of the equivalent resistance equals the sum of the reciprocals of the individual resistances.' },
    { q: 'Why must the bridge wire be uniform?', a: 'The method assumes resistance is proportional to length; a varying cross-section breaks that proportionality.' },
    { q: 'What is an end correction?', a: 'A small extra length added to each side to account for the resistance of the copper strips and the soldered joints at the ends of the wire.' },
    { q: 'Can the parallel combination exceed either resistance?', a: 'No. It is always less than the smaller of the two.' }
  ],
  resultTemplate:
    'The measured equivalent resistances agree with R₁ + R₂ in series and with R₁R₂/(R₁ + R₂) in parallel, verifying the laws of combination of resistances.'
};

function model(params: ParamValues) {
  const r1 = num(params, 'r1', 4);
  const r2 = num(params, 'r2', 6);
  const known = num(params, 'known', 5);
  const balance = num(params, 'balance', 50);
  const mode = str(params, 'mode', 'series');

  const trueR =
    mode === 'r1' ? r1 : mode === 'r2' ? r2 : mode === 'series' ? seriesResistance([r1, r2]) : parallelResistance([r1, r2]);
  const idealBalance = metreBridgeBalanceLength(known, trueR);
  const measuredR = (known * balance) / Math.max(100 - balance, 1e-6);
  // The galvanometer deflection is what the bridge imbalance actually produces.
  const deflection = Math.max(-1, Math.min(1, (balance - idealBalance) / 12));

  return { r1, r2, known, balance, mode, trueR, idealBalance, measuredR, deflection };
}

const MODE_LABEL: Record<string, string> = {
  r1: 'R₁ alone',
  r2: 'R₂ alone',
  series: 'R₁ and R₂ in series',
  parallel: 'R₁ and R₂ in parallel'
};

function compute(params: ParamValues): ModelOutput {
  const m = model(params);
  const expected = m.mode === 'series' ? m.r1 + m.r2 : m.mode === 'parallel' ? (m.r1 * m.r2) / (m.r1 + m.r2) : m.trueR;

  const issues = mergeIssues(
    validatePositive('r1', 'First coil', m.r1),
    validatePositive('r2', 'Second coil', m.r2),
    validateRange('balance', 'Jockey position', m.balance, 1, 99)
  );
  if (m.balance < 20 || m.balance > 80) {
    issues.push({
      field: 'known',
      severity: 'warning',
      message: 'The balance point is far from the middle of the wire. Change the resistance box so it falls between 40 cm and 60 cm.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let l = 2; l <= 98; l += 1) {
    points.push({ x: l, y: Math.max(-1, Math.min(1, (l - m.idealBalance) / 12)) });
  }

  return {
    readouts: [
      ro('mode', 'In the left gap', 0, '', 0, { text: MODE_LABEL[m.mode] ?? m.mode }),
      ro('l', 'Balancing length l', m.balance, 'cm', 1, { sub: `null at ${m.idealBalance.toFixed(1)} cm` }),
      ro('r', 'R = S·l/(100−l)', m.measuredR, 'Ω', 3),
      ro('expected', 'Expected value', expected, 'Ω', 3),
      ro('g', 'Galvanometer', m.deflection, 'div', 2, { tone: Math.abs(m.deflection) < 0.02 ? 'normal' : 'alert', sub: Math.abs(m.deflection) < 0.02 ? 'balanced' : 'deflected' }),
      ro('s', 'Resistance box S', m.known, 'Ω', 1)
    ],
    graph: singleSeriesGraph({
      title: 'Galvanometer deflection against jockey position',
      xLabel: 'l (cm)',
      yLabel: 'deflection (normalised)',
      seriesLabel: 'bridge imbalance',
      color: '#45d68b',
      points,
      live: { x: m.balance, y: m.deflection },
      guides: [{ axis: 'y', value: 0, label: 'balance', color: '#45d68b' }],
      markers: [{ x: m.idealBalance, y: 0, label: `null ${m.idealBalance.toFixed(1)} cm`, color: '#ffc65c' }]
    }),
    issues,
    description: `With ${MODE_LABEL[m.mode] ?? m.mode} in the left gap and ${m.known.toFixed(1)} ohm in the right, the bridge balances at ${m.idealBalance.toFixed(1)} centimetre. The jockey is at ${m.balance.toFixed(1)} centimetre.`,
    result: `At the null point R = S·l/(100 − l) = ${m.known.toFixed(1)} × ${m.balance.toFixed(1)}/${(100 - m.balance).toFixed(1)} = ${m.measuredR.toFixed(3)} Ω, against the expected ${expected.toFixed(3)} Ω for ${MODE_LABEL[m.mode] ?? m.mode}.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const balanced = Math.abs(m.deflection) < 0.02;
  const jockeyX = 130 + (m.balance / 100) * 640;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={100} width={780} height={330} rx={14} />

      <text x={410} y={128} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Metre bridge · {MODE_LABEL[m.mode] ?? m.mode}
      </text>

      {/* Bridge frame: the two gaps sit above the wire. */}
      <path d="M 130 250 L 130 175 L 770 175 L 770 250" className="lead" fill="none" />
      <g transform="translate(290 175)">
        <Resistor value={`${m.trueR.toFixed(2)} Ω`} label="left gap" live />
      </g>
      <g transform="translate(610 175)">
        <Resistor value={`${m.known.toFixed(1)} Ω`} label="S · box" live />
      </g>

      <MetreBridgeWire x={130} y={250} length={640} jockeyCm={m.balance} live={!balanced} showScale />
      <text x={jockeyX} y={214} textAnchor="middle" fontSize={11} fill="#ffc65c" fontFamily="ui-monospace, monospace">
        l = {m.balance.toFixed(1)} cm
      </text>

      <BatteryCell x={280} y={370} emf={2} live label="E" />
      <Switch x={430} y={370} closed live label="K" />
      <g transform="translate(600 366)">
        <MeterFace deflection={m.deflection} symbol="G" scale={0.58} zeroCentre value={balanced ? 'null' : `${(m.deflection * 30).toFixed(0)} div`} />
      </g>
      <path d={`M ${jockeyX} 276 L ${jockeyX} 330 L 600 330`} className={`lead${balanced ? '' : ' lead-live'}`} fill="none" />
      <path d="M 130 250 L 130 370 L 250 370 M 310 370 L 400 370 M 460 370 L 770 370 L 770 250" className="lead" fill="none" />

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        R/S = l/(100−l) → {m.measuredR.toFixed(3)}/{m.known.toFixed(1)} · R₁ = {m.r1.toFixed(1)} Ω · R₂ = {m.r2.toFixed(1)} Ω
      </text>

      {/* The coil dials and the resistance box live on the board. */}
      <Knob spec={control('r1', 'slider')} params={params} onChange={set} x={140} y={62} radius={19} label="First coil R₁ — turn the dial" />
      <Knob spec={control('r2', 'slider')} params={params} onChange={set} x={280} y={62} radius={19} label="Second coil R₂ — turn the dial" />
      <Knob spec={control('known', 'slider')} params={params} onChange={set} x={420} y={62} radius={19} label="Resistance box S — turn the dial" />
      {/* The jockey is the control: drag it along the wire to find the null. */}
      <DragX
        spec={control('balance', 'slider')}
        params={params}
        onChange={set}
        x={130}
        y={250}
        length={640}
        mapping={{ toValue: (dx) => (dx / 640) * 100, invert: (l) => 130 + (l / 100) * 640 }}
        label="Jockey — drag along the bridge wire to find the null point"
      />
    </svg>
  );
}

export default function ResistanceSeriesParallelExperiment() {
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
            <ViewPill label="l" value={m.balance.toFixed(1)} unit="cm" />
            <ViewPill label="R" value={m.measuredR.toFixed(2)} unit="Ω" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        const expected = m.mode === 'series' ? m.r1 + m.r2 : m.mode === 'parallel' ? (m.r1 * m.r2) / (m.r1 + m.r2) : m.trueR;
        return {
          title: 'Observation table — balancing length for each combination',
          columns: [
            col('gap', 'Left gap', '', 0),
            col('s', 'S', 'Ω', 1),
            col('l', 'l', 'cm', 1),
            col('r', 'R = S·l/(100−l)', 'Ω', 3, true)
          ],
          capture: () => ({ gap: MODE_LABEL[m.mode] ?? m.mode, s: m.known, l: m.balance, r: 0 }),
          derive: (row) => {
            const l = Number(row.l);
            const s = Number(row.s);
            return { ...row, r: (s * l) / Math.max(100 - l, 1e-6) };
          },
          comparison: {
            label: MODE_LABEL[m.mode] ?? m.mode,
            unit: 'Ω',
            experimental: m.measuredR,
            theoretical: expected,
            precision: 3
          },
          captureHint: 'Balance the bridge, then record. Take R₁ and R₂ alone before the two combinations.'
        };
      }}
    />
  );
}

export { definition, education };
