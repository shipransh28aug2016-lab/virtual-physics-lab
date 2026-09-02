import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { AngleArc, Ray } from '@/components/instruments/Instruments';
import { criticalAngle, snellRefraction } from '@/physics-engine/optics';
import { degToRad } from '@/physics-engine/units';
import { mergeIssues, validateRange } from '@/physics-engine/validation';
import { col, num, ro, str, singleSeriesGraph } from './_shared';
import { Knob, StageSegmented, type StageApi } from '@/components/controls/StageKit';

import { meta } from './total-internal-reflection.meta';

export { meta };

const CORES = [
  { value: 'water', label: 'Water', n: 1.333 },
  { value: 'glass', label: 'Crown glass', n: 1.52 },
  { value: 'fibre', label: 'Fibre core', n: 1.48 },
  { value: 'diamond', label: 'Diamond', n: 2.417 }
] as const;

const coreOf = (key: string) => CORES.find((c) => c.value === key) ?? CORES[1];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#6ee7ff',
  controls: [
    { kind: 'slider', key: 'incidence', label: 'Angle of incidence inside the medium', symbol: 'i', unit: '°', min: 0, max: 89, step: 0.5, initial: 30, precision: 1, onStage: true },
    { kind: 'segmented', key: 'core', label: 'Denser medium', initial: 'glass', options: CORES.map((c) => ({ value: c.value, label: c.label })) },
    { kind: 'slider', key: 'cladding', label: 'Refractive index of the outer medium', symbol: 'n_2', unit: '', min: 1, max: 1.47, step: 0.005, initial: 1, precision: 3, hint: 'Air is 1.000; a fibre cladding is about 1.46', onStage: true },
    { kind: 'toggle', key: 'fibre', label: 'Show the optical fibre', initial: false, onStage: true }
  ],
  defaults: { incidence: 30, core: 'glass', cladding: 1, fibre: false }
};

