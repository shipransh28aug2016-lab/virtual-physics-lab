import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { SolenoidSvg } from '@/components/instruments/Instruments';
import { idealSolenoidField } from '@/physics-engine/magnetism';
import { CONSTANTS } from '@/physics-engine/constants';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { DragX, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './solenoid-field.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#7dd3fc',
  controls: [
    { kind: 'slider', key: 'current', label: 'Current in the winding', symbol: 'I', unit: 'A', min: 0, max: 5, step: 0.05, initial: 2, precision: 2, onStage: true },
    { kind: 'slider', key: 'turns', label: 'Total number of turns', symbol: 'N', unit: '', min: 100, max: 2000, step: 10, initial: 800, precision: 0, onStage: true },
    { kind: 'slider', key: 'length', label: 'Length of the solenoid', symbol: 'L', unit: 'cm', min: 10, max: 60, step: 0.5, initial: 30, precision: 1, onStage: true },
    { kind: 'slider', key: 'radius', label: 'Radius of the solenoid', symbol: 'a', unit: 'cm', min: 1, max: 8, step: 0.1, initial: 2.5, precision: 1, onStage: true },
    { kind: 'slider', key: 'probe', label: 'Probe position from the centre', symbol: 'x', unit: 'cm', min: -45, max: 45, step: 0.5, initial: 0, precision: 1, onStage: true }
  ],
  defaults: { current: 2, turns: 800, length: 30, radius: 2.5, probe: 0 }
};

const education: EducationPack = {
  theory: [
    'A solenoid is a long coil of closely wound turns. Inside a long solenoid the fields of neighbouring turns add along the axis and cancel across it, so the field is uniform, directed along the axis, and given by B = µ₀nI where n is the number of turns per unit length.',
    'The result does not depend on the radius of the solenoid at all, nor on where inside it the probe sits — provided the solenoid is long compared with its radius. That is what makes a solenoid the standard laboratory source of a uniform magnetic field.',
    'A real solenoid has ends, and the ideal formula fails there. Summing the contributions of all the turns using the Biot–Savart law gives the exact axial field, from which the field exactly at the mouth of a long solenoid comes out at half the value inside — the field falls to 50% at the end and towards zero outside.',
    'Comparing the exact axial profile with the ideal µ₀nI shows how good the "long solenoid" approximation really is: for a solenoid ten times longer than its radius the central field is within about half a percent of the ideal value.'
  ],
  formulas: [
    { tex: 'B = \\mu_0 n I', caption: 'Ideal field inside a long solenoid, n = N/L.' },
    { tex: 'B = \\frac{\\mu_0 n I}{2}\\left(\\cos\\theta_1 - \\cos\\theta_2\\right)', caption: 'Exact axial field of a finite solenoid.' },
    { tex: 'B_{end} = \\frac{\\mu_0 n I}{2}', caption: 'The field at the mouth is half the field at the centre.' },
    { tex: 'n = \\frac{N}{L}', caption: 'Turns per unit length.' }
  ],
  variables: [
    { symbol: 'B', name: 'Magnetic flux density', unit: 'T' },
    { symbol: 'I', name: 'Current in the winding', unit: 'A' },
    { symbol: 'N', name: 'Total number of turns', unit: '—' },
    { symbol: 'L', name: 'Length of the solenoid', unit: 'm' },
    { symbol: 'n', name: 'Turns per unit length', unit: 'm⁻¹' },
    { symbol: 'a', name: 'Radius of the solenoid', unit: 'm' },
    { symbol: 'x', name: 'Position of the probe from the centre', unit: 'm' }
  ],
  procedure: [
    'Connect the solenoid in series with an ammeter, a rheostat and the supply.',
    'Place the Hall probe at the centre of the solenoid, aligned along its axis.',
    'Set a convenient current and note the field at the centre.',
    'Move the probe in steps along the axis and note the field at each position, including outside the ends.',
    'Plot B against x and mark the two ends of the solenoid on the graph.',
    'Repeat for several currents and confirm that the central field is proportional to I.',
    'Compute µ₀nI and compare it with the measured central field.'
  ],
  precautions: [
    'Keep the probe aligned with the axis; a tilted probe reads B cos θ, not B.',
    'Do not exceed the current rating of the winding — the wire heats quickly.',
    'Keep iron and other magnetic material well away from the solenoid.',
    'Allow for the earth’s field, about 5 × 10⁻⁵ T, when the solenoid field is small.'
  ],
  sourcesOfError: [
    'The turns are not perfectly uniform along the winding.',
    'The Hall probe has a finite size, so it averages the field over a small region.',
    'The earth’s magnetic field adds to or subtracts from the reading.',
    'Heating of the winding changes its resistance and hence the current.'
  ],
  tips: [
    'Move the probe to exactly one end and check that the field is half its central value.',
    'Change the radius and watch the central field stay put — B = µ₀nI has no radius in it.'
  ],
  viva: [
    { q: 'Does the field inside a long solenoid depend on its radius?', a: 'No. B = µ₀nI involves only the turns per unit length and the current.' },
    { q: 'What is the field just outside a long solenoid?', a: 'Very nearly zero; the return flux spreads over a large area outside.' },
    { q: 'Why is the field at the end half that at the centre?', a: 'At the mouth only half the winding contributes on each side, so the sum over the turns gives half the value.' },
    { q: 'How would an iron core change the field?', a: 'It multiplies it by the relative permeability of the iron, which can be several thousand.' },
    { q: 'What does µ₀ stand for?', a: 'The permeability of free space, 4π × 10⁻⁷ T m/A.' }
  ],
  resultTemplate:
    'The axial field is uniform over the central region and falls to half its value at each end; the measured central field agrees with B = µ₀nI.'
};

