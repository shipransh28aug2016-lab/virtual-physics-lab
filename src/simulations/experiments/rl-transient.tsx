import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import { BatteryCell, MeterFace, Resistor, SolenoidSvg, Switch } from '@/components/instruments/Instruments';
import { rlDecay, rlGrowth } from '@/physics-engine/circuits';
import { mergeIssues, validatePositive } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, str } from './_shared';
import { Knob, StageSegmented, type StageApi } from '@/components/controls/StageKit';

import { meta } from './rl-transient.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#25d0ee',
  controls: [
    { kind: 'slider', key: 'emf', label: 'Supply voltage', symbol: 'V_0', unit: 'V', min: 1, max: 12, step: 0.5, initial: 6, precision: 1, onStage: true },
    { kind: 'slider', key: 'r', label: 'Resistance', symbol: 'R', unit: 'Ω', min: 1, max: 200, step: 1, initial: 20, precision: 0, scale: 'log', onStage: true },
    { kind: 'slider', key: 'l', label: 'Inductance', symbol: 'L', unit: 'mH', min: 1, max: 2000, step: 1, initial: 250, precision: 0, scale: 'log', onStage: true },
    { kind: 'slider', key: 't', label: 'Time since the key was thrown', symbol: 't', unit: 'ms', min: 0, max: 200, step: 0.5, initial: 20, precision: 1, onStage: true },
    { kind: 'segmented', key: 'mode', label: 'Key position', initial: 'growth', options: [{ value: 'growth', label: 'Build-up' }, { value: 'decay', label: 'Decay' }] }
  ],
  defaults: { emf: 6, r: 20, l: 250, t: 20, mode: 'growth' }
};

const education: EducationPack = {
  theory: [
    'An inductor opposes any change in the current through it. When the key is closed, the growing current sets up a growing flux through the coil, and by Lenz’s law the induced emf acts against the applied voltage. The current therefore rises gradually towards its steady value V₀/R instead of jumping to it.',
    'The ratio L/R has the dimensions of time and is the time constant of the circuit. In one time constant the current reaches about 63.2% of its final value, and after five it is within 1% of it.',
    'When the circuit is broken, the collapsing flux induces an emf that tries to keep the current going. If the current is allowed to decay through a resistor, it falls exponentially with the same time constant; if the circuit is opened abruptly, the very large induced emf can strike a spark across the gap.',
    'The energy stored in the magnetic field of the inductor, ½LI², is what supplies that decay current — the counterpart of the energy stored in the electric field of a capacitor.'
  ],
  formulas: [
    { tex: 'I = I_0\\left(1 - e^{-tR/L}\\right)', caption: 'Growth of current after the key is closed.' },
    { tex: 'I = I_0 e^{-tR/L}', caption: 'Decay of current when the source is removed.' },
    { tex: '\\tau = \\frac{L}{R}', caption: 'Time constant of an inductive circuit.' },
    { tex: '\\varepsilon = -L\\frac{dI}{dt}', caption: 'Back emf induced across the inductor.' },
    { tex: 'U = \\frac{1}{2}LI^2', caption: 'Energy stored in the magnetic field.' }
  ],
  variables: [
    { symbol: 'I_0', name: 'Steady current V₀/R', unit: 'A' },
    { symbol: 'I', name: 'Instantaneous current', unit: 'A' },
    { symbol: 'L', name: 'Inductance', unit: 'H' },
    { symbol: 'R', name: 'Resistance', unit: 'Ω' },
    { symbol: '\\tau', name: 'Time constant', unit: 's', note: 'τ = L/R' },
    { symbol: '\\varepsilon', name: 'Back emf', unit: 'V' }
  ],
  procedure: [
    'Connect the coil in series with the resistance box, the ammeter and the key.',
    'Close the key and follow the ammeter as the current builds up to its steady value.',
    'Note the current at regular intervals from the instant the key is closed.',
    'Throw the key to the decay position and repeat the readings as the current falls.',
    'Plot I against t for both cases.',
    'Read the time at which the current reaches 0.632I₀ and compare it with L/R.'
  ],
  precautions: [
    'Never open an inductive circuit abruptly while a large current flows — the induced emf can be dangerous.',
    'Use a coil with a low resistance of its own, or account for it in R.',
    'Keep iron away from an air-cored coil; it changes the inductance.',
    'Wait until the current has fully decayed before starting a fresh build-up run.'
  ],
  sourcesOfError: [
    'The resistance of the coil itself adds to R and shortens the time constant.',
    'The ammeter has its own resistance and inductance.',
    'Eddy currents in any nearby metal alter the effective inductance.',
    'Reaction time in reading a fast transient — L/R is often only a few milliseconds.'
  ],
  tips: [
    'Set t equal to L/R and check that the current is at 63.2% of its final value.',
    'Increase R and watch the transient get faster but the steady current get smaller — R appears in both.'
  ],
  viva: [
    { q: 'Why does the current not reach its steady value instantly?', a: 'The changing flux induces a back emf that opposes the applied voltage, so the current grows only gradually.' },
    { q: 'What is the time constant of an LR circuit?', a: 'L/R — the time in which the current reaches 63.2% of its final value.' },
    { q: 'Where is the energy stored during the build-up?', a: 'In the magnetic field of the inductor, U = ½LI².' },
    { q: 'Why does a spark appear when an inductive circuit is broken?', a: 'The current falls very fast, so −L dI/dt is very large and the induced emf breaks down the air across the gap.' },
    { q: 'Does the time constant depend on the supply voltage?', a: 'No. Only on L and R; the voltage sets the final current, not the speed.' }
  ],
  resultTemplate:
    'The current grows and decays exponentially, and the time at which it reaches 63.2% of the steady value equals L/R.'
};

