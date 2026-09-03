import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { AngleArc, Ray } from '@/components/instruments/Instruments';
import {
  minimumDeviation,
  prismDeviation,
  refractiveIndexFromPrism,
  snellRefraction,
  wavelengthToRgb
} from '@/physics-engine/optics';
import { degToRad } from '@/physics-engine/units';
import { mergeIssues, validateRange } from '@/physics-engine/validation';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './prism-dispersion.meta';

export { meta };

/** Cauchy dispersion for a typical crown-glass prism: n(λ) = A + B/λ². */
const CAUCHY_A = 1.5046;
const CAUCHY_B = 4200; // nm²
const indexAt = (lambdaNm: number) => CAUCHY_A + CAUCHY_B / (lambdaNm * lambdaNm);

/** The Fraunhofer-style lines drawn in the emergent spectrum. */
const SPECTRUM = [
  { nm: 656, name: 'red' },
  { nm: 589, name: 'yellow' },
  { nm: 546, name: 'green' },
  { nm: 486, name: 'blue' },
  { nm: 434, name: 'violet' }
];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  practicalNo: meta.practicalNo, thumbLabel: meta.shortTitle, accent: '#ffd257',
  controls: [
    { kind: 'slider', key: 'incidence', label: 'Angle of incidence', symbol: 'i', unit: '°', min: 25, max: 80, step: 0.5, initial: 45, precision: 1, onStage: true },
    { kind: 'slider', key: 'apex', label: 'Angle of the prism', symbol: 'A', unit: '°', min: 30, max: 70, step: 1, initial: 60, precision: 0, onStage: true },
    { kind: 'slider', key: 'lambda', label: 'Wavelength', symbol: '\\lambda', unit: 'nm', min: 400, max: 700, step: 1, initial: 589, precision: 0, hint: 'Sodium light is 589 nm', onStage: true },
    { kind: 'toggle', key: 'dispersion', label: 'Show the full spectrum', initial: false, onStage: true }
  ],
  defaults: { incidence: 45, apex: 60, lambda: 589, dispersion: false }
};

