import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { malusIntensity } from '@/physics-engine/optics';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './malus-law.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'theta', label: 'Analyser angle', symbol: '\\theta', unit: '°', min: 0, max: 180, step: 1, initial: 45 },
    { kind: 'slider', key: 'i0', label: 'Incident intensity', symbol: 'I_0', unit: 'cd', min: 1, max: 100, step: 1, initial: 100 },
    { kind: 'toggle', key: 'unpolarised', label: 'Source is unpolarised', initial: false, hint: 'Inserting a polariser first halves the intensity' }
  ],
  defaults: { theta: 45, i0: 100, unpolarised: false }
};

const education: EducationPack = {
  theory: [
    'Light from an ordinary source vibrates in every direction perpendicular to its travel. A polariser transmits only the component along its transmission axis, producing plane polarised light of half the original intensity.',
    'A second polariser, the analyser, transmits only the component of that polarised light along its own axis. The transmitted amplitude is therefore E cos θ, and since intensity is proportional to the square of the amplitude the transmitted intensity is I₀ cos²θ.',
    'This is Malus’s law. The intensity is maximum when the axes are parallel, falls to zero when they are crossed at 90°, and rises again beyond that — it has a period of 180°, not 360°.'
  ],
  formulas: [
    { tex: 'I = I_0 \\cos^2 \\theta', caption: 'Malus’s law.' },
    { tex: 'I_{polarised} = \\frac{1}{2} I_{unpolarised}', caption: 'Intensity after the first polariser.' },
    { tex: 'E = E_0 \\cos \\theta', caption: 'Transmitted amplitude.' }
  ],
  variables: [
    { symbol: 'I_0', name: 'Intensity incident on the analyser', unit: 'cd' },
    { symbol: 'I', name: 'Transmitted intensity', unit: 'cd' },
    { symbol: '\\theta', name: 'Angle between the axes', unit: '°' },
    { symbol: 'E_0', name: 'Incident amplitude', unit: 'V m⁻¹' }
  ],
  procedure: [
    'Place the polariser in the beam and set the analyser at 0° so the axes are parallel.',
    'Record the intensity reading, then rotate the analyser in steps of 10°.',
    'Record the intensity at each angle up to 180°.',
    'Plot I against cos²θ; the graph should be a straight line through the origin with slope I₀.'
  ],
  precautions: ['The beam must be normal to both polarisers.', 'Stray room light adds a constant background — subtract it.', 'Polaroid sheets absorb some light even when aligned.'],
  tips: ['Rotate through 90° and watch the screen go dark: that is the crossed position.'],
  viva: [
    { q: 'State Malus’s law.', a: 'I = I₀ cos²θ, where θ is the angle between the transmission axes of the polariser and the analyser.' },
    { q: 'What is the intensity when the polarisers are crossed?', a: 'Zero. At θ = 90° the cos²θ factor vanishes, so the analyser transmits none of the light the polariser passed.' },
    { q: 'Why does an unpolarised beam lose half its intensity in a polariser?', a: 'Because only one of the two equally energetic perpendicular components is transmitted.' },
    { q: 'What is the period of the intensity variation?', a: '180°, since cos²θ repeats every 180°.' },
    { q: 'Name one application of polarisation.', a: 'Polaroid sunglasses, which suppress glare reflected from horizontal surfaces.' }
  ],
  resultTemplate: 'A plot of I against cos²θ is a straight line through the origin, verifying Malus’s law.'
};

