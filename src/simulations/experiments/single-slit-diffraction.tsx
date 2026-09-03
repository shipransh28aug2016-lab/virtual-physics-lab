import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { centralMaximumHalfWidth, singleSlitIntensity, wavelengthToRgb } from '@/physics-engine/optics';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './single-slit-diffraction.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'lambda', label: 'Wavelength', symbol: '\\lambda', unit: 'nm', min: 400, max: 700, step: 1, initial: 589, precision: 0, onStage: true },
    { kind: 'slider', key: 'width', label: 'Slit width', symbol: 'a', unit: 'µm', min: 20, max: 400, step: 1, initial: 100, precision: 0, scale: 'log', onStage: true },
    { kind: 'slider', key: 'distance', label: 'Slit-to-screen distance', symbol: 'D', unit: 'm', min: 0.3, max: 4, step: 0.05, initial: 1.5, precision: 2, onStage: true },
    { kind: 'slider', key: 'probe', label: 'Probe position on the screen', symbol: 'y', unit: 'mm', min: -40, max: 40, step: 0.1, initial: 0, precision: 2, onStage: true }
  ],
  defaults: { lambda: 589, width: 100, distance: 1.5, probe: 0 }
};

const education: EducationPack = {
  theory: [
    'Light passing through a narrow slit does not cast a sharp geometrical shadow. Every point of the wavefront in the slit acts as a source of secondary wavelets, and those wavelets interfere with one another on the far side. The pattern on a distant screen is a bright central band flanked by progressively fainter maxima.',
    'A minimum appears wherever the slit can be divided into an even number of strips that cancel in pairs. That happens when the path difference between the two edges of the slit is a whole number of wavelengths, a sin θ = mλ with m = ±1, ±2, …. Note that this condition gives the dark fringes, not the bright ones — the opposite of the double-slit case.',
    'The central maximum is twice as wide as the others and carries most of the energy. Its half-angular width is set by the first minimum, sin θ₁ = λ/a, so a narrower slit spreads the light more. In the limit a ≈ λ the pattern spreads over the whole screen; for a ≫ λ it collapses to the geometrical image of the slit.',
    'The intensity profile follows the sinc-squared function, I = I₀(sin β/β)² with β = πa sin θ/λ. Its secondary maxima are far weaker than the central one — the first is only about 4.7% as bright — which is why they are easy to miss in a rough observation.'
  ],
  formulas: [
    { tex: 'a\\sin\\theta = m\\lambda', caption: 'Condition for the m-th minimum, m = ±1, ±2, …' },
    { tex: 'I = I_0\\left(\\frac{\\sin\\beta}{\\beta}\\right)^2,\\ \\beta = \\frac{\\pi a\\sin\\theta}{\\lambda}', caption: 'Intensity distribution.' },
    { tex: '\\theta_1 = \\sin^{-1}\\frac{\\lambda}{a}', caption: 'Half-angular width of the central maximum.' },
    { tex: 'w = \\frac{2\\lambda D}{a}', caption: 'Linear width of the central maximum on the screen.' }
  ],
  variables: [
    { symbol: 'a', name: 'Slit width', unit: 'm' },
    { symbol: '\\lambda', name: 'Wavelength of the light', unit: 'm' },
    { symbol: 'D', name: 'Slit-to-screen distance', unit: 'm' },
    { symbol: '\\theta', name: 'Diffraction angle', unit: '°' },
    { symbol: 'w', name: 'Width of the central maximum', unit: 'm' },
    { symbol: 'I_0', name: 'Intensity at the centre', unit: '—' }
  ],
  procedure: [
    'Set up the laser, the adjustable single slit and the screen on an optical bench with their centres at the same height.',
    'Measure the distance D from the slit to the screen.',
    'Adjust the slit until a clear pattern of a bright central band with fainter side bands appears.',
    'Mark the centres of the first minima on either side of the central maximum and measure the distance between them.',
    'Compute the slit width from a = 2λD/w.',
    'Repeat for several slit-to-screen distances and plot w against D — the graph is a straight line through the origin.'
  ],
  precautions: [
    'Never look directly into the laser beam or its specular reflection.',
    'Keep the slit perpendicular to the beam and the screen parallel to the slit.',
    'Work in a darkened room so the faint secondary maxima are visible.',
    'Measure to the centres of the dark fringes, which are sharper than the bright ones.'
  ],
  sourcesOfError: [
    'The edges of the slit are not perfectly straight or parallel.',
    'The fringes are broad, so locating their centres is uncertain.',
    'The screen may not be exactly perpendicular to the beam.',
    'The laser beam has a finite width and its own divergence.'
  ],
  tips: [
    'Halve the slit width and watch the central maximum double in width — the pattern spreads as the slit narrows.',
    'Move the probe to the first minimum and confirm that a sin θ = λ there.'
  ],
  viva: [
    { q: 'Why is the central maximum twice as wide as the others?', a: 'It is bounded by the first minimum on each side, at m = +1 and m = −1, so it spans two fringe spacings.' },
    { q: 'What is the condition for a minimum in single-slit diffraction?', a: 'a sin θ = mλ, with m a non-zero integer.' },
    { q: 'How does the pattern change if the slit is made narrower?', a: 'The pattern spreads out; the central maximum becomes wider and dimmer.' },
    { q: 'How does single-slit diffraction differ from double-slit interference?', a: 'Diffraction comes from a continuous distribution of secondary sources across one slit, so the fringes are unequally spaced and of unequal intensity; interference from two narrow slits gives equally spaced fringes of equal intensity.' },
    { q: 'What happens if white light is used?', a: 'The central maximum stays white while the side bands are coloured, since the fringe positions depend on wavelength.' }
  ],
  resultTemplate:
    'The diffraction pattern shows a broad central maximum flanked by weaker side bands, and the measured width of the central maximum agrees with w = 2λD/a.'
};

