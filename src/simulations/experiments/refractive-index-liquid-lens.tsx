import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { LensSvg, Ray } from '@/components/instruments/Instruments';
import { lensesInContact } from '@/physics-engine/optics';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { col, num, ro, str, singleSeriesGraph } from './_shared';
import { DragY, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './refractive-index-liquid-lens.meta';

export { meta };

/** Liquids offered on the bench, with their accepted refractive indices. */
const LIQUIDS = [
  { value: 'water', label: 'Water', n: 1.333 },
  { value: 'glycerine', label: 'Glycerine', n: 1.473 },
  { value: 'oil', label: 'Turpentine oil', n: 1.472 }
] as const;

const liquidOf = (key: string) => LIQUIDS.find((l) => l.value === key) ?? LIQUIDS[0];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  practicalNo: meta.practicalNo, thumbLabel: meta.shortTitle, accent: '#6ee7ff',
  controls: [
    { kind: 'segmented', key: 'liquid', label: 'Liquid under test', initial: 'water', options: LIQUIDS.map((l) => ({ value: l.value, label: l.label })) },
    { kind: 'toggle', key: 'withLiquid', label: 'Liquid film present', initial: false, onStage: true, hint: 'Take f₁ dry first, then add a drop of liquid' },
    { kind: 'slider', key: 'f1', label: 'Focal length of the convex lens', symbol: 'f_1', unit: 'cm', min: 10, max: 30, step: 0.5, initial: 20, precision: 1, onStage: true },
    { kind: 'slider', key: 'roc', label: 'Radius of the lower face', symbol: 'R', unit: 'cm', min: 12, max: 40, step: 0.5, initial: 20.6, precision: 1, hint: 'Equiconvex lens: R = 2f₁(n_g − 1)', onStage: true },
    { kind: 'slider', key: 'needle', label: 'Needle height above the lens', symbol: 'h', unit: 'cm', min: 5, max: 45, step: 0.1, initial: 20, precision: 1, onStage: true }
  ],
  defaults: { liquid: 'water', withLiquid: false, f1: 20, roc: 20.6, needle: 20 }
};