const education: EducationPack = {
  theory: [
    'A ray entering a prism is refracted at the first face, travels through the glass, and is refracted again at the second face. The total change in its direction is the angle of deviation. It depends on the angle at which the ray strikes the prism, on the refracting angle of the prism and on the refractive index of the glass.',
    'As the angle of incidence is increased from a small value, the deviation first falls, reaches a minimum, and then rises again. At that minimum the ray passes symmetrically through the prism: the angle of incidence equals the angle of emergence and the refracted ray inside the glass is parallel to the base.',
    'That symmetry is what makes the minimum useful. Substituting i = e and r₁ = r₂ = A/2 into the geometry gives the prism formula, from which the refractive index follows from two angles that can both be read off a spectrometer.',
    'Because the refractive index of glass is larger for shorter wavelengths, violet light is deviated more than red. A single white ray therefore leaves the prism spread into a spectrum, and the angle of minimum deviation is different for every colour.'
  ],
  formulas: [
    { tex: '\\delta = i + e - A', caption: 'Deviation produced by a prism.' },
    { tex: 'r_1 + r_2 = A', caption: 'Geometry of the two refractions inside the prism.' },
    { tex: 'n = \\frac{\\sin\\frac{A + \\delta_m}{2}}{\\sin\\frac{A}{2}}', caption: 'Prism formula at minimum deviation.' },
    { tex: 'n(\\lambda) = A + \\frac{B}{\\lambda^2}', caption: 'Cauchy’s dispersion relation for the glass.' }
  ],
  variables: [
    { symbol: 'i', name: 'Angle of incidence', unit: '°' },
    { symbol: 'e', name: 'Angle of emergence', unit: '°' },
    { symbol: 'A', name: 'Refracting angle of the prism', unit: '°' },
    { symbol: '\\delta', name: 'Angle of deviation', unit: '°' },
    { symbol: '\\delta_m', name: 'Angle of minimum deviation', unit: '°' },
    { symbol: 'n', name: 'Refractive index of the glass', unit: '—' }
  ],
  procedure: [
    'Fix a sheet of white paper on the drawing board and draw the outline of the prism on it.',
    'Draw a normal at a point on the first face and mark an incident ray at a chosen angle.',
    'Fix two pins on the incident ray, then look through the second face and fix two more pins in line with the images of the first two.',
    'Remove the prism and complete the ray path; measure the angle of deviation with a protractor.',
    'Repeat for angles of incidence from about 30° to 70° in steps of 5°.',
    'Plot the angle of deviation against the angle of incidence; the curve has a clear minimum.',
    'Read δ_m from the lowest point of the curve and compute n from the prism formula.'
  ],
  precautions: [
    'Keep the pins vertical and at least 8 cm apart so the line of sight is well defined.',
    'Do not move the prism once the outline has been drawn.',
    'Take readings on both sides of the minimum so the lowest point of the curve is well fixed.',
    'Draw the normal accurately — an error in the normal doubles into the measured angles.'
  ],
  sourcesOfError: [
    'The pin holes have a finite size, so the ray directions carry an uncertainty of about half a degree.',
    'The prism outline may shift slightly while the pins are being fixed.',
    'The minimum of the δ–i curve is flat, so δ_m is read from a shallow region.',
    'The refracting angle A itself is measured with a protractor and carries its own error.'
  ],
  tips: [
    'Sweep the angle of incidence and watch the deviation fall to a minimum and rise again — the curve is not symmetric about it.',
    'Switch on the full spectrum and note that violet always sits below red: it is deviated more.'
  ],
  viva: [
    { q: 'What happens to the deviation as the angle of incidence increases?', a: 'It first decreases, passes through a minimum, and then increases again.' },
    { q: 'What is special about the ray at minimum deviation?', a: 'It passes symmetrically through the prism: i = e, r₁ = r₂ = A/2, and the ray inside the glass is parallel to the base.' },
    { q: 'Why is violet deviated more than red?', a: 'The refractive index of glass is greater for shorter wavelengths, so violet bends more at each face.' },
    { q: 'Does the deviation depend on the material of the prism?', a: 'Yes — through the refractive index, which is why the same experiment measures n.' },
    { q: 'What is the angular dispersion of a prism?', a: 'The difference between the deviations of the violet and the red rays, δ_v − δ_r.' }
  ],
  resultTemplate:
    'The graph of deviation against angle of incidence shows a clear minimum; the refractive index computed from A and δ_m by the prism formula matches the accepted value for the glass.'
};

