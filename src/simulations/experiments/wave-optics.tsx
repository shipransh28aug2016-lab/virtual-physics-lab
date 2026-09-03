import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { doubleSlitIntensity, fringeWidth, singleSlitIntensity, wavelengthToRgb } from '@/physics-engine/optics';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './wave-optics.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#6ee7ff',
  controls: [
    { kind: 'slider', key: 'lambda', label: 'Wavelength', symbol: '\\lambda', unit: 'nm', min: 400, max: 700, step: 1, initial: 589, precision: 0, onStage: true },
    { kind: 'slider', key: 'sep', label: 'Slit separation', symbol: 'd', unit: 'mm', min: 0.1, max: 2, step: 0.01, initial: 0.5, precision: 2, onStage: true },
    { kind: 'slider', key: 'distance', label: 'Slit-to-screen distance', symbol: 'D', unit: 'm', min: 0.3, max: 4, step: 0.05, initial: 1.5, precision: 2, onStage: true },
    { kind: 'slider', key: 'width', label: 'Width of each slit', symbol: 'a', unit: 'µm', min: 20, max: 200, step: 1, initial: 80, precision: 0, hint: 'Sets the diffraction envelope', onStage: true },
    { kind: 'slider', key: 'probe', label: 'Probe position on the screen', symbol: 'y', unit: 'mm', min: -20, max: 20, step: 0.05, initial: 0, precision: 2, onStage: true },
    { kind: 'toggle', key: 'coherent', label: 'Sources coherent', initial: true, onStage: true, hint: 'Incoherent sources wash the fringes out' }
  ],
  defaults: { lambda: 589, sep: 0.5, distance: 1.5, width: 80, probe: 0, coherent: true }
};

const education: EducationPack = {
  theory: [
    'Two slits illuminated by the same source act as two coherent sources. The waves reaching a point on the screen have travelled slightly different distances, and the resulting path difference decides whether they arrive in step or out of step. Where the path difference is a whole number of wavelengths the waves reinforce and a bright fringe appears; where it is an odd number of half wavelengths they cancel and the fringe is dark.',
    'For a screen far from the slits the path difference is very nearly d sin θ, and for small angles sin θ ≈ y/D. The bright fringes therefore fall at y = nλD/d, equally spaced, and the separation between consecutive fringes — the fringe width — is β = λD/d.',
    'That formula is the whole experiment. Measuring the fringe width, the slit separation and the screen distance gives the wavelength of the light, which is how the wavelength of sodium light was first measured to good precision.',
    'The fringes are not all equally bright, because each slit also diffracts. The two-slit interference pattern is modulated by the single-slit diffraction envelope of one slit, so the fringes fade away towards the edges. Narrower slits give a wider envelope and therefore more visible fringes.',
    'Coherence is essential. Two independent lamps have randomly varying phase difference, so the pattern shifts far faster than the eye can follow and only a uniform illumination is seen. Using one source split into two is what makes the fringes stationary.'
  ],
  formulas: [
    { tex: '\\Delta x = d\\sin\\theta \\approx \\frac{yd}{D}', caption: 'Path difference at a point y on the screen.' },
    { tex: 'y_n = \\frac{n\\lambda D}{d}', caption: 'Position of the n-th bright fringe.' },
    { tex: '\\beta = \\frac{\\lambda D}{d}', caption: 'Fringe width — the spacing between consecutive fringes.' },
    { tex: 'I = 4I_0\\cos^2\\left(\\frac{\\pi y d}{\\lambda D}\\right)', caption: 'Intensity distribution of the interference pattern.' },
    { tex: '\\lambda = \\frac{\\beta d}{D}', caption: 'The wavelength from the three measured quantities.' }
  ],
  variables: [
    { symbol: 'd', name: 'Separation between the slits', unit: 'm' },
    { symbol: 'D', name: 'Slit-to-screen distance', unit: 'm' },
    { symbol: '\\beta', name: 'Fringe width', unit: 'm' },
    { symbol: '\\lambda', name: 'Wavelength of the light', unit: 'm' },
    { symbol: 'a', name: 'Width of each slit', unit: 'm' },
    { symbol: 'n', name: 'Order of the fringe', unit: '—' }
  ],
  procedure: [
    'Mount the source, the double slit and the screen on an optical bench with their centres at the same height.',
    'Measure the slit-to-screen distance D and note the slit separation d marked on the slide.',
    'Darken the room and adjust the slit until a clear set of equally spaced fringes appears.',
    'Measure the distance spanned by ten fringes and divide by ten to obtain the fringe width β.',
    'Compute λ = βd/D.',
    'Repeat for three values of D and plot β against D; the graph is a straight line through the origin of slope λ/d.'
  ],
  precautions: [
    'The two slits must be equally illuminated by the same source, or the fringes lose contrast.',
    'Measure across many fringes and divide, rather than measuring one fringe.',
    'The screen must be parallel to the plane of the slits.',
    'Work in a darkened room; stray light washes the pattern out.'
  ],
  sourcesOfError: [
    'The fringes are broad, so locating their centres is uncertain.',
    'The marked slit separation may differ from the true one.',
    'The screen may not be exactly perpendicular to the beam.',
    'Vibration of the bench blurs the pattern during the reading.'
  ],
  tips: [
    'Halve the slit separation and watch the fringes spread to twice their spacing.',
    'Narrow each slit and see the diffraction envelope widen, bringing more fringes into view.',
    'Switch coherence off to see why two independent lamps show no fringes at all.'
  ],
  viva: [
    { q: 'What is the condition for a bright fringe?', a: 'The path difference must be a whole number of wavelengths, d sin θ = nλ.' },
    { q: 'What is fringe width and what does it depend on?', a: 'The spacing between consecutive bright fringes, β = λD/d — it grows with wavelength and screen distance and falls as the slits are separated.' },
    { q: 'Why must the sources be coherent?', a: 'Only a constant phase difference gives a stationary pattern; independent sources produce fringes that shift too fast to be seen.' },
    { q: 'Why do the fringes fade away from the centre?', a: 'The interference pattern is modulated by the single-slit diffraction envelope of each slit.' },
    { q: 'What happens if white light is used?', a: 'The central fringe is white and the rest are coloured, since each wavelength has its own fringe width.' },
    { q: 'Is energy conserved at a dark fringe?', a: 'Yes. Energy is redistributed, not destroyed — what is missing from the dark fringes appears in the bright ones.' }
  ],
  resultTemplate:
    'The fringes are equally spaced, and the wavelength computed from λ = βd/D agrees with the accepted value for the source.'
};