function compute(params: ParamValues): ModelOutput {
  const theta = num(params, 'theta', 45);
  const i0Raw = num(params, 'i0', 100);
  const unpol = Boolean(params.unpolarised);
  const i0 = unpol ? i0Raw / 2 : i0Raw;
  const i = malusIntensity(i0, theta);
  const points: { x: number; y: number }[] = [];
  for (let a = 0; a <= 180; a += 1) points.push({ x: a, y: malusIntensity(i0, a) });
  return {
    readouts: [
      ro('i', 'Transmitted intensity', i, 'cd', 2),
      ro('frac', 'Fraction of I₀', i0 > 0 ? i / i0 : 0, '—', 3),
      ro('amp', 'Amplitude ratio', Math.abs(Math.cos((theta * Math.PI) / 180)), '—', 3),
      ro('i0', 'Intensity on analyser', i0, 'cd', 2, { sub: unpol ? 'halved by polariser' : 'direct' }),
      ro('state', 'Analyser', theta, '', 0, { text: Math.abs(Math.cos((theta * Math.PI) / 180)) < 0.02 ? 'CROSSED' : 'TRANSMITTING' })
    ],
    graph: singleSeriesGraph({
      title: 'Transmitted intensity against analyser angle', xLabel: 'θ (°)', yLabel: 'I (cd)',
      seriesLabel: 'I', color: '#9d8cff', points, live: { x: theta, y: i }
    }),
    description: `Plane polarised light of intensity ${i0.toFixed(1)} candela falls on an analyser at ${theta.toFixed(0)} degrees. The transmitted intensity is ${i.toFixed(2)} candela.`,
    result: `At θ = ${theta.toFixed(0)}°, I = I₀ cos²θ = ${i0.toFixed(1)} × ${Math.cos((theta * Math.PI) / 180) ** 2} = ${i.toFixed(2)} cd, which is ${(i0 > 0 ? (i / i0) * 100 : 0).toFixed(1)}% of the incident intensity.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const theta = num(params, 'theta', 45);
  const i0Raw = num(params, 'i0', 100);
  const unpol = Boolean(params.unpolarised);
  const i0 = unpol ? i0Raw / 2 : i0Raw;
  const i = malusIntensity(i0, theta);
  const frac = i0 > 0 ? i / i0 : 0;
  const beamOpacity = 0.12 + frac * 0.8;

  const drawAxes = (x: number, angle: number, label: string, color: string) => (
    <g transform={`translate(${x} 236)`}>
      <circle r={64} fill="#0d1621" stroke="#3a4c60" />
      <circle r={64} fill="none" stroke={color} strokeWidth={1} opacity={0.35} />
      <g transform={`rotate(${angle})`}>
        {Array.from({ length: 7 }, (_, k) => (
          <line key={k} x1={0} y1={-56 + k * 18} x2={0} y2={-56 + k * 18 + 0} stroke={color} strokeWidth={0} />
        ))}
        {Array.from({ length: 7 }, (_, k) => (
          <line key={`p${k}`} x1={-46} y1={-54 + k * 18} x2={46} y2={-54 + k * 18} stroke={color} strokeWidth={1.6} opacity={0.85} />
        ))}
      </g>
      <text y={92} textAnchor="middle" fontSize={11} fill={color}>
        {label}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <circle cx={90} cy={236} r={26} fill="#ffe6a8" opacity={unpol ? 0.7 : 0.95} />
      <text x={90} y={280} textAnchor="middle" fontSize={10} fill="#8497ad">source</text>
      {unpol
        ? Array.from({ length: 8 }, (_, k) => (
            <line key={k} x1={120 + k * 14} y1={236 - 20} x2={120 + k * 14 + 8} y2={236 + 20} stroke="#ffd257" strokeWidth={1.4} opacity={0.5} transform={`rotate(${k * 22} ${124 + k * 14} 236)`} />
          ))
        : Array.from({ length: 6 }, (_, k) => (
            <line key={k} x1={120 + k * 14} y1={216} x2={120 + k * 14} y2={256} stroke="#ffd257" strokeWidth={1.6} opacity={0.8} />
          ))}
      <rect x={230} y={222} width={330} height={28} fill="#ffd257" opacity={unpol ? 0.35 : beamOpacity} />
      {drawAxes(230, 0, 'polariser · 0°', '#ffd257')}
      <rect x={560} y={222} width={180} height={28} fill="#9d8cff" opacity={Math.max(0.04, frac * 0.9)} />
      {drawAxes(560, theta, `analyser · ${theta.toFixed(0)}°`, '#9d8cff')}
      <rect x={742} y={150} width={16} height={172} rx={3} fill="#cfdcea" opacity={0.25 + frac * 0.75} />
      <rect x={742} y={150} width={16} height={172} rx={3} fill="none" stroke="#5c7085" />
      <text x={750} y={340} textAnchor="middle" fontSize={10} fill="#8497ad">screen</text>
      <text x={410} y={44} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        I = I₀ cos²θ = {i.toFixed(2)} cd
      </text>
      <text x={410} y={63} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        θ = {theta.toFixed(0)}° · transmission = {(frac * 100).toFixed(1)}%
      </text>
      <Knob
        spec={control('theta', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={410}
        y={418}
        radius={22}
        label="Analyser angle θ — turn the analyser"
      />
      <StageSwitch
        spec={control('unpolarised', 'toggle')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={140}
        y={418}
        label="Source is unpolarised"
      />
        </svg>
  );
}

export default function MalusLawExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const theta = num(p, 'theta', 45);
        const i0 = (p.unpolarised ?? false) ? num(p, 'i0', 100) / 2 : num(p, 'i0', 100);
        return {
          title: 'Observation table — Malus’s law',
          columns: [col('t', 'θ', '°', 0), col('c2', 'cos²θ', '—', 4), col('i', 'I', 'cd', 2), col('r', 'I/I₀', '—', 3, true)],
          capture: () => ({ t: theta, c2: Math.cos((theta * Math.PI) / 180) ** 2, i: malusIntensity(i0, theta), r: 0 }),
          derive: (row) => ({ ...row, r: i0 > 0 ? Number(row.i) / i0 : Number.NaN }),
          captureHint: 'Rotate the analyser before each reading.'
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