const education: EducationPack = {
  theory: [
    'A convex lens resting on a plane mirror forms a real image of an object needle in the same plane as the needle itself when the needle is at the focus of the lens. Light from the needle leaves the lens as a parallel beam, is reflected straight back by the mirror, and is brought to a focus again at the needle. Removing the parallax between the needle and its image locates the focal length directly.',
    'If a drop of liquid is placed between the lens and the mirror, it forms a plano-concave liquid lens whose curved upper face matches the lower face of the glass lens. The glass lens and the liquid lens are now in contact, so their powers add and the combination has a longer focal length.',
    'Measuring the focal length of the glass lens alone and of the combination therefore gives the focal length of the liquid lens by the law of combination in contact. Because one face of the liquid lens is plane and the other has the radius of the glass lens, the lens-maker equation then gives its refractive index in a single step.',
    'The whole method works with two length measurements taken by the same parallax technique, which is why it is far more accurate than trying to measure a liquid film directly.'
  ],
  formulas: [
    { tex: '\\frac{1}{F} = \\frac{1}{f_1} + \\frac{1}{f_2}', caption: 'Lenses in contact: the glass lens and the liquid lens.' },
    { tex: 'f_2 = \\frac{f_1 F}{f_1 - F}', caption: 'Focal length of the liquid lens from the two measurements.' },
    { tex: 'n = 1 - \\frac{R}{f_2}', caption: 'Lens-maker equation for a plano-concave liquid lens of radius R.' },
    { tex: 'R = 2f_1(n_g - 1)', caption: 'Radius of an equiconvex glass lens of index n_g.' }
  ],
  variables: [
    { symbol: 'f_1', name: 'Focal length of the convex lens', unit: 'm' },
    { symbol: 'F', name: 'Focal length of the combination', unit: 'm' },
    { symbol: 'f_2', name: 'Focal length of the liquid lens', unit: 'm', note: 'Negative — the liquid lens is diverging' },
    { symbol: 'R', name: 'Radius of curvature of the lower face', unit: 'm' },
    { symbol: 'n', name: 'Refractive index of the liquid', unit: '—' }
  ],
  procedure: [
    'Place the convex lens on the plane mirror and clamp the object needle horizontally above it.',
    'Move the needle up and down until there is no parallax between it and its inverted image; note the distance from the lens — this is f₁.',
    'Lift the lens, put a few drops of the liquid on the mirror, and replace the lens so a thin film spreads under it.',
    'Repeat the parallax setting; the new distance is F, the focal length of the combination.',
    'Compute f₂ = f₁F/(f₁ − F) for the liquid lens.',
    'Measure the radius of curvature R of the lower face of the glass lens and compute n = 1 − R/f₂.',
    'Repeat the whole set three times and take the mean.'
  ],
  precautions: [
    'Use only a thin film of liquid; a thick layer is no longer a thin lens.',
    'The tip of the needle must lie on the principal axis of the lens.',
    'Remove parallax by moving the eye from side to side, not by judging sharpness.',
    'Measure the distance from the needle tip to the optical centre of the lens, not to its top surface.'
  ],
  sourcesOfError: [
    'The liquid film has a finite thickness, so the two lenses are not strictly in contact.',
    'Judging the no-parallax position, which is the dominant error.',
    'The lens may not be exactly equiconvex, so R differs for the two faces.',
    'Evaporation of a volatile liquid changes the film during a long set of readings.'
  ],
  tips: [
    'Add the liquid and watch the no-parallax position move further from the lens — the combination is weaker.',
    'Try glycerine after water: the higher index gives a stronger diverging liquid lens and a bigger change in F.'
  ],
  viva: [
    { q: 'Why is the liquid lens plano-concave?', a: 'Its lower face rests on the plane mirror and its upper face takes the convex shape of the lens above it, so it is plane on one side and concave on the other.' },
    { q: 'Why does the focal length increase when the liquid is added?', a: 'The liquid lens is diverging, so its negative power reduces the total power of the combination.' },
    { q: 'What is the role of the plane mirror?', a: 'It reflects the parallel beam straight back so that the image is formed in the plane of the object, which makes the no-parallax setting possible.' },
    { q: 'How is parallax removed?', a: 'By moving the eye sideways: when the needle and its image move together, there is no parallax and they lie in the same plane.' },
    { q: 'Why must the liquid film be thin?', a: 'The thin-lens formula and the law of combination in contact both assume negligible thickness.' }
  ],
  resultTemplate:
    'The refractive index of the liquid computed from f₁, F and R agrees with its accepted value.'
};

