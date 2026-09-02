import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import { BatteryCell, MeterFace, Resistor, Switch } from '@/components/instruments/Instruments';
import { rcCharge, rcDischarge } from '@/physics-engine/circuits';
import { mergeIssues, validatePositive } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, str } from './_shared';
import { Knob, StageSegmented, type StageApi } from '@/components/controls/StageKit';

import { meta } from './rc-transient.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'emf', label: 'Supply voltage', symbol: 'V_0', unit: 'V', min: 1, max: 12, step: 0.5, initial: 6, precision: 1, onStage: true },
    { kind: 'slider', key: 'r', label: 'Resistance', symbol: 'R', unit: 'kΩ', min: 1, max: 200, step: 1, initial: 47, precision: 0, scale: 'log', onStage: true },
    { kind: 'slider', key: 'c', label: 'Capacitance', symbol: 'C', unit: 'µF', min: 1, max: 500, step: 1, initial: 100, precision: 0, scale: 'log', onStage: true },
    { kind: 'slider', key: 't', label: 'Time since the key was thrown', symbol: 't', unit: 's', min: 0, max: 60, step: 0.1, initial: 5, precision: 1, onStage: true },
    { kind: 'segmented', key: 'mode', label: 'Key position', initial: 'charge', options: [{ value: 'charge', label: 'Charging' }, { value: 'discharge', label: 'Discharging' }] }
  ],
  defaults: { emf: 6, r: 47, c: 100, t: 5, mode: 'charge' }
};

const education: EducationPack = {
  theory: [
    'When a capacitor is connected through a resistor to a source, charge does not appear on its plates instantly. The current is limited by the resistor, and as charge builds up the potential difference across the capacitor opposes the source, so the current falls. The result is an exponential approach to the supply voltage rather than a jump.',
    'The product RC has the dimensions of time and is called the time constant of the circuit. In one time constant the capacitor charges to about 63.2% of the supply voltage, and in five time constants it is within 1% of it — which is why 5RC is taken as the practical settling time.',
    'On discharge the same product governs the decay: the voltage falls to 1/e, about 36.8%, of its initial value in one time constant. The two curves are mirror images about the half-supply line only when the circuit is symmetric.',
    'Because the current is the rate of change of charge, the current curve is a decaying exponential in both cases, largest at the instant the key is thrown and falling to zero as the capacitor reaches its final state.'
  ],
  formulas: [
    { tex: 'V = V_0\\left(1 - e^{-t/RC}\\right)', caption: 'Growth of voltage across a charging capacitor.' },
    { tex: 'V = V_0 e^{-t/RC}', caption: 'Decay of voltage across a discharging capacitor.' },
    { tex: '\\tau = RC', caption: 'Time constant of the circuit.' },
    { tex: 'I = \\frac{V_0}{R}e^{-t/RC}', caption: 'Current at any instant during charging.' },
    { tex: 'U = \\frac{1}{2}CV^2', caption: 'Energy stored in the capacitor.' }
  ],
  variables: [
    { symbol: 'V_0', name: 'Supply voltage', unit: 'V' },
    { symbol: 'V', name: 'Voltage across the capacitor', unit: 'V' },
    { symbol: 'R', name: 'Series resistance', unit: 'Ω' },
    { symbol: 'C', name: 'Capacitance', unit: 'F' },
    { symbol: '\\tau', name: 'Time constant', unit: 's', note: 'τ = RC' },
    { symbol: 'q', name: 'Charge on the capacitor', unit: 'C' }
  ],
  procedure: [
    'Connect the capacitor in series with the resistor and a voltmeter across the capacitor.',
    'Throw the key to the charging position and start the stopwatch at the same instant.',
    'Note the voltmeter reading every few seconds until it stops changing.',
    'Throw the key to the discharging position and repeat the readings.',
    'Plot V against t for both cases.',
    'Read off the time at which V reaches 0.632V₀ on the charging curve — that time is the time constant.',
    'Compare it with the product of the marked values of R and C.'
  ],
  precautions: [
    'Discharge the capacitor fully before starting a fresh charging run.',
    'Use a high-resistance voltmeter; a low-resistance one discharges the capacitor as it measures.',
    'Start the stopwatch at the instant the key is thrown, not afterwards.',
    'Observe the polarity marked on an electrolytic capacitor — reversing it destroys the capacitor.'
  ],
  sourcesOfError: [
    'The voltmeter draws current and so shortens the apparent time constant.',
    'Leakage across the dielectric of a real capacitor.',
    'Reaction time in starting the stopwatch and reading the meter together.',
    'The marked capacitance of an electrolytic capacitor can be 20% away from its true value.'
  ],
  tips: [
    'Set t equal to R×C and confirm the reading is 63.2% of the supply — that is the definition of the time constant.',
    'Multiply R by ten and watch the whole curve stretch by the same factor.'
  ],
  viva: [
    { q: 'What is the time constant of an RC circuit?', a: 'The product RC — the time in which the capacitor charges to 63.2% of the applied voltage, or discharges to 36.8% of its initial voltage.' },
    { q: 'Why does the charging current decrease with time?', a: 'The growing potential difference across the capacitor opposes the source, so the net voltage driving current through the resistor falls.' },
    { q: 'How long does a capacitor take to charge fully?', a: 'Strictly it never does; in practice after about five time constants it is within 1% of the supply voltage.' },
    { q: 'Does the time constant depend on the supply voltage?', a: 'No. It depends only on R and C.' },
    { q: 'What is the energy stored in a charged capacitor?', a: 'U = ½CV², which is half the energy drawn from the source; the other half is dissipated in the resistor.' }
  ],
  resultTemplate:
    'The voltage across the capacitor grows and decays exponentially, and the time at which it reaches 63.2% of the supply equals the product RC.'
};