/**
 * Exact on-axis field of a finite solenoid at distance x from its centre,
 * obtained by summing the turns:  B = ½µ₀nI (cosθ₁ − cosθ₂).
 */
function axialField(current: number, turns: number, lengthM: number, radiusM: number, xM: number): number {
  if (lengthM <= 0) return 0;
  const n = turns / lengthM;
  const half = lengthM / 2;
  const z1 = half - xM;
  const z2 = -half - xM;
  const c1 = z1 / Math.hypot(z1, radiusM);
  const c2 = z2 / Math.hypot(z2, radiusM);
  return 0.5 * CONSTANTS.MU_0 * n * current * (c1 - c2);
}

function model(params: ParamValues) {
  const current = num(params, 'current', 2);
  const turns = num(params, 'turns', 800);
  const lengthCm = num(params, 'length', 30);
  const radiusCm = num(params, 'radius', 2.5);
  const probeCm = num(params, 'probe', 0);

  const lengthM = lengthCm / 100;
  const radiusM = radiusCm / 100;
  const n = lengthM > 0 ? turns / lengthM : 0;
  const ideal = idealSolenoidField(current, n);
  const exact = axialField(current, turns, lengthM, radiusM, probeCm / 100);
  const centre = axialField(current, turns, lengthM, radiusM, 0);
  const inside = Math.abs(probeCm) <= lengthCm / 2;

  return { current, turns, lengthCm, radiusCm, probeCm, lengthM, radiusM, n, ideal, exact, centre, inside };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('turns', 'Number of turns', m.turns),
    validatePositive('length', 'Length of the solenoid', m.lengthCm),
    validateRange('current', 'Current in the winding', m.current, 0, 5)
  );
  if (m.lengthCm < 6 * m.radiusCm) {
    issues.push({
      field: 'length',
      severity: 'warning',
      message: `The solenoid is only ${(m.lengthCm / m.radiusCm).toFixed(1)} radii long, so it is not a "long" solenoid and B = µ₀nI is a poor approximation.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let x = -45; x <= 45; x += 0.5) {
    points.push({ x, y: axialField(m.current, m.turns, m.lengthM, m.radiusM, x / 100) * 1000 });
  }

  const deviation = m.ideal === 0 ? 0 : ((m.centre - m.ideal) / m.ideal) * 100;

  return {
    readouts: [
      ro('b', 'Field at the probe B', m.exact, 'T', 3, { sub: m.inside ? 'inside the winding' : 'outside the ends' }),
      ro('ideal', 'Ideal µ₀nI', m.ideal, 'T', 3),
      ro('centre', 'Field at the centre', m.centre, 'T', 3, { sub: `${deviation.toFixed(2)} % from ideal` }),
      ro('n', 'Turns per metre n', m.n, 'm⁻¹', 1),
      ro('ratio', 'B / B_centre', m.centre === 0 ? 0 : m.exact / m.centre, '—', 3, { tone: Math.abs(m.probeCm) > m.lengthCm / 2 ? 'dim' : 'normal' }),
      ro('aspect', 'Length / radius', m.radiusCm > 0 ? m.lengthCm / m.radiusCm : 0, '—', 1, { tone: m.lengthCm < 6 * m.radiusCm ? 'alert' : 'normal' })
    ],
    graph: singleSeriesGraph({
      title: 'Axial magnetic field along the solenoid',
      xLabel: 'x from the centre (cm)',
      yLabel: 'B (mT)',
      seriesLabel: 'exact axial field',
      color: '#7dd3fc',
      points,
      live: { x: m.probeCm, y: m.exact * 1000 },
      guides: [
        { axis: 'y', value: m.ideal * 1000, label: 'µ₀nI', color: '#ffc65c' },
        { axis: 'x', value: -m.lengthCm / 2, label: 'end', color: '#5e7189' },
        { axis: 'x', value: m.lengthCm / 2, label: 'end', color: '#5e7189' }
      ]
    }),
    issues,
    description: `A solenoid ${m.lengthCm.toFixed(1)} centimetre long and ${m.radiusCm.toFixed(1)} centimetre in radius carries ${m.current.toFixed(2)} ampere through ${m.turns.toFixed(0)} turns. The probe sits ${m.probeCm.toFixed(1)} centimetre from the centre, ${m.inside ? 'inside' : 'outside'} the winding.`,
    result: `With n = N/L = ${m.n.toFixed(1)} turns per metre the ideal field is µ₀nI = ${formatSI(m.ideal, 3)} T. The exact sum over the turns gives ${formatSI(m.centre, 3)} T at the centre — ${deviation.toFixed(2)}% away — and ${formatSI(m.exact, 3)} T at the probe.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const scale = 640 / 90; // pixels per centimetre across the ±45 cm sweep
  const centreX = 410;
  const axisY = 250;
  const halfPx = (m.lengthCm / 2) * scale;
  const probeX = centreX + m.probeCm * scale;
  const radiusPx = Math.max(m.radiusCm * scale, 6);
  const live = m.current > 0.01;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={38} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Solenoid · N = {m.turns.toFixed(0)} · L = {m.lengthCm.toFixed(1)} cm · I = {m.current.toFixed(2)} A
      </text>

      <line x1={40} y1={axisY} x2={780} y2={axisY} className="dim-line" />
      <SolenoidSvg x={centreX - halfPx} y={axisY} length={halfPx * 2} radius={radiusPx} turns={Math.round(m.lengthCm / 1.6)} live={live} />

      {/* Field lines inside the winding, spaced by the strength of the field. */}
      {live
        ? [-0.55, -0.25, 0, 0.25, 0.55].map((f) => (
            <line
              key={f}
              x1={centreX - halfPx + 6}
              y1={axisY + f * radiusPx * 1.5}
              x2={centreX + halfPx - 6}
              y2={axisY + f * radiusPx * 1.5}
              stroke="#7dd3fc"
              strokeWidth={1.2}
              opacity={0.5}
              markerEnd="url(#ray-head-cool)"
            />
          ))
        : null}

      {/* Hall probe. */}
      <g transform={`translate(${probeX} ${axisY})`}>
        <line x1={0} y1={-radiusPx - 46} x2={0} y2={0} stroke="#ffc65c" strokeWidth={1.6} />
        <rect x={-11} y={-radiusPx - 62} width={22} height={18} rx={3} fill="#1d2836" stroke="#ffc65c" strokeWidth={1.2} />
        <circle r={3.4} fill="#ffc65c" className="stage-pin" />
        <text y={-radiusPx - 68} textAnchor="middle" fontSize={9.5} fill="#ffc65c">
          Hall probe
        </text>
      </g>
      <text x={probeX} y={axisY + 26} textAnchor="middle" fontSize={10} fill="#ffc65c" fontFamily="ui-monospace, monospace">
        x = {m.probeCm.toFixed(1)} cm · B = {formatSI(m.exact, 3)} T
      </text>

      {/* End markers. */}
      {[-1, 1].map((s) => (
        <line key={s} x1={centreX + s * halfPx} y1={axisY - radiusPx - 12} x2={centreX + s * halfPx} y2={axisY + radiusPx + 12} stroke="#5e7189" strokeWidth={1} strokeDasharray="3 3" />
      ))}

      <text x={410} y={440} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        B = µ₀nI = {formatSI(m.ideal, 3)} T · exact centre {formatSI(m.centre, 3)} T · n = {m.n.toFixed(0)} m⁻¹
      </text>

      <Knob spec={control('current', 'slider')} params={params} onChange={set} x={110} y={92} radius={19} label="Current in the winding — turn the dial" />
      <Knob spec={control('turns', 'slider')} params={params} onChange={set} x={240} y={92} radius={19} label="Number of turns — turn the dial" />
      <Knob spec={control('length', 'slider')} params={params} onChange={set} x={580} y={92} radius={19} label="Length of the solenoid — turn the dial" />
      <Knob spec={control('radius', 'slider')} params={params} onChange={set} x={710} y={92} radius={19} label="Radius of the solenoid — turn the dial" />
      {/* The probe is the control: drag it along the axis. */}
      <DragX
        spec={control('probe', 'slider')}
        params={params}
        onChange={set}
        x={centreX - 45 * scale}
        y={axisY + 62}
        length={90 * scale}
        mapping={{ toValue: (dx) => dx / scale, invert: (x) => centreX + x * scale }}
        label="Hall probe — drag it along the axis of the solenoid"
      />
    </svg>
  );
}

export default function SolenoidFieldExperiment() {
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
            <ViewPill label="B" value={formatSI(m.exact, 3)} unit="T" />
            <ViewPill label="n" value={m.n.toFixed(0)} unit="m⁻¹" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — axial field against probe position',
          columns: [
            col('i', 'I', 'A', 2),
            col('x', 'x', 'cm', 1),
            col('b', 'B', 'mT', 4),
            col('ratio', 'B/B₀', '—', 3, true)
          ],
          capture: () => ({ i: m.current, x: m.probeCm, b: m.exact * 1000, ratio: 0 }),
          derive: (row) => ({ ...row, ratio: m.centre === 0 ? Number.NaN : Number(row.b) / (m.centre * 1000) }),
          comparison: {
            label: 'central field',
            unit: 'mT',
            experimental: m.centre * 1000,
            theoretical: m.ideal * 1000,
            precision: 4
          },
          captureHint: 'Step the probe along the axis and record the field at each position.'
        };
      }}
    />
  );
}

export { definition, education };
