import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { refractiveIndexFromDepth } from '@/physics-engine/optics';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { DragY, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './refractive-index-glass-slab.meta';

export { meta };

/** True refractive index of the slab supplied with the kit. */
const TRUE_N = 1.5;

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  practicalNo: meta.practicalNo, thumbLabel: meta.shortTitle, accent: '#6ee7ff',
  controls: [
    { kind: 'slider', key: 'thickness', label: 'Thickness of the slab', symbol: 't', unit: 'mm', min: 5, max: 40, step: 0.5, initial: 15, precision: 1, onStage: true },
    { kind: 'slider', key: 'micro', label: 'Microscope reading', symbol: 'R', unit: 'mm', min: 0, max: 60, step: 0.01, initial: 20, precision: 2, onStage: true, hint: 'Rack the microscope until the target is in focus' },
    {
      kind: 'segmented', key: 'target', label: 'Focused on', initial: 'mark',
      options: [
        { value: 'mark', label: 'Ink mark (no slab)' },
        { value: 'mark-slab', label: 'Ink mark through the slab' },
        { value: 'top', label: 'Top surface of the slab' }
      ]
    }
  ],
  defaults: { thickness: 15, micro: 20, target: 'mark' }
};

const education: EducationPack = {
  theory: [
    'When a mark on a sheet of paper is viewed from above through a glass slab, it appears to be raised. Rays from the mark are refracted away from the normal as they leave the glass, and the eye traces them back to a point nearer the top surface than the mark really is.',
    'The distance from the top surface down to that apparent position is the apparent thickness of the slab, while the real thickness is the actual distance from the top surface to the mark. Their ratio is the refractive index of the glass.',
    'A travelling microscope turns this into three focus settings on one vertical scale: focus on the bare mark, place the slab over it and focus on the raised image of the mark, then focus on a scratch on the top surface of the slab. The differences between the three readings give both thicknesses without ever measuring a length directly.',
    'The normal shift — the amount by which the mark appears to rise — is the difference between the real and the apparent thickness, and it is exactly t(1 − 1/n).'
  ],
  formulas: [
    { tex: 'n = \\frac{\\text{real depth}}{\\text{apparent depth}}', caption: 'Refractive index by the apparent-depth method.' },
    { tex: 'n = \\frac{R_3 - R_1}{R_3 - R_2}', caption: 'From the three travelling-microscope readings.' },
    { tex: '\\text{shift} = t\\left(1 - \\frac{1}{n}\\right)', caption: 'Normal shift produced by the slab.' }
  ],
  variables: [
    { symbol: 't', name: 'Real thickness of the slab', unit: 'm' },
    { symbol: 'R_1', name: 'Reading on the bare mark', unit: 'm' },
    { symbol: 'R_2', name: 'Reading on the mark through the slab', unit: 'm' },
    { symbol: 'R_3', name: 'Reading on the top surface', unit: 'm' },
    { symbol: 'n', name: 'Refractive index of the glass', unit: '—' }
  ],
  procedure: [
    'Make a fine ink cross on a sheet of white paper and place it on the base of the travelling microscope.',
    'Focus the microscope on the cross and note the vertical scale reading R₁.',
    'Place the glass slab over the cross, refocus on its now-raised image and note R₂.',
    'Sprinkle a little lycopodium powder on the top of the slab, focus on it and note R₃.',
    'The real thickness is R₃ − R₁ and the apparent thickness is R₃ − R₂.',
    'Compute n = (R₃ − R₁)/(R₃ − R₂) and repeat with the slab at three different places.'
  ],
  precautions: [
    'Always rack the microscope in one direction when taking a set of readings, to avoid backlash in the screw.',
    'The cross must be fine and sharp — a broad mark makes the focus setting uncertain.',
    'Keep the slab horizontal and do not move the paper between the three readings.',
    'Note the vernier constant of the travelling microscope before starting.'
  ],
  sourcesOfError: [
    'Backlash in the focusing screw if the direction of racking is reversed.',
    'Judging the exact point of sharpest focus, which is the largest single error.',
    'The slab may not have parallel faces, so t varies across it.',
    'Parallax between the cross-wire and the image if the eyepiece is not set first.'
  ],
  tips: [
    'Increase the thickness and watch the apparent rise grow in proportion — the ratio stays at n.',
    'The mark never appears to rise by the full thickness; the shift is only t(1 − 1/n), about a third of t for glass.'
  ],
  viva: [
    { q: 'Why does the mark appear raised?', a: 'Rays from it bend away from the normal on leaving the denser glass, and the eye projects them back to a shallower point.' },
    { q: 'Define refractive index in terms of depths.', a: 'It is the ratio of the real depth of an object in a medium to its apparent depth when viewed normally from outside.' },
    { q: 'Does the apparent depth depend on the angle of viewing?', a: 'Yes. The simple ratio holds only for near-normal viewing; at large angles the image is also distorted.' },
    { q: 'Why is lycopodium powder sprinkled on the slab?', a: 'The polished top surface has nothing to focus on; the powder gives the microscope a sharp target at that level.' },
    { q: 'What is the normal shift?', a: 'The apparent rise of the object, equal to t(1 − 1/n).' }
  ],
  resultTemplate:
    'The ratio of the real to the apparent thickness measured with the travelling microscope gives the refractive index of the glass slab, close to the accepted value of 1.5.'
};

