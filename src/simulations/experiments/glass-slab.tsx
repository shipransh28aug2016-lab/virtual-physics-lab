import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { Ray, AngleArc } from '@/components/instruments/Instruments';
import { traceSlab } from '@/physics-engine/optics';
import { degToRad } from '@/physics-engine/units';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './glass-slab.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#6ee7ff', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'slider', key: 'i', label: 'Angle of incidence', symbol: 'i', unit: '°', min: 0, max: 80, step: 0.5, initial: 45, precision: 1 },
    { kind: 'slider', key: 't', label: 'Slab thickness', symbol: 't', unit: 'cm', min: 0.5, max: 4, step: 0.1, initial: 1.5, precision: 1 },
    { kind: 'slider', key: 'n', label: 'Refractive index of glass', symbol: 'n', unit: '—', min: 1.3, max: 2, step: 0.01, initial: 1.52 }
  ],
  defaults: { i: 45, t: 1.5, n: 1.52 }
};

const education: EducationPack = {
  theory: [
    'A ray entering a rectangular slab is bent towards the normal, travels through the glass, and is bent away from the normal as it leaves. Because the two faces are parallel the emergent ray is parallel to the incident ray.',
    'The ray is therefore not deviated in direction, only displaced sideways. This perpendicular distance between the incident and emergent rays is the lateral shift.',
    'The shift grows with the thickness of the slab and with the angle of incidence, and vanishes at normal incidence. Measuring it for a known thickness and angle gives the refractive index of the glass.'
  ],
  formulas: [
    { tex: 'n = \\frac{\\sin i}{\\sin r}', caption: 'Snell’s law at the first face.' },
    { tex: 'd = \\frac{t \\sin(i - r)}{\\cos r}', caption: 'Lateral shift through a parallel slab.' },
    { tex: 'e = i', caption: 'The angle of emergence equals the angle of incidence.' }
  ],
  variables: [
    { symbol: 'd', name: 'Lateral shift', unit: 'm' },
    { symbol: 't', name: 'Slab thickness', unit: 'm' },
    { symbol: 'i', name: 'Angle of incidence', unit: '°' },
    { symbol: 'r', name: 'Angle of refraction', unit: '°' },
    { symbol: 'n', name: 'Refractive index', unit: '—' }
  ],
  procedure: [
    'Fix the slab on the paper and trace its outline.',
    'Draw an incident ray at a known angle and fix two pins on it.',
    'Looking through the slab, fix two more pins so that all four appear in one straight line; these mark the emergent ray.',
    'Remove the slab, join the points and measure the lateral shift with a ruler.',
    'Repeat for at least five angles of incidence and plot d against sin(i − r)/cos r; the slope is the thickness.'
  ],
  precautions: ['The slab faces must be parallel and its edges sharp.', 'Pins must be vertical and at least 5 cm apart.', 'Measure the angle from the normal, not the surface.'],
  tips: ['At normal incidence the lateral shift is exactly zero — check it with the slider at 0°.'],
  viva: [
    { q: 'Why is the emergent ray parallel to the incident ray?', a: 'Because the two faces are parallel, the refraction at the second face exactly undoes the angular change made at the first.' },
    { q: 'When is the lateral shift maximum?', a: 'For a given slab, at the largest angle of incidence; for a given angle, for the thickest slab.' },
    { q: 'What is the lateral shift at normal incidence?', a: 'Zero.' },
    { q: 'Does the lateral shift depend on the colour of light?', a: 'Yes, because the refractive index depends on wavelength, so different colours shift by different amounts.' }
  ],
  resultTemplate: 'The measured lateral shift agrees with d = t sin(i − r)/cos r, and the refractive index obtained from sin i / sin r matches the glass used.'
};

const SCALE = 110;