function model(params: ParamValues) {
  const lambdaNm = num(params, 'lambda', 589);
  const widthUm = num(params, 'width', 100);
  const distance = num(params, 'distance', 1.5);
  const probeMm = num(params, 'probe', 0);

  const lambda = lambdaNm * 1e-9;
  const a = widthUm * 1e-6;
  const y = probeMm / 1000;

  const intensity = singleSlitIntensity(y, lambda, distance, a);
  const halfWidthDeg = centralMaximumHalfWidth(lambda, a);
  const centralWidth = (2 * lambda * distance) / a; // metres
  const theta = (Math.atan2(y, distance) * 180) / Math.PI;
  // Order of the nearest minimum to the probe, from a sinθ = mλ.
  const order = (a * Math.sin(Math.atan2(y, distance))) / lambda;

  return { lambdaNm, widthUm, distance, probeMm, lambda, a, y, intensity, halfWidthDeg, centralWidth, theta, order };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('width', 'Slit width', m.widthUm),
    validateRange('distance', 'Slit-to-screen distance', m.distance, 0.3, 4)
  );
  if (m.a < 3 * m.lambda) {
    issues.push({
      field: 'width',
      severity: 'warning',
      message: `The slit is only ${(m.a / m.lambda).toFixed(1)} wavelengths wide, so the first minimum is at a very large angle and the small-angle results no longer apply.`
    });
  }
  if (m.centralWidth * 1000 > 80) {
    issues.push({
      field: 'width',
      severity: 'info',
      message: `The central maximum is ${(m.centralWidth * 1000).toFixed(1)} mm wide, wider than the 80 mm screen. Widen the slit or bring the screen closer.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let mm = -40; mm <= 40; mm += 0.1) {
    points.push({ x: mm, y: singleSlitIntensity(mm / 1000, m.lambda, m.distance, m.a) });
  }

  return {
    readouts: [
      ro('i', 'Relative intensity', m.intensity, '—', 4, { sub: `${(m.intensity * 100).toFixed(2)} % of I₀` }),
      ro('y', 'Probe position y', m.probeMm, 'mm', 2, { sub: `θ = ${m.theta.toFixed(3)}°` }),
      ro('w', 'Width of the central maximum', m.centralWidth * 1000, 'mm', 3, { sub: 'w = 2λD/a' }),
      ro('half', 'Half-angular width θ₁', m.halfWidthDeg, '°', 3),
      ro('order', 'a sin θ / λ at the probe', m.order, '—', 3, { tone: Math.abs(m.order - Math.round(m.order)) < 0.03 && Math.round(m.order) !== 0 ? 'alert' : 'normal', sub: Math.abs(m.order - Math.round(m.order)) < 0.03 && Math.round(m.order) !== 0 ? 'at a minimum' : '' }),
      ro('a', 'Slit width a', m.a, 'm', 3, { sub: `${(m.a / m.lambda).toFixed(1)} λ` })
    ],
    graph: singleSeriesGraph({
      title: 'Intensity across the screen',
      xLabel: 'y (mm)',
      yLabel: 'I / I₀',
      seriesLabel: 'sinc² profile',
      color: '#9d8cff',
      points,
      live: { x: m.probeMm, y: m.intensity },
      guides: [
        { axis: 'x', value: (m.centralWidth / 2) * 1000, label: 'first minimum', color: '#ffc65c' },
        { axis: 'x', value: (-m.centralWidth / 2) * 1000, label: '', color: '#ffc65c' }
      ]
    }),
    issues,
    description: `Light of wavelength ${m.lambdaNm} nanometre passes through a slit ${m.widthUm.toFixed(0)} micrometre wide onto a screen ${m.distance.toFixed(2)} metre away. The probe at ${m.probeMm.toFixed(2)} millimetre reads ${(m.intensity * 100).toFixed(2)} per cent of the central intensity.`,
    result: `The first minima lie at sin θ = λ/a, giving θ₁ = ${m.halfWidthDeg.toFixed(3)}° and a central maximum ${(m.centralWidth * 1000).toFixed(3)} mm wide on the screen. Rearranged, a = 2λD/w = ${formatSI(m.a, 3)} m, which recovers the slit width.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const rgb = wavelengthToRgb(m.lambdaNm);
  const beam = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const screenX = 660;
  const slitX = 250;
  const axisY = 250;
  const mmToPx = 3.6;
  const patternRef = useRef<SVGGElement>(null);

  // The fringe strip is redrawn imperatively so a wide sweep stays at 60 fps.
  useEffect(() => {
    const g = patternRef.current;
    if (!g) return;
    const bands = Array.from(g.querySelectorAll('rect'));
    bands.forEach((rect, k) => {
      const mm = -40 + (k / (bands.length - 1)) * 80;
      const i = singleSlitIntensity(mm / 1000, m.lambda, m.distance, m.a);
      rect.setAttribute('opacity', String(Math.max(0.02, Math.min(1, i))));
    });
  });

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Single slit · a = {m.widthUm.toFixed(0)} µm · λ = {m.lambdaNm} nm · D = {m.distance.toFixed(2)} m
      </text>

      {/* Source and collimated beam. */}
      <rect x={70} y={axisY - 16} width={54} height={32} rx={4} fill="#1d2836" stroke="#3a5069" strokeWidth={1.2} />
      <text x={97} y={axisY + 30} textAnchor="middle" fontSize={9.5} fill="#8497ad">laser</text>
      {[-8, 0, 8].map((dy) => (
        <line key={dy} x1={124} y1={axisY + dy} x2={slitX} y2={axisY + dy} stroke={beam} strokeWidth={1.6} opacity={0.8} />
      ))}

      {/* The slit itself, drawn to the model's aperture. */}
      <rect x={slitX - 5} y={100} width={10} height={150 - Math.max(m.widthUm / 22, 3)} fill="url(#lab-metal)" />
      <rect x={slitX - 5} y={axisY + Math.max(m.widthUm / 22, 3)} width={10} height={150} fill="url(#lab-metal)" />
      <text x={slitX} y={92} textAnchor="middle" fontSize={9.5} fill="#8497ad">a = {m.widthUm.toFixed(0)} µm</text>

      {/* Diffracted envelope opening out towards the screen. */}
      <path
        d={`M ${slitX} ${axisY} L ${screenX} ${axisY - (m.centralWidth / 2) * 1000 * mmToPx} L ${screenX} ${axisY + (m.centralWidth / 2) * 1000 * mmToPx} Z`}
        fill={beam}
        opacity={0.14}
      />

      {/* The fringe pattern on the screen. */}
      <rect x={screenX} y={axisY - 40 * mmToPx} width={26} height={80 * mmToPx} fill="#0b1119" stroke="#3a5069" strokeWidth={1.2} />
      <g ref={patternRef}>
        {Array.from({ length: 160 }, (_, k) => (
          <rect
            key={k}
            x={screenX + 1}
            y={axisY - 40 * mmToPx + (k * (80 * mmToPx)) / 160}
            width={24}
            height={(80 * mmToPx) / 160 + 0.6}
            fill={beam}
          />
        ))}
      </g>
      <text x={screenX + 13} y={axisY + 40 * mmToPx + 18} textAnchor="middle" fontSize={9.5} fill="#8497ad">screen</text>

      {/* Probe on the screen. */}
      <g transform={`translate(${screenX + 40} ${axisY + m.probeMm * mmToPx})`}>
        <line x1={-14} y1={0} x2={0} y2={0} stroke="#ffc65c" strokeWidth={1.6} />
        <circle r={4} fill="#ffc65c" className="stage-pin" />
        <text x={10} y={4} fontSize={9.5} fill="#ffc65c" fontFamily="ui-monospace, monospace">
          {m.probeMm.toFixed(2)} mm · {(m.intensity * 100).toFixed(1)} %
        </text>
      </g>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        a sin θ = mλ · w = 2λD/a = {(m.centralWidth * 1000).toFixed(3)} mm · θ₁ = {m.halfWidthDeg.toFixed(3)}°
      </text>

      <Knob spec={control('lambda', 'slider')} params={params} onChange={set} x={110} y={100} radius={19} label="Wavelength — turn the dial" />
      <Knob spec={control('width', 'slider')} params={params} onChange={set} x={250} y={388} radius={19} label="Slit width — turn the dial" />
      <Knob spec={control('distance', 'slider')} params={params} onChange={set} x={450} y={388} radius={19} label="Slit-to-screen distance — turn the dial" />
      <Knob spec={control('probe', 'slider')} params={params} onChange={set} x={700} y={100} radius={19} label="Probe position on the screen — turn the dial" />
    </svg>
  );
}

export default function SingleSlitDiffractionExperiment() {
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
            <ViewPill label="I/I₀" value={m.intensity.toFixed(3)} />
            <ViewPill label="w" value={(m.centralWidth * 1000).toFixed(2)} unit="mm" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — width of the central maximum',
          columns: [
            col('lambda', 'λ', 'nm', 0),
            col('a', 'a', 'µm', 0),
            col('D', 'D', 'm', 2),
            col('w', 'w measured', 'mm', 3),
            col('acalc', 'a = 2λD/w', 'µm', 1, true)
          ],
          capture: () => ({
            lambda: m.lambdaNm,
            a: m.widthUm,
            D: m.distance,
            w: m.centralWidth * 1000,
            acalc: 0
          }),
          derive: (row) => {
            const w = Number(row.w) / 1000;
            const lambda = Number(row.lambda) * 1e-9;
            return { ...row, acalc: w > 0 ? ((2 * lambda * Number(row.D)) / w) * 1e6 : Number.NaN };
          },
          comparison: {
            label: 'slit width',
            unit: 'µm',
            experimental: ((2 * m.lambda * m.distance) / m.centralWidth) * 1e6,
            theoretical: m.widthUm,
            precision: 2
          },
          captureHint: 'Measure the distance between the first minima, then record.'
        };
      }}
    />
  );
}

export { definition, education };