function model(params: ParamValues) {
  const i = num(params, 'incidence', 45);
  const apex = num(params, 'apex', 60);
  const lambda = num(params, 'lambda', 589);
  const n = indexAt(lambda);

  const r1 = snellRefraction(i, 1, n);
  const r2 = Number.isFinite(r1) ? apex - r1 : Number.NaN;
  const e = Number.isFinite(r2) ? snellRefraction(r2, n, 1) : Number.NaN;
  const deviation = prismDeviation(i, apex, n);
  const deltaMin = minimumDeviation(apex, n);
  // The angle of incidence that produces the minimum, from the symmetric case.
  const iMin = Number.isFinite(deltaMin) ? (apex + deltaMin) / 2 : Number.NaN;
  const nFromFormula = refractiveIndexFromPrism(apex, deltaMin);

  return { i, apex, lambda, n, r1, r2, e, deviation, deltaMin, iMin, nFromFormula };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validateRange('apex', 'Angle of the prism', m.apex, 30, 70),
    validateRange('incidence', 'Angle of incidence', m.i, 25, 80)
  );
  if (!Number.isFinite(m.e)) {
    issues.push({
      field: 'incidence',
      severity: 'warning',
      message: 'The ray is totally internally reflected at the second face and never emerges. Increase the angle of incidence past the grazing limit.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let a = 25; a <= 80; a += 0.5) {
    const d = prismDeviation(a, m.apex, m.n);
    if (Number.isFinite(d)) points.push({ x: a, y: d });
  }

  return {
    readouts: [
      ro('i', 'Angle of incidence i', m.i, '°', 1),
      ro('r1', 'Refraction at first face r₁', m.r1, '°', 2),
      ro('r2', 'Incidence at second face r₂', m.r2, '°', 2, { tone: Number.isFinite(m.e) ? 'normal' : 'alert' }),
      ro('e', 'Angle of emergence e', m.e, '°', 2, { text: Number.isFinite(m.e) ? undefined : 'TIR' }),
      ro('d', 'Deviation δ', m.deviation, '°', 2, { tone: Math.abs(m.i - m.iMin) < 1 ? 'alert' : 'normal', sub: Math.abs(m.i - m.iMin) < 1 ? 'at the minimum' : '' }),
      ro('dm', 'Minimum deviation δₘ', m.deltaMin, '°', 2, { sub: `at i = ${m.iMin.toFixed(1)}°` }),
      ro('n', 'Refractive index n', m.nFromFormula, '—', 4, { sub: `λ = ${m.lambda} nm` })
    ],
    graph: singleSeriesGraph({
      title: 'Angle of deviation against angle of incidence',
      xLabel: 'i (°)',
      yLabel: 'δ (°)',
      seriesLabel: 'δ = i + e − A',
      color: '#ffd257',
      points,
      live: Number.isFinite(m.deviation) ? { x: m.i, y: m.deviation } : undefined,
      guides: [{ axis: 'y', value: m.deltaMin, label: `δₘ = ${m.deltaMin.toFixed(2)}°`, color: '#45d68b' }],
      markers: [{ x: m.iMin, y: m.deltaMin, label: 'minimum', color: '#45d68b' }]
    }),
    issues,
    description: `A ray of ${m.lambda} nanometre light strikes a ${m.apex.toFixed(0)} degree prism of refractive index ${m.n.toFixed(4)} at ${m.i.toFixed(1)} degrees. It is refracted at ${m.r1.toFixed(2)} degrees inside the glass and ${Number.isFinite(m.e) ? `emerges at ${m.e.toFixed(2)} degrees` : 'is totally internally reflected at the second face'}.`,
    result: `The deviation is least at i = ${m.iMin.toFixed(1)}°, where δₘ = ${m.deltaMin.toFixed(2)}°. The prism formula then gives n = sin((A + δₘ)/2)/sin(A/2) = ${m.nFromFormula.toFixed(4)} for λ = ${m.lambda} nm.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const apexRad = degToRad(m.apex);
  // Prism drawn as an isosceles triangle with its apex angle A at the top.
  const half = 150 * Math.tan(apexRad / 2);
  const apexPt = { x: 410, y: 190 };
  const baseL = { x: apexPt.x - half, y: apexPt.y + 150 };
  const baseR = { x: apexPt.x + half, y: apexPt.y + 150 };

  // Hit point on the left face, one third down from the apex.
  const hit = { x: apexPt.x + (baseL.x - apexPt.x) * 0.55, y: apexPt.y + (baseL.y - apexPt.y) * 0.55 };
  // Outward normal of the left face.
  const faceAngle = Math.atan2(baseL.y - apexPt.y, baseL.x - apexPt.x);
  const normalAngle = faceAngle - Math.PI / 2;

  const inDir = normalAngle + Math.PI - degToRad(m.i);
  const inStart = { x: hit.x - Math.cos(inDir) * 160, y: hit.y - Math.sin(inDir) * 160 };

  const lines = params.dispersion ? SPECTRUM : [{ nm: m.lambda, name: 'ray' }];

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={40} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Prism · A = {m.apex.toFixed(0)}° · i = {m.i.toFixed(1)}° · δ = {Number.isFinite(m.deviation) ? `${m.deviation.toFixed(2)}°` : 'TIR'}
      </text>

      <polygon
        points={`${apexPt.x},${apexPt.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`}
        fill="url(#lab-glass)"
        stroke="#8fc7e8"
        strokeWidth={1.4}
      />

      {/* Normal at the point of incidence. */}
      <line
        x1={hit.x - Math.cos(normalAngle) * 60}
        y1={hit.y - Math.sin(normalAngle) * 60}
        x2={hit.x + Math.cos(normalAngle) * 60}
        y2={hit.y + Math.sin(normalAngle) * 60}
        className="normal-line"
      />

      <Ray from={inStart} to={hit} color="#ffffff" width={2} />

      {lines.map((line) => {
        const n = indexAt(line.nm);
        const r1 = snellRefraction(m.i, 1, n);
        if (!Number.isFinite(r1)) return null;
        const r2 = m.apex - r1;
        const e = snellRefraction(r2, n, 1);
        const rgb = wavelengthToRgb(line.nm);
        const colour = params.dispersion ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '#ffd257';

        // Inside the glass the ray runs at r1 from the normal of the first face.
        const insideDir = normalAngle + degToRad(r1);
        const exit = { x: hit.x + Math.cos(insideDir) * 190, y: hit.y + Math.sin(insideDir) * 190 };

        if (!Number.isFinite(e)) {
          return <Ray key={line.nm} from={hit} to={exit} color={colour} width={1.6} />;
        }
        // Emergent ray, deviated from the incident direction by δ.
        const outDir = inDir + degToRad(m.i + e - m.apex);
        const out = { x: exit.x + Math.cos(outDir) * 200, y: exit.y + Math.sin(outDir) * 200 };
        return (
          <g key={line.nm}>
            <Ray from={hit} to={exit} color={colour} width={1.6} />
            <Ray from={exit} to={out} color={colour} width={1.8} />
          </g>
        );
      })}

      {/* The undeviated continuation, so the deviation is visible as an angle. */}
      <line
        x1={hit.x}
        y1={hit.y}
        x2={hit.x + Math.cos(inDir) * 340}
        y2={hit.y + Math.sin(inDir) * 340}
        className="dim-line"
      />

      <AngleArc
        centre={hit}
        fromAngleDeg={(normalAngle * 180) / Math.PI + 180}
        toAngleDeg={(inDir * 180) / Math.PI + 180}
        radius={48}
        label={`i = ${m.i.toFixed(1)}°`}
      />
      <text x={apexPt.x} y={apexPt.y - 12} textAnchor="middle" fontSize={11} fill="#8fc7e8">
        A = {m.apex.toFixed(0)}°
      </text>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        n = sin((A+δₘ)/2)/sin(A/2) = {m.nFromFormula.toFixed(4)} · δₘ = {m.deltaMin.toFixed(2)}° at i = {m.iMin.toFixed(1)}°
      </text>

      <Knob spec={control('incidence', 'slider')} params={params} onChange={set} x={110} y={80} radius={20} label="Angle of incidence — turn the dial" />
      <Knob spec={control('apex', 'slider')} params={params} onChange={set} x={240} y={80} radius={18} label="Refracting angle of the prism — turn the dial" />
      <Knob spec={control('lambda', 'slider')} params={params} onChange={set} x={700} y={80} radius={20} label="Wavelength of the light — turn the dial" />
    </svg>
  );
}

export default function PrismDispersionExperiment() {
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
            <ViewPill label="δ" value={Number.isFinite(m.deviation) ? m.deviation.toFixed(2) : 'TIR'} unit="°" />
            <ViewPill label="n" value={m.nFromFormula.toFixed(4)} />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — deviation against angle of incidence',
          columns: [
            col('i', 'i', '°', 1),
            col('e', 'e', '°', 2),
            col('a', 'A', '°', 0),
            col('d', 'δ = i + e − A', '°', 2, true)
          ],
          capture: () => ({ i: m.i, e: m.e, a: m.apex, d: 0 }),
          derive: (row) => ({ ...row, d: Number(row.i) + Number(row.e) - Number(row.a) }),
          comparison: {
            label: 'refractive index',
            unit: '—',
            experimental: m.nFromFormula,
            theoretical: m.n,
            precision: 4
          },
          captureEnabled: Number.isFinite(m.e),
          captureHint: 'Step the angle of incidence through the range and record each deviation.'
        };
      }}
    />
  );
}

export { definition, education };
