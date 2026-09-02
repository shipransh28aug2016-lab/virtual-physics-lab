import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { MirrorSvg, Ray } from '@/components/instruments/Instruments';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { col, num, ro, str, singleSeriesGraph } from './_shared';
import { DragY, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './refractive-index-water.meta';

export { meta };

const LIQUIDS = [
  { value: 'water', label: 'Water', n: 1.333 },
  { value: 'saltwater', label: 'Salt solution', n: 1.378 },
  { value: 'glycerine', label: 'Glycerine', n: 1.473 }
] as const;

const liquidOf = (key: string) => LIQUIDS.find((l) => l.value === key) ?? LIQUIDS[0];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  practicalNo: meta.practicalNo, thumbLabel: meta.shortTitle, accent: '#6ee7ff',
  controls: [
    { kind: 'segmented', key: 'liquid', label: 'Liquid in the mirror', initial: 'water', options: LIQUIDS.map((l) => ({ value: l.value, label: l.label })) },
    { kind: 'toggle', key: 'filled', label: 'Liquid poured in', initial: false, onStage: true, hint: 'Find the centre of curvature dry first' },
    { kind: 'slider', key: 'radius', label: 'Radius of curvature', symbol: 'R', unit: 'cm', min: 15, max: 45, step: 0.5, initial: 30, precision: 1, onStage: true },
    { kind: 'slider', key: 'needle', label: 'Needle height above the pole', symbol: 'h', unit: 'cm', min: 8, max: 48, step: 0.1, initial: 30, precision: 1, onStage: true }
  ],
  defaults: { liquid: 'water', filled: false, radius: 30, needle: 30 }
};

const education: EducationPack = {
  theory: [
    'A needle held above a concave mirror coincides with its own image when it sits at the centre of curvature. Rays from the tip then strike the mirror normally and retrace their path, so the image forms exactly where the object is and there is no parallax between them. That distance is the radius of curvature R.',
    'Pour a little liquid into the concave mirror and the situation changes. A ray from the needle is now refracted on entering the liquid, reflected by the mirror, and refracted again on the way out. For the image to coincide with the object the ray must still meet the mirror normally, which happens for a needle placed nearer the mirror than before.',
    'The apparent position of the centre of curvature seen through the liquid is at the new no-parallax distance h. Because the layer of liquid is shallow, the geometry reduces to the familiar apparent-depth relation, so the refractive index is simply the ratio of the two distances.',
    'The method needs no protractor and no angle measurement at all: two lengths measured by the same parallax technique give the refractive index of the liquid.'
  ],
  formulas: [
    { tex: 'n = \\frac{R}{h}', caption: 'Refractive index from the two no-parallax distances.' },
    { tex: 'R = 2f', caption: 'The centre of curvature is twice the focal length from the pole.' },
    { tex: 'n = \\frac{\\text{real depth}}{\\text{apparent depth}}', caption: 'The same relation in the apparent-depth form.' }
  ],
  variables: [
    { symbol: 'R', name: 'Radius of curvature of the mirror', unit: 'm', note: 'No-parallax distance with the mirror dry' },
    { symbol: 'h', name: 'No-parallax distance with the liquid', unit: 'm' },
    { symbol: 'n', name: 'Refractive index of the liquid', unit: '—' },
    { symbol: 'f', name: 'Focal length of the mirror', unit: 'm' }
  ],
  procedure: [
    'Clamp the concave mirror horizontally with its reflecting surface upwards, and fix the object needle above it.',
    'Move the needle up and down until there is no parallax between it and its inverted image; note the distance from the pole — this is R.',
    'Pour a small quantity of the liquid into the mirror so it forms a shallow layer.',
    'Repeat the parallax setting; the new distance is h.',
    'Compute n = R/h and repeat the whole set three times.',
    'Change the liquid and repeat to compare refractive indices.'
  ],
  precautions: [
    'Use only a shallow layer of liquid; a deep layer breaks the thin-layer approximation.',
    'The needle tip must lie on the principal axis of the mirror.',
    'Remove parallax by moving the eye sideways, not by judging which image looks sharper.',
    'Measure the distances from the tip of the needle to the pole of the mirror.'
  ],
  sourcesOfError: [
    'The liquid layer has a finite depth, which shifts the effective mirror surface.',
    'Judging the no-parallax position, the dominant error in the experiment.',
    'The mirror may not be exactly spherical near its edge.',
    'Evaporation or a change in temperature alters the refractive index during a long run.'
  ],
  tips: [
    'Pour the liquid in and watch the no-parallax position drop by a third for water — that factor is 1/n.',
    'Switch to glycerine and see the distance fall further; the denser the liquid, the larger the shift.'
  ],
  viva: [
    { q: 'Why does the image coincide with the object at the centre of curvature?', a: 'Rays from a point there strike the mirror along the normal and retrace their own path, so they reconverge at the same point.' },
    { q: 'Why does the no-parallax distance decrease when the liquid is added?', a: 'The liquid makes the mirror appear shallower; the apparent centre of curvature moves closer to the pole by the factor 1/n.' },
    { q: 'Why must the liquid layer be thin?', a: 'The simple ratio n = R/h assumes the refraction happens at a single shallow surface.' },
    { q: 'Can this method be used for an opaque liquid?', a: 'No. The light must pass through the liquid twice, so it has to be transparent.' },
    { q: 'What is meant by no parallax?', a: 'When the object and its image lie in the same plane, they move together as the eye moves sideways.' }
  ],
  resultTemplate:
    'The ratio of the no-parallax distance with the dry mirror to that with the liquid gives the refractive index of the liquid.'
};