const education: EducationPack = {
  theory: [
    'When light travels from a denser medium into a rarer one it bends away from the normal. As the angle of incidence inside the denser medium is increased, the refracted ray swings further and further from the normal until, at one particular angle, it grazes along the boundary itself. That angle is the critical angle.',
    'Beyond it Snell’s law would demand a sine greater than one, which is impossible: no refracted ray can exist. All the light is then reflected back into the denser medium, and because none is transmitted the reflection is total. This is the only kind of reflection with no loss of intensity at all — better than any silvered mirror.',
    'The critical angle depends only on the two refractive indices, sin i_c = n₂/n₁. A denser core or a rarer surround gives a smaller critical angle and therefore traps light more easily; diamond, with its very high index, has a critical angle of only about 24°, which is why cut diamonds sparkle.',
    'An optical fibre is this effect engineered: a core of slightly higher index is surrounded by a cladding of slightly lower index, so light entering within a cone of acceptance strikes the wall above the critical angle at every bounce and is guided along the fibre for kilometres. Totally reflecting prisms in binoculars and periscopes use the same principle at 45°.'
  ],
  formulas: [
    { tex: '\\sin i_c = \\frac{n_2}{n_1}', caption: 'Critical angle for the denser-to-rarer boundary.' },
    { tex: 'i_c = \\sin^{-1}\\left(\\frac{1}{n}\\right)', caption: 'For a medium of index n against air.' },
    { tex: 'NA = \\sqrt{n_1^2 - n_2^2}', caption: 'Numerical aperture of an optical fibre.' },
    { tex: '\\theta_{max} = \\sin^{-1}(NA)', caption: 'Half-angle of the acceptance cone in air.' }
  ],
  variables: [
    { symbol: 'i_c', name: 'Critical angle', unit: '°' },
    { symbol: 'n_1', name: 'Refractive index of the denser medium', unit: '—' },
    { symbol: 'n_2', name: 'Refractive index of the rarer medium', unit: '—' },
    { symbol: 'NA', name: 'Numerical aperture', unit: '—' },
    { symbol: '\\theta_{max}', name: 'Acceptance angle', unit: '°' }
  ],
  procedure: [
    'Place the semicircular glass block with its flat face along a ruled line and mark the normal at the centre of that face.',
    'Send a narrow beam in through the curved surface so that it reaches the centre of the flat face without bending.',
    'Increase the angle of incidence in small steps and watch the refracted ray move towards the surface while the reflected ray brightens.',
    'Note the angle at which the refracted ray just disappears — this is the critical angle.',
    'Repeat several times and take the mean.',
    'Compute n = 1/sin i_c and compare with the accepted value for the glass.'
  ],
  precautions: [
    'The beam must enter along a radius of the curved face so that it is not refracted there.',
    'Approach the critical angle in small steps; the refracted ray fades quickly near it.',
    'Darken the room so the faint grazing ray remains visible.',
    'Draw the normal accurately at the centre of the flat face.'
  ],
  sourcesOfError: [
    'The refracted ray fades gradually rather than vanishing sharply, so i_c is uncertain by about a degree.',
    'The beam is not perfectly narrow.',
    'The block may not be centred on the marked point.',
    'The protractor is read to only half a degree.'
  ],
  tips: [
    'Raise the cladding index towards the core index and watch the critical angle climb towards 90° — that is why fibre cores and claddings differ only slightly.',
    'Switch to diamond and note the critical angle drop to about 24°.'
  ],
  viva: [
    { q: 'What is total internal reflection?', a: 'The complete reflection of light back into a denser medium when it strikes the boundary with a rarer one at an angle greater than the critical angle.' },
    { q: 'What are the two conditions for it?', a: 'Light must travel from a denser to a rarer medium, and the angle of incidence must exceed the critical angle.' },
    { q: 'Why does a diamond sparkle?', a: 'Its refractive index of 2.417 gives a critical angle of only about 24°, so light entering it is totally internally reflected many times before escaping.' },
    { q: 'How does an optical fibre guide light?', a: 'The core has a higher index than the cladding, so light striking the wall above the critical angle is totally reflected at every bounce and stays in the core.' },
    { q: 'Why is total internal reflection better than a mirror?', a: 'No light is transmitted or absorbed at the boundary, so the reflection is 100% efficient.' }
  ],
  resultTemplate:
    'The refracted ray disappears at the critical angle, and the refractive index computed from n = 1/sin i_c matches the accepted value for the medium.'
};