function compute(params: ParamValues): ModelOutput {
  const i = num(params, 'i', 45);
  const t = num(params, 't', 1.5);
  const n = num(params, 'n', 1.52);
  const trace = traceSlab(t / 100, i, n);
  const shift = trace.shift * 100;
  const r = trace.refractedDeg;
  const points: { x: number; y: number }[] = [];
  for (let a = 0; a <= 80; a += 0.5) points.push({ x: a, y: traceSlab(t / 100, a, n).shift * 100 });
  return {
    readouts: [
      ro('shift', 'Lateral shift d', shift, 'cm', 3),
      ro('r', 'Angle of refraction r', r, '°', 2),
      ro('e', 'Angle of emergence e', i, '°', 2, { sub: 'equals i' }),
      ro('n', 'Refractive index', Math.sin(degToRad(i)) / Math.sin(degToRad(r || 1e-9)), '—', 3),
      ro('ratio', 'd / t', shift / t, '—', 3)
    ],
    graph: singleSeriesGraph({
      title: 'Lateral shift against angle of incidence', xLabel: 'i (°)', yLabel: 'd (cm)',
      seriesLabel: 'd', points, live: { x: i, y: shift }
    }),
    description: `A ray enters a glass slab of thickness ${t.toFixed(1)} centimetre and refractive index ${n.toFixed(2)} at ${i.toFixed(1)} degrees. The emergent ray is parallel to the incident ray but displaced by ${shift.toFixed(3)} centimetre.`,
    result: `For t = ${t.toFixed(1)} cm, i = ${i.toFixed(1)}° and n = ${n.toFixed(2)}, the refraction angle is ${r.toFixed(2)}° and the lateral shift is ${shift.toFixed(3)} cm, confirming d = t sin(i − r)/cos r.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const i = num(params, 'i', 45);
  const t = num(params, 't', 1.5);
  const n = num(params, 'n', 1.52);
  const thicknessPx = t * SCALE;
  const x0 = 300;
  const y0 = 100;
  const trace = traceSlab(t / 100, i, n);
  const toPx = (p: { x: number; y: number }) => ({ x: x0 + p.x * SCALE, y: y0 - p.y * SCALE });
  const shiftPx = trace.shift * SCALE;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <rect x={x0} y={y0 - thicknessPx} width={300} height={thicknessPx} fill="url(#lab-glass)" stroke="#8fc7e8" strokeWidth={1.2} />
      <line x1={x0 - 90} y1={y0} x2={x0 + 390} y2={y0} className="dim-line" opacity={0.4} />
      <line x1={x0} y1={y0 - thicknessPx - 70} x2={x0} y2={y0 + 70} className="normal-line" />
      <line x1={x0 + thicknessPx * Math.tan(degToRad(trace.refractedDeg))} y1={y0 - thicknessPx - 70} x2={x0 + thicknessPx * Math.tan(degToRad(trace.refractedDeg))} y2={y0 + 70} className="normal-line" />
      {trace.rays.map((r, k) => (
        <Ray
          key={k}
          from={toPx({ x: r.from.x, y: -r.from.y + 0 })}
          to={toPx({ x: r.to.x, y: -r.to.y })}
          color={r.kind === 'refracted' ? '#6ee7ff' : '#ffd257'}
        />
      ))}
      <line x1={x0 - 20} y1={y0} x2={x0 - 20} y2={y0 - thicknessPx} className="dim-line" />
      <text x={x0 - 26} y={y0 - thicknessPx / 2} textAnchor="end" fontSize={10} className="measure-text">
        t = {t.toFixed(1)} cm
      </text>
      <line x1={x0 + 250} y1={y0} x2={x0 + 250} y2={y0 + shiftPx} stroke="#ff6b7d" strokeWidth={1.6} strokeDasharray="4 3" />
      <text x={x0 + 258} y={y0 + shiftPx / 2 + 4} fontSize={11} fill="#ff6b7d">
        d = {shiftPx > 0 ? `${(trace.shift * 100).toFixed(2)} cm` : '0'}
      </text>
      <AngleArc centre={{ x: x0, y: y0 }} fromAngleDeg={-90} toAngleDeg={-90 + i} radius={52} label={`i = ${i.toFixed(1)}°`} />
      <AngleArc centre={{ x: x0, y: y0 }} fromAngleDeg={90} toAngleDeg={90 - trace.refractedDeg} radius={70} label={`r = ${trace.refractedDeg.toFixed(1)}°`} color="#6ee7ff" />
      <text x={410} y={44} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        Rectangular glass slab · n = {n.toFixed(2)}
      </text>
      <text x={410} y={63} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        emergent ray is parallel to the incident ray
      </text>
      <Knob
        spec={control('i', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={120}
        y={428}
        radius={18}
        label="Angle of incidence i — turn the ray table"
      />
      <Knob
        spec={control('t', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={250}
        y={428}
        radius={18}
        label="Slab thickness t"
      />
        </svg>
  );
}

export default function GlassSlabExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const i = num(p, 'i', 45);
        const t = num(p, 't', 1.5);
        const n = num(p, 'n', 1.52);
        const tr = traceSlab(t / 100, i, n);
        return {
          title: 'Observation table — lateral shift',
          columns: [col('i', 'i', '°', 1), col('r', 'r', '°', 2), col('d', 'd', 'cm', 3), col('n', 'n = sin i/sin r', '—', 3, true)],
          capture: () => ({ i, r: tr.refractedDeg, d: tr.shift * 100, n: 0 }),
          derive: (row) => {
            const r = degToRad(Number(row.r));
            return { ...row, n: Math.abs(Math.sin(r)) < 1e-9 ? Number.NaN : Math.sin(degToRad(Number(row.i))) / Math.sin(r) };
          },
          comparison: { label: 'refractive index', unit: '—', experimental: Math.sin(degToRad(i)) / Math.sin(degToRad(tr.refractedDeg)), theoretical: n, precision: 3 }
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