function model(params: ParamValues) {
  const lambdaNm = num(params, 'lambda', 589);
  const sepMm = num(params, 'sep', 0.5);
  const distance = num(params, 'distance', 1.5);
  const widthUm = num(params, 'width', 80);
  const probeMm = num(params, 'probe', 0);
  const coherent = params.coherent !== false;

  const lambda = lambdaNm * 1e-9;
  const d = sepMm / 1000;
  const a = widthUm * 1e-6;
  const y = probeMm / 1000;

  const beta = fringeWidth(lambda, distance, d);
  const envelope = singleSlitIntensity(y, lambda, distance, a);
  // Incoherent sources give the envelope alone: the fringes wash out.
  const intensity = coherent ? doubleSlitIntensity(y, lambda, distance, d) * envelope : envelope * 0.5;
  const order = beta > 0 ? y / beta : 0;
  const lambdaMeasured = distance > 0 ? (beta * d) / distance : Number.NaN;
  // How many fringes fit inside the central diffraction maximum.
  const fringesVisible = a > 0 ? (2 * d) / a : 0;

  return { lambdaNm, sepMm, distance, widthUm, probeMm, coherent, lambda, d, a, y, beta, envelope, intensity, order, lambdaMeasured, fringesVisible };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('sep', 'Slit separation', m.sepMm),
    validateRange('distance', 'Slit-to-screen distance', m.distance, 0.3, 4)
  );
  if (m.a >= m.d) {
    issues.push({
      field: 'width',
      severity: 'warning',
      message: 'Each slit is as wide as the separation between them, so the two slits merge into one and there is nothing to interfere.'
    });
  }
  if (!m.coherent) {
    issues.push({
      field: 'coherent',
      severity: 'info',
      message: 'With incoherent sources the phase difference varies randomly, so only the diffraction envelope survives — no fringes.'
    });
  }
  if (m.beta * 1000 < 0.2) {
    issues.push({
      field: 'sep',
      severity: 'info',
      message: `The fringe width is only ${(m.beta * 1000).toFixed(3)} mm, too fine to resolve by eye. Reduce d or move the screen back.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let mm = -20; mm <= 20; mm += 0.05) {
    const yy = mm / 1000;
    const env = singleSlitIntensity(yy, m.lambda, m.distance, m.a);
    points.push({ x: mm, y: m.coherent ? doubleSlitIntensity(yy, m.lambda, m.distance, m.d) * env : env * 0.5 });
  }

  return {
    readouts: [
      ro('beta', 'Fringe width β = λD/d', m.beta * 1000, 'mm', 4),
      ro('i', 'Relative intensity', m.intensity, '—', 4, { sub: `${(m.intensity * 100).toFixed(1)} % of the peak` }),
      ro('order', 'Order at the probe y/β', m.order, '—', 3, { tone: Math.abs(m.order - Math.round(m.order)) < 0.04 ? 'alert' : 'normal', sub: Math.abs(m.order - Math.round(m.order)) < 0.04 ? 'bright fringe' : '' }),
      ro('lambda', 'λ from βd/D', m.lambdaMeasured, 'm', 4, { sub: `${(m.lambdaMeasured * 1e9).toFixed(1)} nm` }),
      ro('env', 'Diffraction envelope', m.envelope, '—', 3),
      ro('n', 'Fringes in the central maximum', m.fringesVisible, '—', 1, { sub: '2d/a' })
    ],
    graph: singleSeriesGraph({
      title: 'Intensity across the screen',
      xLabel: 'y (mm)',
      yLabel: 'I / I₀',
      seriesLabel: m.coherent ? 'interference × diffraction' : 'diffraction envelope only',
      color: '#6ee7ff',
      points,
      live: { x: m.probeMm, y: m.intensity },
      guides: [
        { axis: 'x', value: m.beta * 1000, label: 'β', color: '#ffc65c' },
        { axis: 'x', value: -m.beta * 1000, label: '', color: '#ffc65c' }
      ]
    }),
    issues,
    description: `Light of wavelength ${m.lambdaNm} nanometre falls on two slits ${m.sepMm.toFixed(2)} millimetre apart, each ${m.widthUm.toFixed(0)} micrometre wide, with the screen ${m.distance.toFixed(2)} metre away. The probe at ${m.probeMm.toFixed(2)} millimetre reads ${(m.intensity * 100).toFixed(1)} per cent of the peak intensity.`,
    result: m.coherent
      ? `The fringe width is β = λD/d = ${(m.beta * 1000).toFixed(4)} mm, so λ = βd/D = ${formatSI(m.lambdaMeasured, 4)} m, or ${(m.lambdaMeasured * 1e9).toFixed(1)} nm. About ${m.fringesVisible.toFixed(0)} fringes fit inside the central diffraction maximum.`
      : `With incoherent sources the fringes vanish and the screen shows only the single-slit diffraction envelope of each slit; no fringe width can be measured.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const rgb = wavelengthToRgb(m.lambdaNm);
  const beam = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const slitX = 260;
  const screenX = 660;
  const axisY = 250;
  const mmToPx = 6.6;
  const patternRef = useRef<SVGGElement>(null);

  // The fringe strip is repainted imperatively so sweeping a knob stays smooth.
  useEffect(() => {
    const g = patternRef.current;
    if (!g) return;
    const bands = Array.from(g.querySelectorAll('rect'));
    bands.forEach((rect, k) => {
      const mm = -20 + (k / (bands.length - 1)) * 40;
      const yy = mm / 1000;
      const env = singleSlitIntensity(yy, m.lambda, m.distance, m.a);
      const i = m.coherent ? doubleSlitIntensity(yy, m.lambda, m.distance, m.d) * env : env * 0.5;
      rect.setAttribute('opacity', String(Math.max(0.02, Math.min(1, i))));
    });
  });

  const gapPx = Math.max(m.sepMm * 26, 8);

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Young’s double slit · d = {m.sepMm.toFixed(2)} mm · λ = {m.lambdaNm} nm · D = {m.distance.toFixed(2)} m
      </text>

      <rect x={70} y={axisY - 16} width={54} height={32} rx={4} fill="#1d2836" stroke="#3a5069" strokeWidth={1.2} />
      <text x={97} y={axisY + 30} textAnchor="middle" fontSize={9.5} fill="#8497ad">
        {m.coherent ? 'coherent source' : 'two lamps'}
      </text>
      {[-6, 0, 6].map((dy) => (
        <line key={dy} x1={124} y1={axisY + dy} x2={slitX} y2={axisY + dy} stroke={beam} strokeWidth={1.4} opacity={0.75} />
      ))}

      {/* Double slit: the two apertures are drawn to the model's separation. */}
      <rect x={slitX - 5} y={110} width={10} height={140 - gapPx / 2 - 3} fill="url(#lab-metal)" />
      <rect x={slitX - 5} y={axisY - gapPx / 2 + 3} width={10} height={gapPx - 6} fill="url(#lab-metal)" />
      <rect x={slitX - 5} y={axisY + gapPx / 2 + 3} width={10} height={140} fill="url(#lab-metal)" />
      <text x={slitX} y={102} textAnchor="middle" fontSize={9.5} fill="#8497ad">
        d = {m.sepMm.toFixed(2)} mm · a = {m.widthUm.toFixed(0)} µm
      </text>

      {/* Wavefronts spreading from each slit. */}
      {[-1, 1].map((s) =>
        Array.from({ length: 6 }, (_, k) => (
          <circle
            key={`${s}-${k}`}
            cx={slitX}
            cy={axisY + (s * gapPx) / 2}
            r={40 + k * 46}
            fill="none"
            stroke={beam}
            strokeWidth={0.9}
            opacity={m.coherent ? 0.2 : 0.08}
          />
        ))
      )}

      {/* The fringe pattern on the screen. */}
      <rect x={screenX} y={axisY - 20 * mmToPx} width={28} height={40 * mmToPx} fill="#0b1119" stroke="#3a5069" strokeWidth={1.2} />
      <g ref={patternRef}>
        {Array.from({ length: 180 }, (_, k) => (
          <rect
            key={k}
            x={screenX + 1}
            y={axisY - 20 * mmToPx + (k * (40 * mmToPx)) / 180}
            width={26}
            height={(40 * mmToPx) / 180 + 0.6}
            fill={beam}
          />
        ))}
      </g>
      <text x={screenX + 14} y={axisY + 20 * mmToPx + 18} textAnchor="middle" fontSize={9.5} fill="#8497ad">screen</text>

      {/* Fringe-width caliper on the screen. */}
      {m.coherent && m.beta * 1000 * mmToPx > 6 ? (
        <g>
          <line x1={screenX - 12} y1={axisY} x2={screenX - 12} y2={axisY - m.beta * 1000 * mmToPx} stroke="#ffc65c" strokeWidth={1.4} />
          <text x={screenX - 18} y={axisY - (m.beta * 1000 * mmToPx) / 2} textAnchor="end" fontSize={9.5} fill="#ffc65c">
            β = {(m.beta * 1000).toFixed(3)} mm
          </text>
        </g>
      ) : null}

      <g transform={`translate(${screenX + 42} ${axisY + m.probeMm * mmToPx})`}>
        <line x1={-14} y1={0} x2={0} y2={0} stroke="#ffc65c" strokeWidth={1.6} />
        <circle r={4} fill="#ffc65c" className="stage-pin" />
        <text x={10} y={4} fontSize={9.5} fill="#ffc65c" fontFamily="ui-monospace, monospace">
          {m.probeMm.toFixed(2)} mm
        </text>
      </g>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        β = λD/d = {(m.beta * 1000).toFixed(4)} mm → λ = βd/D = {(m.lambdaMeasured * 1e9).toFixed(1)} nm
      </text>

      <Knob spec={control('lambda', 'slider')} params={params} onChange={set} x={110} y={100} radius={19} label="Wavelength — turn the dial" />
      <Knob spec={control('sep', 'slider')} params={params} onChange={set} x={230} y={388} radius={19} label="Slit separation — turn the dial" />
      <Knob spec={control('distance', 'slider')} params={params} onChange={set} x={360} y={388} radius={19} label="Slit-to-screen distance — turn the dial" />
      <Knob spec={control('width', 'slider')} params={params} onChange={set} x={490} y={388} radius={19} label="Width of each slit — turn the dial" />
      <Knob spec={control('probe', 'slider')} params={params} onChange={set} x={700} y={100} radius={19} label="Probe position on the screen — turn the dial" />
      <StageSwitch spec={control('coherent', 'toggle')} params={params} onChange={set} x={620} y={388} label="Coherence" />
    </svg>
  );
}

export default function WaveOpticsExperiment() {
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
            <ViewPill label="β" value={(m.beta * 1000).toFixed(3)} unit="mm" />
            <ViewPill label="λ" value={(m.lambdaMeasured * 1e9).toFixed(0)} unit="nm" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — fringe width against screen distance',
          columns: [
            col('d', 'd', 'mm', 3),
            col('D', 'D', 'm', 2),
            col('n', 'fringes counted', '—', 0),
            col('span', 'span of n fringes', 'mm', 3),
            col('beta', 'β = span/n', 'mm', 4, true),
            col('lambda', 'λ = βd/D', 'nm', 1, true)
          ],
          capture: () => ({ d: m.sepMm, D: m.distance, n: 10, span: m.beta * 1000 * 10, beta: 0, lambda: 0 }),
          derive: (row) => {
            const beta = Number(row.span) / Number(row.n);
            return {
              ...row,
              beta,
              lambda: ((beta / 1000) * (Number(row.d) / 1000) * 1e9) / Number(row.D)
            };
          },
          comparison: {
            label: 'wavelength',
            unit: 'nm',
            experimental: m.lambdaMeasured * 1e9,
            theoretical: m.lambdaNm,
            precision: 2
          },
          captureEnabled: m.coherent,
          captureHint: 'Count ten fringes, measure the span, then record.'
        };
      }}
    />
  );
}

export { definition, education };