function model(params: ParamValues) {
  const core = coreOf(str(params, 'core', 'glass'));
  const n2 = Math.min(num(params, 'cladding', 1), core.n - 0.001);
  const i = num(params, 'incidence', 30);

  const ic = criticalAngle(core.n, n2);
  const r = snellRefraction(i, core.n, n2);
  const tir = !Number.isFinite(r);
  // Fresnel-free estimate: reflectance climbs to 1 at the critical angle.
  const reflectance = tir ? 1 : Math.min(1, ((Math.sin(degToRad(i)) * core.n) / n2) ** 6 * 0.9);
  const na = Math.sqrt(Math.max(core.n * core.n - n2 * n2, 0));
  const acceptance = na <= 1 ? (Math.asin(na) * 180) / Math.PI : 90;
  const nFromIc = Number.isFinite(ic) ? n2 / Math.sin(degToRad(ic)) : Number.NaN;

  return { core, n2, i, ic, r, tir, reflectance, na, acceptance, nFromIc };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validateRange('incidence', 'Angle of incidence', m.i, 0, 89),
    validateRange('cladding', 'Refractive index of the outer medium', m.n2, 1, 1.47)
  );
  if (m.n2 >= m.core.n) {
    issues.push({
      field: 'cladding',
      severity: 'error',
      message: 'The outer medium is not rarer than the inner one, so total internal reflection is impossible.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let a = 0; a <= 89; a += 0.5) {
    const rr = snellRefraction(a, m.core.n, m.n2);
    points.push({
      x: a,
      y: Number.isFinite(rr) ? Math.min(1, ((Math.sin(degToRad(a)) * m.core.n) / m.n2) ** 6 * 0.9) : 1
    });
  }

  return {
    readouts: [
      ro('i', 'Angle of incidence i', m.i, '°', 2),
      ro('ic', 'Critical angle i_c', m.ic, '°', 2, { tone: 'normal', sub: `sin i_c = n₂/n₁ = ${(m.n2 / m.core.n).toFixed(4)}` }),
      ro('r', 'Angle of refraction r', m.r, '°', 2, { text: m.tir ? 'none — TIR' : undefined, tone: m.tir ? 'alert' : 'normal' }),
      ro('refl', 'Reflected fraction', m.reflectance, '—', 3, { tone: m.tir ? 'alert' : 'normal', sub: m.tir ? '100 % — total' : 'partial' }),
      ro('n', 'n from 1/sin i_c', m.nFromIc, '—', 4, { sub: `accepted ${m.core.n.toFixed(3)}` }),
      ro('na', 'Numerical aperture', m.na, '—', 4, { sub: `acceptance ${m.acceptance.toFixed(1)}°` })
    ],
    graph: singleSeriesGraph({
      title: 'Reflected fraction against the angle of incidence inside the medium',
      xLabel: 'i (°)',
      yLabel: 'reflected fraction',
      seriesLabel: 'reflectance',
      color: '#6ee7ff',
      points,
      live: { x: m.i, y: m.reflectance },
      guides: [{ axis: 'x', value: m.ic, label: `i_c = ${m.ic.toFixed(1)}°`, color: '#ffc65c' }]
    }),
    issues,
    description: `A ray inside ${m.core.label.toLowerCase()} (n = ${m.core.n.toFixed(3)}) strikes the boundary with a medium of index ${m.n2.toFixed(3)} at ${m.i.toFixed(1)} degrees. ${m.tir ? 'It is beyond the critical angle, so it is totally internally reflected.' : `It emerges at ${m.r.toFixed(2)} degrees.`}`,
    result: `The critical angle for this pair is i_c = sin⁻¹(n₂/n₁) = ${m.ic.toFixed(2)}°. At i = ${m.i.toFixed(1)}° the ray is ${m.tir ? 'totally internally reflected — no light escapes' : `refracted at ${m.r.toFixed(2)}°, with only part of the light reflected`}. The numerical aperture of this core–cladding pair is ${m.na.toFixed(4)}, an acceptance cone of ${m.acceptance.toFixed(1)}°.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const showFibre = params.fibre === true;
  const cx = 380;
  const cy = 280;
  const L = 180;
  const iRad = degToRad(m.i);
  const rRad = Number.isFinite(m.r) ? degToRad(m.r) : 0;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        {m.core.label} (n₁ = {m.core.n.toFixed(3)}) → n₂ = {m.n2.toFixed(3)} · i_c = {m.ic.toFixed(2)}°
      </text>

      {showFibre ? (
        <g>
          {/* An optical fibre: the same physics, bouncing along the core. */}
          <rect x={80} y={150} width={660} height={70} fill="url(#lab-glass)" stroke="#8fc7e8" strokeWidth={1.2} />
          <rect x={80} y={136} width={660} height={14} fill="#243141" />
          <rect x={80} y={220} width={660} height={14} fill="#243141" />
          <text x={748} y={148} fontSize={9.5} fill="#8497ad">cladding n₂</text>
          <text x={748} y={190} fontSize={9.5} fill="#8fc7e8">core n₁</text>
          {Array.from({ length: 7 }, (_, k) => {
            const step = 660 / 7;
            const x1 = 80 + k * step;
            const x2 = x1 + step;
            const y1 = k % 2 === 0 ? 220 : 150;
            const y2 = k % 2 === 0 ? 150 : 220;
            return <Ray key={k} from={{ x: x1, y: y1 }} to={{ x: x2, y: y2 }} color={m.tir ? '#ffd257' : '#ff6b7d'} width={1.8} />;
          })}
          <text x={410} y={252} textAnchor="middle" fontSize={10} fill={m.tir ? '#45d68b' : '#ff6b7d'}>
            {m.tir ? 'guided — every bounce is above the critical angle' : 'leaking — the bounce angle is below the critical angle'}
          </text>
        </g>
      ) : null}

      {/* Semicircular block on the drawing board. */}
      <path d={`M ${cx - 170} ${cy} A 170 170 0 0 0 ${cx + 170} ${cy} Z`} fill="url(#lab-glass)" stroke="#8fc7e8" strokeWidth={1.4} />
      <line x1={cx - 200} y1={cy} x2={cx + 240} y2={cy} stroke="#8fc7e8" strokeWidth={1.6} />
      <line x1={cx} y1={cy - 130} x2={cx} y2={cy + 130} className="normal-line" />

      {/* Ray inside the block, then either refracted out or reflected back. */}
      <Ray
        from={{ x: cx - Math.sin(iRad) * L, y: cy + Math.cos(iRad) * L }}
        to={{ x: cx, y: cy }}
        color="#ffd257"
        width={2}
      />
      <Ray
        from={{ x: cx, y: cy }}
        to={{ x: cx + Math.sin(iRad) * L, y: cy + Math.cos(iRad) * L }}
        color={m.tir ? '#ffd257' : '#ffb454'}
        width={m.tir ? 2.2 : 1.3}
      />
      {!m.tir ? (
        <Ray from={{ x: cx, y: cy }} to={{ x: cx + Math.sin(rRad) * L, y: cy - Math.cos(rRad) * L }} color="#6ee7ff" width={2} />
      ) : null}

      <AngleArc centre={{ x: cx, y: cy }} fromAngleDeg={90} toAngleDeg={90 + m.i} radius={58} label={`i = ${m.i.toFixed(1)}°`} />
      {!m.tir ? (
        <AngleArc centre={{ x: cx, y: cy }} fromAngleDeg={-90} toAngleDeg={-90 + m.r} radius={78} label={`r = ${m.r.toFixed(1)}°`} color="#6ee7ff" />
      ) : null}

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        {m.tir ? `i = ${m.i.toFixed(1)}° > i_c — total internal reflection` : `n₁ sin i = n₂ sin r → refracted at ${m.r.toFixed(2)}°`} · n = 1/sin i_c = {m.nFromIc.toFixed(4)}
      </text>

      <Knob spec={control('incidence', 'slider')} params={params} onChange={set} x={110} y={92} radius={22} label="Angle of incidence inside the medium — turn the dial" />
      <Knob spec={control('cladding', 'slider')} params={params} onChange={set} x={710} y={300} radius={20} label="Refractive index of the outer medium — turn the dial" />
      <StageSegmented spec={control('core', 'segmented')} params={params} onChange={set} x={600} y={92} segmentWidth={76} label="Denser medium" />
    </svg>
  );
}

export default function TotalInternalReflectionExperiment() {
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
            <ViewPill label="i_c" value={m.ic.toFixed(2)} unit="°" />
            <ViewPill label="state" value={m.tir ? 'TIR' : 'refracting'} />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — critical angle for each medium',
          columns: [
            col('medium', 'Medium', '', 0),
            col('n2', 'n₂', '—', 3),
            col('ic', 'i_c', '°', 2),
            col('n', 'n = n₂/sin i_c', '—', 4, true)
          ],
          capture: () => ({ medium: m.core.label, n2: m.n2, ic: m.ic, n: 0 }),
          derive: (row) => ({ ...row, n: Number(row.n2) / Math.sin(degToRad(Number(row.ic))) }),
          comparison: {
            label: `refractive index of ${m.core.label.toLowerCase()}`,
            unit: '—',
            experimental: m.nFromIc,
            theoretical: m.core.n,
            precision: 4
          },
          captureHint: 'Find the angle at which the refracted ray just vanishes, then record.'
        };
      }}
    />
  );
}

export { definition, education };