function model(params: ParamValues) {
  const tMm = num(params, 'thickness', 15);
  const micro = num(params, 'micro', 20);
  const target = String(params.target ?? 'mark');

  // The three true focus positions on the microscope scale, in millimetres.
  const r1 = 20; // bare mark on the paper
  const r3 = r1 + tMm; // top surface of the slab
  const apparent = tMm / TRUE_N;
  const r2 = r3 - apparent; // raised image of the mark

  const wanted = target === 'mark' ? r1 : target === 'mark-slab' ? r2 : r3;
  const focusError = Math.abs(micro - wanted);
  // Sharpness falls off quickly either side of the true focus.
  const sharpness = 1 / (1 + (focusError / 0.35) ** 2);
  const shift = tMm - apparent;

  return { tMm, micro, target, r1, r2, r3, apparent, wanted, focusError, sharpness, shift };
}

const TARGET_LABEL: Record<string, string> = {
  mark: 'ink mark, no slab (R₁)',
  'mark-slab': 'mark through the slab (R₂)',
  top: 'top surface of the slab (R₃)'
};

function compute(params: ParamValues): ModelOutput {
  const m = model(params);
  const measuredN = refractiveIndexFromDepth(m.r3 - m.r1, m.r3 - m.r2);

  const issues = mergeIssues(
    validatePositive('thickness', 'Thickness of the slab', m.tMm),
    validateRange('micro', 'Microscope reading', m.micro, 0, 60)
  );
  if (m.sharpness < 0.5) {
    issues.push({
      field: 'micro',
      severity: 'info',
      message: `The image is out of focus by ${m.focusError.toFixed(2)} mm. Rack the microscope towards ${m.wanted.toFixed(2)} mm.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let t = 5; t <= 40; t += 0.5) points.push({ x: t, y: t / TRUE_N });

  return {
    readouts: [
      ro('target', 'Focused on', 0, '', 0, { text: TARGET_LABEL[m.target] ?? m.target }),
      ro('micro', 'Microscope reading', m.micro, 'mm', 2, { sub: `sharp at ${m.wanted.toFixed(2)} mm` }),
      ro('focus', 'Focus', m.sharpness, '', 2, { tone: m.sharpness > 0.8 ? 'normal' : 'alert', text: m.sharpness > 0.8 ? 'SHARP' : m.sharpness > 0.3 ? 'blurred' : 'out of focus' }),
      ro('real', 'Real thickness R₃ − R₁', m.r3 - m.r1, 'mm', 2),
      ro('app', 'Apparent thickness R₃ − R₂', m.r3 - m.r2, 'mm', 2),
      ro('shift', 'Normal shift', m.shift, 'mm', 2, { sub: 't(1 − 1/n)' }),
      ro('n', 'Refractive index n', measuredN, '—', 4)
    ],
    graph: singleSeriesGraph({
      title: 'Apparent thickness against real thickness',
      xLabel: 'real thickness (mm)',
      yLabel: 'apparent thickness (mm)',
      seriesLabel: 'slope = 1/n',
      color: '#6ee7ff',
      points,
      live: { x: m.tMm, y: m.apparent },
      markers: [{ x: m.tMm, y: m.apparent, label: `slope 1/n = ${(1 / TRUE_N).toFixed(3)}`, color: '#ffc65c' }]
    }),
    issues,
    description: `A glass slab ${m.tMm.toFixed(1)} millimetre thick is placed over an ink mark. The travelling microscope is focused on the ${TARGET_LABEL[m.target] ?? m.target} and reads ${m.micro.toFixed(2)} millimetre.`,
    result: `The real thickness is R₃ − R₁ = ${(m.r3 - m.r1).toFixed(2)} mm and the apparent thickness R₃ − R₂ = ${(m.r3 - m.r2).toFixed(2)} mm, so n = real/apparent = ${measuredN.toFixed(4)}. The mark appears raised by ${m.shift.toFixed(2)} mm.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const scale = 7; // pixels per millimetre on the drawn scale
  const baseY = 340;
  const yOfReading = (r: number) => baseY - (r - 20) * scale;
  const slabTop = yOfReading(m.r3);
  const slabH = Math.max(m.tMm * scale, 4);

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={40} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Travelling microscope · apparent-depth method
      </text>

      {/* Microscope barrel, racked to the current reading. */}
      <g transform={`translate(410 ${yOfReading(m.micro) - 96})`}>
        <rect x={-18} y={-58} width={36} height={70} rx={5} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={1.2} />
        <rect x={-11} y={12} width={22} height={30} rx={3} fill="#0b1119" stroke="#3a5069" strokeWidth={1} />
        <circle cx={0} cy={44} r={7} fill="none" stroke="#8fc7e8" strokeWidth={1.4} />
        <text x={26} y={-24} fontSize={10} fill="#8497ad">objective</text>
      </g>
      <line x1={410} y1={yOfReading(m.micro) - 44} x2={410} y2={yOfReading(m.micro)} className="dim-line" />
      <circle cx={410} cy={yOfReading(m.micro)} r={5} fill="none" stroke={m.sharpness > 0.8 ? '#45d68b' : '#ff6b7d'} strokeWidth={2} />

      {/* Vertical scale of the microscope. */}
      <line x1={620} y1={80} x2={620} y2={baseY + 20} stroke="#5e7189" strokeWidth={1.4} />
      {Array.from({ length: 9 }, (_, i) => {
        const r = 20 + i * 5;
        return (
          <g key={r}>
            <line x1={614} y1={yOfReading(r)} x2={626} y2={yOfReading(r)} stroke="#5e7189" strokeWidth={1.2} />
            <text x={632} y={yOfReading(r) + 4} fontSize={9} fill="#8497ad">{r}</text>
          </g>
        );
      })}
      {[
        { r: m.r1, label: 'R₁ mark', color: '#45d68b' },
        { r: m.r2, label: 'R₂ image', color: '#ffc65c' },
        { r: m.r3, label: 'R₃ surface', color: '#6ee7ff' }
      ].map((k) => (
        <g key={k.label}>
          <line x1={560} y1={yOfReading(k.r)} x2={614} y2={yOfReading(k.r)} stroke={k.color} strokeWidth={1} strokeDasharray="4 3" />
          <text x={556} y={yOfReading(k.r) + 4} textAnchor="end" fontSize={9.5} fill={k.color}>
            {k.label} · {k.r.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Paper, ink mark and the slab standing on it. */}
      <rect x={240} y={baseY} width={340} height={12} fill="#e8e2d4" />
      <text x={410} y={baseY + 10} textAnchor="middle" fontSize={11} fill="#1c2836">✕</text>
      <rect x={300} y={slabTop} width={220} height={slabH} fill="url(#lab-glass)" stroke="#8fc7e8" strokeWidth={1.2} />
      <text x={532} y={slabTop + slabH / 2 + 4} fontSize={10} fill="#8fc7e8">t = {m.tMm.toFixed(1)} mm</text>

      {/* The raised image of the mark. */}
      <g opacity={0.85}>
        <text x={410} y={yOfReading(m.r2) + 4} textAnchor="middle" fontSize={11} fill="#ffc65c">✕</text>
        <text x={410} y={yOfReading(m.r2) - 10} textAnchor="middle" fontSize={9} fill="#ffc65c">apparent</text>
      </g>

      <text x={410} y={438} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        n = (R₃−R₁)/(R₃−R₂) = {(m.r3 - m.r1).toFixed(2)}/{(m.r3 - m.r2).toFixed(2)} = {refractiveIndexFromDepth(m.r3 - m.r1, m.r3 - m.r2).toFixed(4)}
      </text>

      <Knob spec={control('thickness', 'slider')} params={params} onChange={set} x={120} y={90} radius={20} label="Thickness of the slab — turn the dial" />
      {/* The focusing screw is the control: rack the microscope to each target. */}
      <DragY
        spec={control('micro', 'slider')}
        params={params}
        onChange={set}
        x={700}
        y={baseY}
        height={260}
        mapping={{ toValue: (dy) => -dy / scale, invert: (r) => yOfReading(r) }}
        label="Focusing screw — drag to rack the microscope up and down"
      />
    </svg>
  );
}

export default function RefractiveIndexGlassSlabExperiment() {
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
            <ViewPill label="R" value={m.micro.toFixed(2)} unit="mm" />
            <ViewPill label="n" value={refractiveIndexFromDepth(m.r3 - m.r1, m.r3 - m.r2).toFixed(3)} />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        const n = refractiveIndexFromDepth(m.r3 - m.r1, m.r3 - m.r2);
        return {
          title: 'Observation table — travelling microscope readings',
          columns: [
            col('t', 'Slab thickness', 'mm', 1),
            col('r1', 'R₁ mark', 'mm', 2),
            col('r2', 'R₂ image', 'mm', 2),
            col('r3', 'R₃ surface', 'mm', 2),
            col('n', 'n = (R₃−R₁)/(R₃−R₂)', '—', 4, true)
          ],
          capture: () => ({ t: m.tMm, r1: m.r1, r2: m.r2, r3: m.r3, n: 0 }),
          derive: (row) => ({
            ...row,
            n: refractiveIndexFromDepth(Number(row.r3) - Number(row.r1), Number(row.r3) - Number(row.r2))
          }),
          comparison: { label: 'refractive index', unit: '—', experimental: n, theoretical: TRUE_N, precision: 4 },
          captureHint: 'Take all three focus settings, then record one row per position of the slab.'
        };
      }}
    />
  );
}

export { definition, education };
