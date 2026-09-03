import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { LensSvg, Ray } from '@/components/instruments/Instruments';
import { telescopeNearPoint, telescopeNormalAdjustment } from '@/physics-engine/optics';
import { mergeIssues, validatePositive } from '@/physics-engine/validation';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './telescope.meta';

export { meta };

const NEAR_POINT_CM = 25;

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#7dd3fc',
  controls: [
    { kind: 'slider', key: 'fo', label: 'Focal length of the objective', symbol: 'f_o', unit: 'cm', min: 20, max: 120, step: 1, initial: 60, precision: 0, onStage: true },
    { kind: 'slider', key: 'fe', label: 'Focal length of the eyepiece', symbol: 'f_e', unit: 'cm', min: 1, max: 15, step: 0.5, initial: 5, precision: 1, onStage: true },
    { kind: 'slider', key: 'alpha', label: 'Angle subtended by the object', symbol: '\\alpha', unit: '°', min: 0.1, max: 2, step: 0.05, initial: 0.6, precision: 2, onStage: true },
    { kind: 'toggle', key: 'nearPoint', label: 'Final image at the near point', initial: false, onStage: true, hint: 'Off = normal adjustment, image at infinity' }
  ],
  defaults: { fo: 60, fe: 5, alpha: 0.6, nearPoint: false }
};

const education: EducationPack = {
  theory: [
    'An astronomical telescope is two converging lenses on a common axis. The objective has a long focal length and gathers light from a distant object, forming a real, inverted, diminished image at its focal plane. The eyepiece, of short focal length, then works as a simple magnifier on that intermediate image.',
    'In normal adjustment the eyepiece is positioned so that the intermediate image falls exactly at its own focus. The final image is then at infinity and the eye, focused at infinity, views it without any strain. The distance between the two lenses, the tube length, is simply f_o + f_e.',
    'What the telescope actually magnifies is an angle, not a size. A distant object cannot be brought nearer, so the useful measure is the ratio of the angle the final image subtends at the eye to the angle the object itself subtends. That ratio comes out as f_o/f_e — a long objective and a short eyepiece give a high power.',
    'Sliding the eyepiece slightly inwards puts the final image at the near point instead. That adds the factor (1 + f_e/D), giving a small increase in magnification at the cost of the eye having to accommodate, which is why the normal adjustment is preferred for long observation.'
  ],
  formulas: [
    { tex: 'm = -\\frac{f_o}{f_e}', caption: 'Magnifying power in normal adjustment; the sign marks the inversion.' },
    { tex: 'L = f_o + f_e', caption: 'Tube length in normal adjustment.' },
    { tex: 'm = -\\frac{f_o}{f_e}\\left(1 + \\frac{f_e}{D}\\right)', caption: 'With the final image at the near point D.' },
    { tex: 'm = \\frac{\\beta}{\\alpha}', caption: 'Angular magnification: the definition the formulae come from.' }
  ],
  variables: [
    { symbol: 'f_o', name: 'Focal length of the objective', unit: 'm' },
    { symbol: 'f_e', name: 'Focal length of the eyepiece', unit: 'm' },
    { symbol: 'L', name: 'Tube length', unit: 'm' },
    { symbol: '\\alpha', name: 'Angle subtended by the object', unit: '°' },
    { symbol: '\\beta', name: 'Angle subtended by the final image', unit: '°' },
    { symbol: 'D', name: 'Least distance of distinct vision', unit: 'm', note: 'Taken as 25 cm' }
  ],
  procedure: [
    'Mount the objective and the eyepiece on an optical bench with their axes coincident.',
    'Point the objective at a distant object such as a building or the cross-wires of a distant collimator.',
    'Move the eyepiece until the image is sharp and free of parallax against the cross-wire.',
    'Measure the distance between the two lenses — this is the tube length.',
    'Compare it with f_o + f_e using the marked focal lengths.',
    'Estimate the magnifying power by viewing the object with one eye through the telescope and with the other eye directly, and matching the two scales.'
  ],
  precautions: [
    'Never point the telescope at the sun.',
    'The two lenses must be coaxial, or the image will be distorted and dim.',
    'Focus with the eye relaxed to obtain the true normal adjustment.',
    'The object must be distant enough that the rays reaching the objective are effectively parallel.'
  ],
  sourcesOfError: [
    'The object is at a finite distance, so the intermediate image is not exactly at the focal plane.',
    'The eye tends to accommodate, which shifts the setting away from normal adjustment.',
    'The marked focal lengths of the lenses carry their own errors.',
    'Chromatic and spherical aberration in simple lenses blur the image edges.'
  ],
  tips: [
    'Shorten the eyepiece focal length and watch the magnification climb while the tube gets shorter.',
    'Switch to the near-point setting and see the small extra factor (1 + f_e/D) appear.'
  ],
  viva: [
    { q: 'Why should the objective have a large aperture?', a: 'To collect more light and to give better resolution, since the resolving power increases with aperture.' },
    { q: 'What is normal adjustment?', a: 'The setting in which the final image is at infinity, so the intermediate image lies at the focus of the eyepiece and the eye is unstrained.' },
    { q: 'Why is the image of an astronomical telescope inverted?', a: 'The objective forms a real inverted image and the eyepiece does not re-invert it; for astronomy the inversion does not matter.' },
    { q: 'How can the magnifying power be increased?', a: 'By using an objective of longer focal length or an eyepiece of shorter focal length.' },
    { q: 'What is the tube length in normal adjustment?', a: 'The sum of the two focal lengths, f_o + f_e.' }
  ],
  resultTemplate:
    'The tube length equals the sum of the two focal lengths in normal adjustment, and the measured magnifying power agrees with f_o/f_e.'
};