function model(params: ParamValues) {
  const liquid = liquidOf(str(params, 'liquid', 'water'));
  const radius = num(params, 'radius', 30);
  const needle = num(params, 'needle', 30);
  const filled = params.filled === true;

  const target = filled ? radius / liquid.n : radius;
  const parallax = Math.abs(needle - target);
  const sharpness = 1 / (1 + (parallax / 0.6) ** 2);
  const nMeasured = filled && needle > 0 ? radius / target : Number.NaN;

  return { liquid, radius, needle, filled, target, parallax, sharpness, nMeasured };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('radius', 'Radius of curvature', m.radius),
    validateRange('needle', 'Needle height', m.needle, 8, 48)
  );
  if (m.sharpness < 0.5) {
    issues.push({
      field: 'needle',
      severity: 'info',
      message: `Parallax of ${m.parallax.toFixed(2)} cm remains. Move the needle towards ${m.target.toFixed(2)} cm.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let h = 8; h <= 48; h += 0.25) {
    points.push({ x: h, y: 1 / (1 + (Math.abs(h - m.target) / 0.6) ** 2) });
  }

  return {
    readouts: [
      ro('setup', 'Mirror', 0, '', 0, { text: m.filled ? `${m.liquid.label.toUpperCase()} LAYER` : 'DRY' }),
      ro('h', 'Needle height', m.needle, 'cm', 2, { sub: `no parallax at ${m.target.toFixed(2)} cm` }),
      ro('par', 'Parallax', m.sharpness, '', 2, { tone: m.sharpness > 0.8 ? 'normal' : 'alert', text: m.sharpness > 0.8 ? 'REMOVED' : 'present' }),
      ro('R', 'R (dry mirror)', m.radius, 'cm', 2),
      ro('hl', 'h (with liquid)', m.radius / m.liquid.n, 'cm', 2),
      ro('f', 'Focal length f = R/2', m.radius / 2, 'cm', 2),
      ro('n', 'Refractive index n = R/h', m.filled ? m.nMeasured : Number.NaN, '—', 4, { text: m.filled ? undefined : 'pour liquid' })
    ],
    graph: singleSeriesGraph({
      title: 'Coincidence of needle and image against needle height',
      xLabel: 'h (cm)',
      yLabel: 'coincidence',
      seriesLabel: 'parallax removal',
      color: '#6ee7ff',
      points,
      live: { x: m.needle, y: m.sharpness },
      guides: [
        { axis: 'x', value: m.radius, label: 'R (dry)', color: '#45d68b' },
        { axis: 'x', value: m.radius / m.liquid.n, label: 'h (liquid)', color: '#ffc65c' }
      ]
    }),
    issues,
    description: `A concave mirror of radius of curvature ${m.radius.toFixed(1)} centimetre is ${m.filled ? `holding a shallow layer of ${m.liquid.label.toLowerCase()}` : 'dry'}. The needle is ${m.needle.toFixed(2)} centimetre above the pole.`,
    result: m.filled
      ? `The image coincides with the needle at h = ${m.target.toFixed(2)} cm with the liquid, against R = ${m.radius.toFixed(2)} cm dry, so n = R/h = ${m.nMeasured.toFixed(4)}; the accepted value for ${m.liquid.label.toLowerCase()} is ${m.liquid.n.toFixed(3)}.`
      : `With the mirror dry the image coincides with the needle at ${m.radius.toFixed(2)} cm, which is the radius of curvature; the focal length is therefore ${(m.radius / 2).toFixed(2)} cm. Pour in the liquid to find h.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const scale = 7.2;
  const poleY = 392;
  const needleY = poleY - m.needle * scale;
  const coincident = m.sharpness > 0.8;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Concave mirror {m.filled ? `holding ${m.liquid.label.toLowerCase()}` : '· dry'} · R = {m.radius.toFixed(1)} cm
      </text>

      {/* Concave mirror lying face up, drawn rotated onto the horizontal. */}
      <g transform={`rotate(-90 410 ${poleY})`}>
        <MirrorSvg x={410} y={poleY} radius={m.radius * 4} concave height={190} />
      </g>
      {m.filled ? (
        <path
          d={`M 322 ${poleY - 6} Q 410 ${poleY + 18} 498 ${poleY - 6} Z`}
          fill="#6ee7ff"
          opacity={0.34}
          stroke="#6ee7ff"
          strokeWidth={1}
        />
      ) : null}
      <text x={520} y={poleY + 6} fontSize={10} fill="#8497ad">pole P</text>

      {/* Needle and its image. */}
      <line x1={410} y1={needleY} x2={410} y2={needleY + 30} stroke="#45d68b" strokeWidth={2.6} />
      <path d={`M 405 ${needleY + 8} L 410 ${needleY} L 415 ${needleY + 8} Z`} fill="#45d68b" />
      <text x={424} y={needleY + 6} fontSize={10} fill="#45d68b">needle</text>

      <g opacity={coincident ? 1 : 0.55}>
        <line
          x1={coincident ? 410 : 446}
          y1={poleY - m.target * scale}
          x2={coincident ? 410 : 446}
          y2={poleY - m.target * scale + 30}
          stroke={coincident ? '#ffc65c' : '#ff6b7d'}
          strokeWidth={2.2}
          strokeDasharray="5 3"
        />
        <text x={coincident ? 396 : 456} y={poleY - m.target * scale + 6} textAnchor={coincident ? 'end' : 'start'} fontSize={10} fill={coincident ? '#ffc65c' : '#ff6b7d'}>
          image
        </text>
      </g>

      {/* Normal rays that retrace their own path at the no-parallax setting. */}
      {coincident
        ? [-46, 0, 46].map((dx) => (
            <Ray key={dx} from={{ x: 410, y: needleY + 14 }} to={{ x: 410 + dx, y: poleY - 4 }} color="#ffd257" width={1.4} />
          ))
        : null}

      <line x1={648} y1={poleY} x2={648} y2={poleY - 48 * scale} className="dim-line" />
      <text x={656} y={poleY - (m.needle * scale) / 2} fontSize={10} fill="#8497ad">
        {m.filled ? 'h' : 'R'} = {m.needle.toFixed(2)} cm
      </text>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        n = R/h = {m.radius.toFixed(2)}/{(m.radius / m.liquid.n).toFixed(2)} = {(m.liquid.n).toFixed(4)} for {m.liquid.label.toLowerCase()}
      </text>

      <Knob spec={control('radius', 'slider')} params={params} onChange={set} x={120} y={90} radius={20} label="Radius of curvature of the mirror — turn the dial" />
      {/* The needle clamp is the control: slide it to remove the parallax. */}
      <DragY
        spec={control('needle', 'slider')}
        params={params}
        onChange={set}
        x={700}
        y={poleY}
        height={48 * scale}
        mapping={{ toValue: (dy) => -dy / scale, invert: (h) => poleY - h * scale }}
        label="Needle clamp — drag up and down to remove the parallax"
      />
    </svg>
  );
}

export default function RefractiveIndexWaterExperiment() {
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
            <ViewPill label={m.filled ? 'h' : 'R'} value={m.needle.toFixed(2)} unit="cm" />
            <ViewPill label="n" value={m.filled ? m.nMeasured.toFixed(3) : '—'} />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — no-parallax distances',
          columns: [
            col('liquid', 'Liquid', '', 0),
            col('R', 'R (dry)', 'cm', 2),
            col('h', 'h (with liquid)', 'cm', 2),
            col('n', 'n = R/h', '—', 4, true)
          ],
          capture: () => ({
            liquid: m.filled ? m.liquid.label : 'dry',
            R: m.radius,
            h: m.filled ? m.target : Number.NaN,
            n: 0
          }),
          derive: (row) => ({ ...row, n: Number(row.R) / Number(row.h) }),
          comparison: {
            label: `refractive index of ${m.liquid.label.toLowerCase()}`,
            unit: '—',
            experimental: m.nMeasured,
            theoretical: m.liquid.n,
            precision: 4
          },
          captureEnabled: m.sharpness > 0.8,
          captureHint: 'Remove the parallax dry to get R, then pour in the liquid and repeat for h.'
        };
      }}
    />
  );
}

export { definition, education };