function model(params: ParamValues) {
  const v0 = num(params, 'emf', 6);
  const r = num(params, 'r', 47) * 1000;
  const c = num(params, 'c', 100) * 1e-6;
  const t = num(params, 't', 5);
  const charging = str(params, 'mode', 'charge') === 'charge';

  const tau = r * c;
  const voltage = charging ? rcCharge(v0, r, c, t) : rcDischarge(v0, r, c, t);
  const current = charging ? ((v0 - voltage) / r) : -voltage / r;
  const charge = c * voltage;
  const energy = 0.5 * c * voltage * voltage;
  const fraction = v0 === 0 ? 0 : voltage / v0;

  return { v0, r, c, t, charging, tau, voltage, current, charge, energy, fraction };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('r', 'Resistance', m.r),
    validatePositive('c', 'Capacitance', m.c)
  );
  if (m.tau > 30) {
    issues.push({
      field: 'c',
      severity: 'info',
      message: `The time constant is ${m.tau.toFixed(1)} s, so the capacitor needs about ${(5 * m.tau).toFixed(0)} s to settle — longer than the 60 s sweep.`
    });
  }

  const charge: { x: number; y: number }[] = [];
  const discharge: { x: number; y: number }[] = [];
  for (let i = 0; i <= 120; i += 1) {
    const t = (i / 120) * 60;
    charge.push({ x: t, y: rcCharge(m.v0, m.r, m.c, t) });
    discharge.push({ x: t, y: rcDischarge(m.v0, m.r, m.c, t) });
  }

  return {
    readouts: [
      ro('v', 'Voltage across C', m.voltage, 'V', 3, { sub: `${(m.fraction * 100).toFixed(1)} % of V₀` }),
      ro('i', 'Current', m.current, 'A', 4, { tone: m.current < 0 ? 'neg' : 'normal' }),
      ro('tau', 'Time constant τ = RC', m.tau, 's', 3, { tone: 'normal' }),
      ro('t', 'Elapsed time t', m.t, 's', 2, { sub: `${(m.tau > 0 ? m.t / m.tau : 0).toFixed(2)} τ` }),
      ro('q', 'Charge q = CV', m.charge, 'C', 3),
      ro('u', 'Energy stored', m.energy, 'J', 4)
    ],
    graph: {
      title: 'Voltage across the capacitor against time',
      xLabel: 't (s)',
      yLabel: 'V (V)',
      series: [
        { key: 'charge', label: 'charging', color: '#25d0ee', points: charge },
        { key: 'discharge', label: 'discharging', color: '#ff6b7d', points: discharge, dashed: true }
      ],
      guides: [
        { axis: 'y', value: 0.632 * m.v0, label: '0.632 V₀', color: '#45d68b' },
        { axis: 'x', value: m.tau, label: 'τ', color: '#ffc65c' }
      ],
      live: { x: m.t, y: m.voltage }
    },
    issues,
    description: `A ${formatSI(m.c, 3)} farad capacitor is ${m.charging ? 'charging through' : 'discharging through'} a ${formatSI(m.r, 3)} ohm resistor from a ${m.v0.toFixed(1)} volt supply. After ${m.t.toFixed(1)} second the capacitor holds ${m.voltage.toFixed(3)} volt.`,
    result: `The time constant is τ = RC = ${m.tau.toFixed(3)} s. At t = ${m.t.toFixed(1)} s the capacitor is at ${m.voltage.toFixed(3)} V, which is ${(m.fraction * 100).toFixed(1)}% of the supply — consistent with V = V₀(1 − e^(−t/RC)) for charging.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const fill = Math.max(0, Math.min(1, m.fraction));

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={110} width={780} height={310} rx={14} />
      <text x={410} y={140} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        RC circuit · {m.charging ? 'charging' : 'discharging'} · τ = {m.tau.toFixed(2)} s
      </text>

      <path d="M 150 380 L 150 210 L 660 210 L 660 380 L 150 380" className="lead lead-live" fill="none" strokeWidth={2.2} />

      <BatteryCell x={230} y={210} emf={m.v0} live label="V₀" />
      <Switch x={370} y={210} closed live label={m.charging ? 'K → charge' : 'K → discharge'} />
      <g transform="translate(520 210)">
        <Resistor value={formatSI(m.r, 3) + ' Ω'} label="R" live />
      </g>

      {/* Capacitor with a fill bar showing how charged it actually is. */}
      <g transform="translate(660 295)">
        <line x1={0} y1={-40} x2={0} y2={-14} className="lead lead-live" />
        <line x1={-26} y1={-14} x2={26} y2={-14} stroke="#cfdcea" strokeWidth={3.4} />
        <line x1={-26} y1={0} x2={26} y2={0} stroke="#cfdcea" strokeWidth={3.4} />
        <rect x={-26} y={-13} width={52} height={12} fill="#25d0ee" opacity={0.18} />
        <rect x={-26} y={-13} width={52 * fill} height={12} fill="#25d0ee" opacity={0.75} />
        <line x1={0} y1={0} x2={0} y2={26} className="lead lead-live" />
        <text x={36} y={-4} fontSize={10.5} fill="#8497ad">C = {num(params, 'c', 100).toFixed(0)} µF</text>
      </g>

      <g transform="translate(300 320)">
        <MeterFace deflection={fill} symbol="V" scale={0.62} value={`${m.voltage.toFixed(2)} V`} label="across C" />
      </g>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        V = V₀(1 − e^(−t/RC)) → {m.voltage.toFixed(3)} V at t = {m.t.toFixed(1)} s = {(m.tau > 0 ? m.t / m.tau : 0).toFixed(2)} τ
      </text>

      <Knob spec={control('emf', 'slider')} params={params} onChange={set} x={120} y={62} radius={19} label="Supply voltage — turn the dial" />
      <Knob spec={control('r', 'slider')} params={params} onChange={set} x={250} y={62} radius={19} label="Series resistance — turn the dial" />
      <Knob spec={control('c', 'slider')} params={params} onChange={set} x={380} y={62} radius={19} label="Capacitance — turn the dial" />
      <Knob spec={control('t', 'slider')} params={params} onChange={set} x={510} y={62} radius={19} label="Stopwatch — turn the dial to step through time" />
      <StageSegmented spec={control('mode', 'segmented')} params={params} onChange={set} x={670} y={62} segmentWidth={66} label="Key position" />
    </svg>
  );
}

export default function RcTransientExperiment() {
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
            <ViewPill label="V" value={m.voltage.toFixed(3)} unit="V" />
            <ViewPill label="τ" value={m.tau.toFixed(2)} unit="s" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — voltage against time',
          columns: [
            col('mode', 'Phase', '', 0),
            col('t', 't', 's', 2),
            col('v', 'V', 'V', 3),
            col('frac', 'V/V₀', '—', 3, true)
          ],
          capture: () => ({ mode: m.charging ? 'charging' : 'discharging', t: m.t, v: m.voltage, frac: 0 }),
          derive: (row) => ({ ...row, frac: Number(row.v) / m.v0 }),
          comparison: {
            label: 'time constant',
            unit: 's',
            experimental: m.tau,
            theoretical: m.r * m.c,
            precision: 3
          },
          captureHint: 'Step the stopwatch and record a reading every few seconds.'
        };
      }}
    />
  );
}

export { definition, education };