function model(params: ParamValues) {
  const fo = num(params, 'fo', 60);
  const fe = num(params, 'fe', 5);
  const alpha = num(params, 'alpha', 0.6);
  const atNearPoint = params.nearPoint === true;

  const normal = telescopeNormalAdjustment(fo, fe);
  const nearPoint = telescopeNearPoint(fo, fe, NEAR_POINT_CM);
  const magnification = atNearPoint ? nearPoint : normal.magnification;
  // Tube shortens when the eyepiece is pulled in to place the image at D.
  const eyepieceImageDistance = (fe * NEAR_POINT_CM) / (NEAR_POINT_CM + fe);
  const tube = atNearPoint ? fo + eyepieceImageDistance : normal.tubeLength;
  const beta = Math.abs(magnification) * alpha;
  // Height of the intermediate image at the focal plane of the objective.
  const intermediate = fo * Math.tan((alpha * Math.PI) / 180);

  return { fo, fe, alpha, atNearPoint, magnification, tube, beta, intermediate, eyepieceImageDistance };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('fo', 'Focal length of the objective', m.fo),
    validatePositive('fe', 'Focal length of the eyepiece', m.fe)
  );
  if (m.fe >= m.fo) {
    issues.push({
      field: 'fe',
      severity: 'warning',
      message: 'The eyepiece is not shorter than the objective, so the instrument reduces rather than magnifies.'
    });
  }
  if (m.beta > 40) {
    issues.push({
      field: 'alpha',
      severity: 'info',
      message: 'The final image subtends a very large angle; a real eyepiece of this power would show heavy aberration at the edges.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let fe = 1; fe <= 15; fe += 0.1) {
    points.push({ x: fe, y: Math.abs(m.atNearPoint ? telescopeNearPoint(m.fo, fe, NEAR_POINT_CM) : m.fo / fe) });
  }

  return {
    readouts: [
      ro('m', 'Magnifying power m', m.magnification, '×', 3, { tone: 'neg', sub: 'negative — inverted image' }),
      ro('abs', 'Angular magnification |m|', Math.abs(m.magnification), '×', 3),
      ro('L', 'Tube length L', m.tube, 'cm', 2, { sub: m.atNearPoint ? 'eyepiece pulled in' : 'f_o + f_e' }),
      ro('alpha', 'Object subtends α', m.alpha, '°', 3),
      ro('beta', 'Image subtends β', m.beta, '°', 3),
      ro('int', 'Intermediate image height', m.intermediate, 'cm', 3, { sub: 'at the focal plane of the objective' })
    ],
    graph: singleSeriesGraph({
      title: 'Magnifying power against the focal length of the eyepiece',
      xLabel: 'f_e (cm)',
      yLabel: '|m| (×)',
      seriesLabel: m.atNearPoint ? '|m| = (f_o/f_e)(1 + f_e/D)' : '|m| = f_o/f_e',
      color: '#7dd3fc',
      points,
      live: { x: m.fe, y: Math.abs(m.magnification) },
      guides: [{ axis: 'x', value: m.fe, label: `f_e = ${m.fe.toFixed(1)} cm`, color: '#ffc65c' }]
    }),
    issues,
    description: `An objective of focal length ${m.fo.toFixed(0)} centimetre and an eyepiece of ${m.fe.toFixed(1)} centimetre are ${m.tube.toFixed(1)} centimetre apart, ${m.atNearPoint ? 'with the final image at the near point' : 'in normal adjustment'}. A distant object subtending ${m.alpha.toFixed(2)} degrees appears to subtend ${m.beta.toFixed(2)} degrees.`,
    result: m.atNearPoint
      ? `With the final image at D = ${NEAR_POINT_CM} cm the magnifying power is m = −(f_o/f_e)(1 + f_e/D) = ${m.magnification.toFixed(3)}× and the tube length is ${m.tube.toFixed(2)} cm.`
      : `In normal adjustment m = −f_o/f_e = −${m.fo.toFixed(0)}/${m.fe.toFixed(1)} = ${m.magnification.toFixed(3)}×, and the tube length is L = f_o + f_e = ${m.tube.toFixed(1)} cm.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const axisY = 250;
  const objX = 200;
  const scale = Math.min(440 / Math.max(m.tube, 1), 6.5);
  const eyeX = objX + m.tube * scale;
  const hi = Math.min(m.intermediate * scale * 6, 60);

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Astronomical telescope · {m.atNearPoint ? 'image at the near point' : 'normal adjustment'} · m = {m.magnification.toFixed(2)}×
      </text>

      <line x1={40} y1={axisY} x2={780} y2={axisY} className="dim-line" />

      {/* Parallel bundle from the distant object, tilted by α. */}
      {[-30, 0, 30].map((dy) => (
        <Ray
          key={dy}
          from={{ x: 50, y: axisY + dy - m.alpha * 26 }}
          to={{ x: objX, y: axisY + dy }}
          color="#ffd257"
          width={1.4}
        />
      ))}
      <text x={54} y={axisY - 62} fontSize={10} fill="#ffd257">
        from a distant object · α = {m.alpha.toFixed(2)}°
      </text>

      <LensSvg x={objX} y={axisY} height={150} thickness={20} convex label={`objective f_o = ${m.fo.toFixed(0)} cm`} />
      <LensSvg x={eyeX} y={axisY} height={80} thickness={16} convex label={`eyepiece f_e = ${m.fe.toFixed(1)} cm`} />

      {/* Real inverted intermediate image at the focal plane of the objective. */}
      <g>
        <line x1={objX + m.fo * scale} y1={axisY} x2={objX + m.fo * scale} y2={axisY + hi} stroke="#ff6b7d" strokeWidth={2.4} />
        <path d={`M ${objX + m.fo * scale - 5} ${axisY + hi - 8} L ${objX + m.fo * scale} ${axisY + hi} L ${objX + m.fo * scale + 5} ${axisY + hi - 8} Z`} fill="#ff6b7d" />
        <text x={objX + m.fo * scale} y={axisY + hi + 16} textAnchor="middle" fontSize={9.5} fill="#ff6b7d">
          intermediate image
        </text>
      </g>

      {/* Rays leaving the eyepiece: parallel in normal adjustment. */}
      {[-14, 0, 14].map((dy) => (
        <Ray
          key={dy}
          from={{ x: objX + m.fo * scale, y: axisY + hi }}
          to={{ x: eyeX, y: axisY + dy }}
          color="#6ee7ff"
          width={1.2}
        />
      ))}
      {[-14, 0, 14].map((dy) => (
        <Ray
          key={`o${dy}`}
          from={{ x: eyeX, y: axisY + dy }}
          to={{ x: eyeX + 140, y: axisY + dy + (m.atNearPoint ? dy * 0.5 : 0) - m.beta * 1.1 }}
          color="#6ee7ff"
          width={1.4}
        />
      ))}

      {/* The eye. */}
      <g transform={`translate(${eyeX + 158} ${axisY - 18})`}>
        <path d="M -16 0 Q 0 -13 16 0 Q 0 13 -16 0 Z" fill="none" stroke="#cfdcea" strokeWidth={1.4} />
        <circle r={4.5} fill="#cfdcea" />
        <text y={26} textAnchor="middle" fontSize={9.5} fill="#8497ad">eye</text>
      </g>

      <line x1={objX} y1={axisY + 108} x2={eyeX} y2={axisY + 108} className="dim-line" />
      <text x={(objX + eyeX) / 2} y={axisY + 124} textAnchor="middle" fontSize={10.5} fill="#8497ad">
        L = {m.tube.toFixed(1)} cm
      </text>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        m = β/α = {m.beta.toFixed(2)}°/{m.alpha.toFixed(2)}° = {Math.abs(m.magnification).toFixed(2)}× · L = {m.tube.toFixed(1)} cm
      </text>

      <Knob spec={control('fo', 'slider')} params={params} onChange={set} x={110} y={92} radius={20} label="Focal length of the objective — turn the dial" />
      <Knob spec={control('fe', 'slider')} params={params} onChange={set} x={240} y={92} radius={19} label="Focal length of the eyepiece — turn the dial" />
      <Knob spec={control('alpha', 'slider')} params={params} onChange={set} x={580} y={92} radius={19} label="Angle subtended by the object — turn the dial" />
      <StageSwitch spec={control('nearPoint', 'toggle')} params={params} onChange={set} x={710} y={92} label="Near point" />
    </svg>
  );
}

export default function TelescopeExperiment() {
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
            <ViewPill label="m" value={m.magnification.toFixed(2)} unit="×" />
            <ViewPill label="L" value={m.tube.toFixed(1)} unit="cm" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — tube length and magnifying power',
          columns: [
            col('fo', 'f_o', 'cm', 1),
            col('fe', 'f_e', 'cm', 1),
            col('L', 'L measured', 'cm', 2),
            col('sum', 'f_o + f_e', 'cm', 2, true),
            col('m', '|m| = f_o/f_e', '×', 3, true)
          ],
          capture: () => ({ fo: m.fo, fe: m.fe, L: m.tube, sum: 0, m: 0 }),
          derive: (row) => ({
            ...row,
            sum: Number(row.fo) + Number(row.fe),
            m: Number(row.fo) / Number(row.fe)
          }),
          comparison: {
            label: 'tube length',
            unit: 'cm',
            experimental: m.tube,
            theoretical: m.fo + m.fe,
            precision: 2
          },
          captureHint: 'Focus for the sharpest image, then record the tube length.'
        };
      }}
    />
  );
}

export { definition, education };