function model(params: ParamValues) {
  const v0 = num(params, 'emf', 6);
  const r = num(params, 'r', 20);
  const l = num(params, 'l', 250) / 1000;
  const tMs = num(params, 't', 20);
  const t = tMs / 1000;
  const growing = str(params, 'mode', 'growth') === 'growth';

  const i0 = r > 0 ? v0 / r : Number.POSITIVE_INFINITY;
  const tau = r > 0 ? l / r : Number.POSITIVE_INFINITY;
  const current = growing ? rlGrowth(i0, r, l, t) : rlDecay(i0, r, l, t);
  // dI/dt from the exponential, so the back emf is a computed quantity.
  const rate = tau > 0 ? (growing ? (i0 - current) / tau : -current / tau) : 0;
  const backEmf = -l * rate;
  const energy = 0.5 * l * current * current;

  return { v0, r, l, t, tMs, growing, i0, tau, current, rate, backEmf, energy };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(validatePositive('r', 'Resistance', m.r), validatePositive('l', 'Inductance', m.l));
  if (m.tau * 1000 > 100) {
    issues.push({
      field: 'l',
      severity: 'info',
      message: `The time constant is ${(m.tau * 1000).toFixed(1)} ms, so the transient runs past the 200 ms sweep.`
    });
  }

  const growth: { x: number; y: number }[] = [];
  const decay: { x: number; y: number }[] = [];
  for (let i = 0; i <= 120; i += 1) {
    const t = (i / 120) * 0.2;
    growth.push({ x: t * 1000, y: rlGrowth(m.i0, m.r, m.l, t) });
    decay.push({ x: t * 1000, y: rlDecay(m.i0, m.r, m.l, t) });
  }

  return {
    readouts: [
      ro('i', 'Current I', m.current, 'A', 4, { sub: `${m.i0 > 0 ? ((m.current / m.i0) * 100).toFixed(1) : '0'} % of I₀` }),
      ro('i0', 'Steady current I₀ = V₀/R', m.i0, 'A', 4),
      ro('tau', 'Time constant τ = L/R', m.tau * 1000, 'ms', 3),
      ro('t', 'Elapsed time t', m.tMs, 'ms', 2, { sub: `${(m.tau > 0 ? m.t / m.tau : 0).toFixed(2)} τ` }),
      ro('emf', 'Back emf −L dI/dt', m.backEmf, 'V', 3, { tone: Math.abs(m.backEmf) > m.v0 ? 'alert' : 'normal' }),
      ro('u', 'Energy stored ½LI²', m.energy, 'J', 5)
    ],
    graph: {
      title: 'Current in the inductive circuit against time',
      xLabel: 't (ms)',
      yLabel: 'I (A)',
      series: [
        { key: 'growth', label: 'build-up', color: '#25d0ee', points: growth },
        { key: 'decay', label: 'decay', color: '#ff6b7d', points: decay, dashed: true }
      ],
      guides: [
        { axis: 'y', value: 0.632 * m.i0, label: '0.632 I₀', color: '#45d68b' },
        { axis: 'x', value: m.tau * 1000, label: 'τ', color: '#ffc65c' }
      ],
      live: { x: m.tMs, y: m.current }
    },
    issues,
    description: `A ${formatSI(m.l, 3)} henry coil is in series with ${m.r.toFixed(0)} ohm across ${m.v0.toFixed(1)} volt. ${m.growing ? 'The key has just been closed' : 'The source has just been removed'} and after ${m.tMs.toFixed(1)} millisecond the current is ${m.current.toFixed(4)} ampere.`,
    result: `The time constant is τ = L/R = ${(m.tau * 1000).toFixed(3)} ms and the steady current is I₀ = V₀/R = ${m.i0.toFixed(4)} A. At t = ${m.tMs.toFixed(1)} ms the current is ${m.current.toFixed(4)} A, or ${m.i0 > 0 ? ((m.current / m.i0) * 100).toFixed(1) : '0'}% of I₀, and the back emf is ${m.backEmf.toFixed(3)} V.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const frac = m.i0 > 0 ? Math.max(0, Math.min(1, m.current / m.i0)) : 0;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={110} width={780} height={310} rx={14} />
      <text x={410} y={140} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        LR circuit · {m.growing ? 'current building up' : 'current decaying'} · τ = {(m.tau * 1000).toFixed(2)} ms
      </text>

      <path d="M 150 380 L 150 210 L 660 210 L 660 380 L 150 380" className="lead lead-live" fill="none" strokeWidth={2.2} />

      <BatteryCell x={230} y={210} emf={m.v0} live label="V₀" />
      <Switch x={360} y={210} closed live label={m.growing ? 'K closed' : 'K → decay'} />
      <g transform="translate(500 210)">
        <Resistor value={`${m.r.toFixed(0)} Ω`} label="R" live />
      </g>

      {/* The coil itself, drawn with the number of turns held fixed. */}
      <g transform="translate(430 358)">
        <SolenoidSvg x={-110} y={0} length={220} radius={18} turns={16} live={Math.abs(m.current) > 1e-6} />
        <text x={0} y={38} textAnchor="middle" fontSize={10.5} fill="#8497ad">
          L = {num(params, 'l', 250).toFixed(0)} mH · back emf {m.backEmf.toFixed(2)} V
        </text>
      </g>

      <g transform="translate(230 320)">
        <MeterFace deflection={frac} symbol="A" scale={0.62} value={`${m.current.toFixed(3)} A`} label="ammeter" />
      </g>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        I = I₀(1 − e^(−tR/L)) → {m.current.toFixed(4)} A at t = {m.tMs.toFixed(1)} ms = {(m.tau > 0 ? m.t / m.tau : 0).toFixed(2)} τ
      </text>

      <Knob spec={control('emf', 'slider')} params={params} onChange={set} x={120} y={62} radius={19} label="Supply voltage — turn the dial" />
      <Knob spec={control('r', 'slider')} params={params} onChange={set} x={250} y={62} radius={19} label="Series resistance — turn the dial" />
      <Knob spec={control('l', 'slider')} params={params} onChange={set} x={380} y={62} radius={19} label="Inductance of the coil — turn the dial" />
      <Knob spec={control('t', 'slider')} params={params} onChange={set} x={510} y={62} radius={19} label="Stopwatch — turn the dial to step through time" />
      <StageSegmented spec={control('mode', 'segmented')} params={params} onChange={set} x={670} y={62} segmentWidth={64} label="Key position" />
    </svg>
  );
}

export default function RlTransientExperiment() {
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
            <ViewPill label="τ" value={(m.tau * 1000).toFixed(2)} unit="ms" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — current against time',
          columns: [
            col('mode', 'Phase', '', 0),
            col('t', 't', 'ms', 2),
            col('i', 'I', 'A', 4),
            col('frac', 'I/I₀', '—', 3, true)
          ],
          capture: () => ({ mode: m.growing ? 'build-up' : 'decay', t: m.tMs, i: m.current, frac: 0 }),
          derive: (row) => ({ ...row, frac: m.i0 > 0 ? Number(row.i) / m.i0 : Number.NaN }),
          comparison: {
            label: 'time constant',
            unit: 'ms',
            experimental: m.tau * 1000,
            theoretical: (m.l / m.r) * 1000,
            precision: 3
          },
          captureHint: 'Step the stopwatch and record the ammeter reading at each instant.'
        };
      }}
    />
  );
}

export { definition, education };