function model(params: ParamValues) {
  const liquid = liquidOf(str(params, 'liquid', 'water'));
  const f1 = num(params, 'f1', 20);
  const roc = num(params, 'roc', 20.6);
  const needle = num(params, 'needle', 20);
  const withLiquid = params.withLiquid === true;

  // Plano-concave liquid lens: 1/f₂ = (n − 1)(1/∞ − 1/(−R)) = −(n − 1)/R.
  const f2 = -roc / (liquid.n - 1);
  const combination = lensesInContact(f1, f2);
  const target = withLiquid ? combination : f1;

  const parallax = Math.abs(needle - target);
  const sharpness = 1 / (1 + (parallax / 0.6) ** 2);
  // n recovered from the two focal lengths, exactly as the student would.
  const f2Measured = f1 === target ? Number.NaN : (f1 * target) / (f1 - target);
  const nMeasured = withLiquid ? 1 - roc / f2Measured : Number.NaN;

  return { liquid, f1, roc, needle, withLiquid, f2, combination, target, parallax, sharpness, f2Measured, nMeasured };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('f1', 'Focal length of the convex lens', m.f1),
    validatePositive('roc', 'Radius of the lower face', m.roc),
    validateRange('needle', 'Needle height', m.needle, 5, 45)
  );
  if (m.withLiquid && m.combination > 45) {
    issues.push({
      field: 'roc',
      severity: 'warning',
      message: `The combination has a focal length of ${m.combination.toFixed(1)} cm, beyond the travel of the stand. Use a shorter-focus lens.`
    });
  }
  if (m.sharpness < 0.5) {
    issues.push({
      field: 'needle',
      severity: 'info',
      message: `There is still parallax of ${m.parallax.toFixed(2)} cm. Move the needle towards ${m.target.toFixed(2)} cm.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let h = 5; h <= 45; h += 0.25) {
    points.push({ x: h, y: 1 / (1 + (Math.abs(h - m.target) / 0.6) ** 2) });
  }

  return {
    readouts: [
      ro('setup', 'Setup', 0, '', 0, { text: m.withLiquid ? `LENS + ${m.liquid.label.toUpperCase()}` : 'LENS ALONE' }),
      ro('h', 'Needle height h', m.needle, 'cm', 2, { sub: `no parallax at ${m.target.toFixed(2)} cm` }),
      ro('par', 'Parallax', m.sharpness, '', 2, { tone: m.sharpness > 0.8 ? 'normal' : 'alert', text: m.sharpness > 0.8 ? 'REMOVED' : 'present' }),
      ro('f1', 'f₁ (lens alone)', m.f1, 'cm', 2),
      ro('F', 'F (combination)', m.combination, 'cm', 2),
      ro('f2', 'f₂ (liquid lens)', m.f2, 'cm', 2, { tone: 'neg', sub: 'diverging' }),
      ro('n', 'Refractive index n', m.withLiquid ? m.nMeasured : Number.NaN, '—', 4, { text: m.withLiquid ? undefined : 'add liquid' })
    ],
    graph: singleSeriesGraph({
      title: 'Sharpness of the no-parallax setting against needle height',
      xLabel: 'h (cm)',
      yLabel: 'coincidence',
      seriesLabel: 'parallax removal',
      color: '#6ee7ff',
      points,
      live: { x: m.needle, y: m.sharpness },
      guides: [
        { axis: 'x', value: m.f1, label: 'f₁', color: '#45d68b' },
        { axis: 'x', value: m.combination, label: 'F', color: '#ffc65c' }
      ]
    }),
    issues,
    description: `A convex lens of focal length ${m.f1.toFixed(1)} centimetre rests on a plane mirror${m.withLiquid ? ` over a film of ${m.liquid.label.toLowerCase()}` : ''}. The object needle is ${m.needle.toFixed(2)} centimetre above the lens.`,
    result: m.withLiquid
      ? `With the liquid film the no-parallax position moves to F = ${m.combination.toFixed(2)} cm. From f₂ = f₁F/(f₁ − F) = ${m.f2Measured.toFixed(2)} cm and R = ${m.roc.toFixed(1)} cm, n = 1 − R/f₂ = ${m.nMeasured.toFixed(4)}; the accepted value for ${m.liquid.label.toLowerCase()} is ${m.liquid.n.toFixed(3)}.`
      : `Without the liquid the image coincides with the needle at ${m.f1.toFixed(2)} cm, which is the focal length of the convex lens. Switch on the liquid film to find F.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const scale = 7.4;
  const mirrorY = 380;
  const lensY = mirrorY - 26;
  const needleY = lensY - m.needle * scale;
  const coincident = m.sharpness > 0.8;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Convex lens on a plane mirror {m.withLiquid ? `· ${m.liquid.label} film` : '· dry'}
      </text>

      {/* Plane mirror on the bench. */}
      <rect x={280} y={mirrorY} width={260} height={14} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={1.2} />
      <text x={556} y={mirrorY + 12} fontSize={10} fill="#8497ad">plane mirror</text>

      {/* Liquid film between the mirror and the lens. */}
      {m.withLiquid ? (
        <path
          d={`M 320 ${mirrorY} Q 410 ${mirrorY - 16} 500 ${mirrorY} Z`}
          fill="#6ee7ff"
          opacity={0.32}
          stroke="#6ee7ff"
          strokeWidth={1}
        />
      ) : null}

      <g transform={`translate(0 ${lensY - 190})`}>
        <LensSvg x={410} y={190} height={120} thickness={22} convex label="convex lens" />
      </g>

      {/* Object needle and its image, drawn from the model's parallax state. */}
      <line x1={410} y1={needleY} x2={410} y2={needleY + 30} stroke="#45d68b" strokeWidth={2.6} />
      <path d={`M 405 ${needleY + 8} L 410 ${needleY} L 415 ${needleY + 8} Z`} fill="#45d68b" />
      <text x={424} y={needleY + 6} fontSize={10} fill="#45d68b">needle</text>

      <g opacity={coincident ? 1 : 0.55}>
        <line
          x1={coincident ? 410 : 442}
          y1={lensY - m.target * scale}
          x2={coincident ? 410 : 442}
          y2={lensY - m.target * scale + 30}
          stroke={coincident ? '#ffc65c' : '#ff6b7d'}
          strokeWidth={2.2}
          strokeDasharray="5 3"
        />
        <text x={coincident ? 396 : 452} y={lensY - m.target * scale + 6} textAnchor={coincident ? 'end' : 'start'} fontSize={10} fill={coincident ? '#ffc65c' : '#ff6b7d'}>
          image
        </text>
      </g>

      {/* Parallel beam between the lens and the mirror when set at the focus. */}
      {coincident
        ? [-34, 0, 34].map((dx) => (
            <g key={dx}>
              <Ray from={{ x: 410, y: needleY + 14 }} to={{ x: 410 + dx, y: lensY - 6 }} color="#ffd257" width={1.4} />
              <line x1={410 + dx} y1={lensY + 6} x2={410 + dx} y2={mirrorY} stroke="#ffd257" strokeWidth={1.4} />
            </g>
          ))
        : null}

      <line x1={640} y1={lensY} x2={640} y2={lensY - 45 * scale} className="dim-line" />
      <line x1={632} y1={lensY} x2={648} y2={lensY} stroke="#5e7189" strokeWidth={1.2} />
      <text x={654} y={lensY - m.needle * scale / 2} fontSize={10} fill="#8497ad">
        h = {m.needle.toFixed(2)} cm
      </text>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        f₁ = {m.f1.toFixed(2)} cm · F = {m.combination.toFixed(2)} cm · f₂ = {m.f2.toFixed(2)} cm · R = {m.roc.toFixed(1)} cm
      </text>

      <Knob spec={control('f1', 'slider')} params={params} onChange={set} x={110} y={90} radius={20} label="Focal length of the convex lens — turn the dial" />
      <Knob spec={control('roc', 'slider')} params={params} onChange={set} x={240} y={90} radius={18} label="Radius of curvature of the lower face — turn the dial" />
      {/* The needle clamp is the control: slide it to remove the parallax. */}
      <DragY
        spec={control('needle', 'slider')}
        params={params}
        onChange={set}
        x={700}
        y={lensY}
        height={45 * scale}
        mapping={{ toValue: (dy) => -dy / scale, invert: (h) => lensY - h * scale }}
        label="Needle clamp — drag up and down to remove the parallax"
      />
    </svg>
  );
}

export default function RefractiveIndexLiquidLensExperiment() {
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
            <ViewPill label="h" value={m.needle.toFixed(2)} unit="cm" />
            <ViewPill label="n" value={m.withLiquid ? m.nMeasured.toFixed(3) : '—'} />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — no-parallax distances',
          columns: [
            col('setup', 'Setup', '', 0),
            col('d', 'Distance', 'cm', 2),
            col('f1', 'f₁', 'cm', 2),
            col('F', 'F', 'cm', 2),
            col('f2', 'f₂ = f₁F/(f₁−F)', 'cm', 2, true),
            col('n', 'n = 1 − R/f₂', '—', 4, true)
          ],
          capture: () => ({
            setup: m.withLiquid ? `lens + ${m.liquid.label.toLowerCase()}` : 'lens alone',
            d: m.target,
            f1: m.f1,
            F: m.withLiquid ? m.combination : Number.NaN,
            f2: 0,
            n: 0
          }),
          derive: (row) => {
            const f1 = Number(row.f1);
            const F = Number(row.F);
            const f2 = (f1 * F) / (f1 - F);
            return { ...row, f2, n: 1 - m.roc / f2 };
          },
          comparison: {
            label: `refractive index of ${m.liquid.label.toLowerCase()}`,
            unit: '—',
            experimental: m.nMeasured,
            theoretical: m.liquid.n,
            precision: 4
          },
          captureEnabled: m.sharpness > 0.8,
          captureHint: 'Remove the parallax first — dry for f₁, then with the liquid film for F.'
        };
      }}
    />
  );
}

export { definition, education };
