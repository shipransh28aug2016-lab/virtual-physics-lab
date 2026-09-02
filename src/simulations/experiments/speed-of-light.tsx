import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { Ray } from '@/components/instruments/Instruments';
import { CONSTANTS } from '@/physics-engine/constants';
import { useReducedMotion } from '@/hooks/useAnimation';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './speed-of-light.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ffd257',
  controls: [
    { kind: 'slider', key: 'rpm', label: 'Rotation rate of the mirror', symbol: 'f', unit: 'rev/s', min: 100, max: 1200, step: 10, initial: 500, precision: 0, onStage: true },
    { kind: 'slider', key: 'distance', label: 'Distance to the distant mirror', symbol: 'D', unit: 'm', min: 200, max: 2000, step: 10, initial: 900, precision: 0, onStage: true },
    { kind: 'slider', key: 'lever', label: 'Optical lever arm', symbol: 'L', unit: 'm', min: 1, max: 10, step: 0.1, initial: 4, precision: 1, hint: 'Rotating mirror to the measuring scale', onStage: true },
    { kind: 'toggle', key: 'spin', label: 'Mirror spinning', initial: true, onStage: true }
  ],
  defaults: { rpm: 500, distance: 900, lever: 4, spin: true }
};

const education: EducationPack = {
  theory: [
    'Light is far too fast to time directly over a laboratory bench, so the rotating-mirror method converts a time into an angle. A beam is reflected off a mirror spinning at a known rate, travels out to a distant fixed mirror, and comes back. During the round trip the rotating mirror has turned through a small angle, so the returning beam leaves it in a slightly different direction.',
    'The deflection is small but measurable. In the time t = 2D/c that the light takes to make the round trip, a mirror rotating f times per second turns through θ = 2πf·t radians. A mirror deflects a beam through twice its own rotation, so the reflected beam is deflected by 2θ.',
    'Projecting that deflected beam onto a scale a distance L away turns the angle into a displacement s = 2θL. Every quantity on the right-hand side is measurable with ordinary instruments, so rearranging gives the speed of light from a rotation rate, two distances and a small displacement.',
    'Foucault used this method in 1862 and obtained a value within 1% of the modern one. Michelson later refined it with a long baseline between two mountains and reached a precision that stood for decades — the same geometry, scaled up.'
  ],
  formulas: [
    { tex: 't = \\frac{2D}{c}', caption: 'Round-trip time to the distant mirror.' },
    { tex: '\\theta = 2\\pi f t', caption: 'Angle turned by the mirror during the round trip.' },
    { tex: 's = 2\\theta L = \\frac{8\\pi f D L}{c}', caption: 'Displacement of the returning spot on the scale.' },
    { tex: 'c = \\frac{8\\pi f D L}{s}', caption: 'The speed of light from the four measured quantities.' }
  ],
  variables: [
    { symbol: 'f', name: 'Rotation rate of the mirror', unit: 'rev/s' },
    { symbol: 'D', name: 'Distance to the distant mirror', unit: 'm' },
    { symbol: 'L', name: 'Optical lever arm', unit: 'm' },
    { symbol: 's', name: 'Displacement of the returning spot', unit: 'm' },
    { symbol: 't', name: 'Round-trip time', unit: 's' },
    { symbol: 'c', name: 'Speed of light', unit: 'm/s' }
  ],
  procedure: [
    'Align the laser, the rotating mirror, the distant fixed mirror and the measuring scale so the beam returns to its starting point with the mirror at rest.',
    'Measure D from the rotating mirror to the distant mirror, and L from the rotating mirror to the scale.',
    'Mark the position of the returning spot with the mirror stationary — this is the zero.',
    'Spin the mirror at a measured rate and note the new position of the spot.',
    'Compute the displacement s and evaluate c = 8πfDL/s.',
    'Repeat for several rotation rates and plot s against f; the graph is a straight line through the origin.'
  ],
  precautions: [
    'Never look into the laser beam or along the return path.',
    'Guard the spinning mirror; at a thousand revolutions per second it is dangerous if it comes loose.',
    'Measure the rotation rate with a stroboscope or a counter, not by ear.',
    'Take the zero reading with the mirror at rest, immediately before and after each run.'
  ],
  sourcesOfError: [
    'The displacement is small — a fraction of a millimetre — so reading the scale dominates the error.',
    'Uncertainty in the rotation rate, especially if the motor is not governed.',
    'Air currents along a long baseline deflect the beam.',
    'The finite width of the laser spot on the scale.'
  ],
  tips: [
    'Double the rotation rate and watch the displacement double — the graph of s against f passes through the origin.',
    'Push the distant mirror out to 2 km and see how much easier the measurement becomes.'
  ],
  viva: [
    { q: 'Why is a rotating mirror used?', a: 'It converts an unmeasurably short time into a measurable angle, since the mirror turns a little while the light makes its round trip.' },
    { q: 'Why is the deflection twice the rotation of the mirror?', a: 'Rotating a mirror by θ rotates the reflected ray by 2θ.' },
    { q: 'What happens if the mirror spins faster?', a: 'It turns through a larger angle in the same round-trip time, so the spot is displaced further.' },
    { q: 'Why must the distant mirror be far away?', a: 'The round-trip time, and hence the displacement, is proportional to D; a short baseline gives an immeasurably small shift.' },
    { q: 'Who first measured the speed of light this way?', a: 'Foucault, in 1862, using a rotating mirror; Michelson later refined the method over a long baseline.' }
  ],
  resultTemplate:
    'The displacement of the returning spot is proportional to the rotation rate, and the speed of light computed from c = 8πfDL/s agrees with the accepted value of 3.00 × 10⁸ m/s.'
};

function model(params: ParamValues) {
  const f = num(params, 'rpm', 500);
  const distance = num(params, 'distance', 900);
  const lever = num(params, 'lever', 4);
  const spinning = params.spin !== false;

  const c = CONSTANTS.C_LIGHT;
  const roundTrip = (2 * distance) / c;
  const theta = spinning ? 2 * Math.PI * f * roundTrip : 0;
  // Displacement on the scale, from the doubled mirror rotation.
  const shift = 2 * theta * lever;
  const cMeasured = shift > 0 ? (8 * Math.PI * f * distance * lever) / shift : Number.NaN;

  return { f, distance, lever, spinning, roundTrip, theta, shift, cMeasured, c };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('distance', 'Distance to the distant mirror', m.distance),
    validateRange('rpm', 'Rotation rate', m.f, 100, 1200)
  );
  if (m.shift > 0 && m.shift < 2e-4) {
    issues.push({
      field: 'rpm',
      severity: 'warning',
      message: `The spot moves by only ${formatSI(m.shift, 3)} m — below what the scale can resolve. Spin faster or lengthen the baseline.`
    });
  }
  if (!m.spinning) {
    issues.push({ field: 'spin', severity: 'info', message: 'With the mirror at rest the beam returns to the zero mark; that is the reference reading.' });
  }

  const points: { x: number; y: number }[] = [];
  for (let f = 100; f <= 1200; f += 10) {
    points.push({ x: f, y: ((8 * Math.PI * f * m.distance * m.lever) / m.c) * 1000 });
  }

  return {
    readouts: [
      ro('t', 'Round-trip time t = 2D/c', m.roundTrip, 's', 3),
      ro('theta', 'Mirror turns through θ', (m.theta * 180) / Math.PI, '°', 5),
      ro('s', 'Displacement of the spot s', m.shift * 1000, 'mm', 4, { tone: m.shift < 2e-4 && m.shift > 0 ? 'alert' : 'normal' }),
      ro('c', 'Speed of light c = 8πfDL/s', m.cMeasured, 'm/s', 4, { text: m.spinning ? undefined : 'spin the mirror' }),
      ro('f', 'Rotation rate f', m.f, 'rev/s', 0, { sub: `${(m.f * 60).toFixed(0)} rpm` }),
      ro('lever', 'Optical lever L', m.lever, 'm', 2)
    ],
    graph: singleSeriesGraph({
      title: 'Displacement of the returning spot against rotation rate',
      xLabel: 'f (rev/s)',
      yLabel: 's (mm)',
      seriesLabel: 's = 8πfDL/c',
      color: '#ffd257',
      points,
      live: m.spinning ? { x: m.f, y: m.shift * 1000 } : undefined,
      markers: m.spinning ? [{ x: m.f, y: m.shift * 1000, label: `${(m.shift * 1000).toFixed(3)} mm`, color: '#ffc65c' }] : []
    }),
    issues,
    description: `A mirror spinning at ${m.f.toFixed(0)} revolutions per second sends light to a fixed mirror ${m.distance.toFixed(0)} metre away and back. The optical lever to the scale is ${m.lever.toFixed(1)} metre and the returning spot is displaced by ${formatSI(m.shift, 3)} metre.`,
    result: m.spinning
      ? `The round trip takes t = 2D/c = ${formatSI(m.roundTrip, 3)} s, during which the mirror turns through ${((m.theta * 180) / Math.PI).toFixed(5)}°. The spot therefore moves ${(m.shift * 1000).toFixed(4)} mm, and c = 8πfDL/s = ${formatSI(m.cMeasured, 4)} m/s against the accepted 2.998 × 10⁸ m/s.`
      : `With the mirror at rest the beam retraces its own path and the spot sits at the zero of the scale. Spin the mirror to displace it.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const reduced = useReducedMotion();
  const mirrorRef = useRef<SVGGElement>(null);

  // The mirror spins on rAF without ever touching React state.
  useEffect(() => {
    const g = mirrorRef.current;
    if (!g || !m.spinning || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      // Slowed by a large factor so the rotation is visible at all.
      const angle = (((now - t0) / 1000) * m.f * 12) % 360;
      g.setAttribute('transform', `translate(250 250) rotate(${angle.toFixed(1)})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [m.spinning, m.f, reduced]);

  // The displacement is microscopic, so the scale is drawn hugely magnified.
  const spotPx = Math.max(-90, Math.min(90, m.shift * 1e5));

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={36} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Rotating-mirror method · f = {m.f.toFixed(0)} rev/s · D = {m.distance.toFixed(0)} m
      </text>

      {/* Laser and the beam to the rotating mirror. */}
      <rect x={70} y={334} width={54} height={30} rx={4} fill="#1d2836" stroke="#3a5069" strokeWidth={1.2} />
      <text x={97} y={378} textAnchor="middle" fontSize={9.5} fill="#8497ad">laser</text>
      <Ray from={{ x: 124, y: 349 }} to={{ x: 250, y: 250 }} color="#ffd257" width={1.8} />

      {/* Rotating mirror, spun by rAF. */}
      <g ref={mirrorRef} transform="translate(250 250)">
        <rect x={-32} y={-3} width={64} height={6} rx={2} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={0.8} />
      </g>
      <circle cx={250} cy={250} r={40} fill="none" stroke="#3a5069" strokeWidth={1} strokeDasharray="3 4" />
      <text x={250} y={306} textAnchor="middle" fontSize={9.5} fill="#8497ad">
        rotating mirror
      </text>

      {/* Long baseline to the distant fixed mirror. */}
      <Ray from={{ x: 250, y: 250 }} to={{ x: 700, y: 160 }} color="#ffd257" width={1.6} />
      <Ray from={{ x: 700, y: 168 }} to={{ x: 250, y: 258 }} color="#ffb454" width={1.4} />
      <rect x={700} y={130} width={8} height={70} rx={2} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={1} />
      <text x={704} y={122} textAnchor="middle" fontSize={9.5} fill="#8497ad">distant mirror</text>
      <line x1={250} y1={214} x2={700} y2={124} className="dim-line" />
      <text x={475} y={158} textAnchor="middle" fontSize={10} fill="#5e7189">
        D = {m.distance.toFixed(0)} m
      </text>

      {/* Measuring scale at the end of the optical lever. */}
      <line x1={120} y1={200} x2={120} y2={20} stroke="#5e7189" strokeWidth={1.4} />
      {Array.from({ length: 9 }, (_, k) => (
        <line key={k} x1={114} y1={30 + k * 20} x2={126} y2={30 + k * 20} stroke="#5e7189" strokeWidth={1} />
      ))}
      <text x={132} y={26} fontSize={9.5} fill="#8497ad">scale · L = {m.lever.toFixed(1)} m</text>
      <line x1={100} y1={110} x2={140} y2={110} stroke="#45d68b" strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={96} y={114} textAnchor="end" fontSize={9} fill="#45d68b">zero</text>
      <circle cx={120} cy={110 - spotPx} r={5} fill="#ffd257" filter="url(#lab-glow)" />
      <text x={144} y={114 - spotPx} fontSize={9.5} fill="#ffd257" fontFamily="ui-monospace, monospace">
        s = {(m.shift * 1000).toFixed(4)} mm
      </text>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        c = 8πfDL/s = {formatSI(m.cMeasured, 4)} m/s · t = 2D/c = {formatSI(m.roundTrip, 3)} s
      </text>

      <Knob spec={control('rpm', 'slider')} params={params} onChange={set} x={330} y={388} radius={20} label="Rotation rate of the mirror — turn the dial" />
      <Knob spec={control('distance', 'slider')} params={params} onChange={set} x={470} y={388} radius={20} label="Distance to the distant mirror — turn the dial" />
      <Knob spec={control('lever', 'slider')} params={params} onChange={set} x={610} y={388} radius={19} label="Optical lever arm — turn the dial" />
      <StageSwitch spec={control('spin', 'toggle')} params={params} onChange={set} x={730} y={388} label="Motor" />
    </svg>
  );
}

export default function SpeedOfLightExperiment() {
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
            <ViewPill label="s" value={(m.shift * 1000).toFixed(4)} unit="mm" />
            <ViewPill label="c" value={formatSI(m.cMeasured, 4)} unit="m/s" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — displacement against rotation rate',
          columns: [
            col('f', 'f', 'rev/s', 0),
            col('D', 'D', 'm', 0),
            col('L', 'L', 'm', 2),
            col('s', 's', 'mm', 4),
            col('c', 'c = 8πfDL/s', 'm/s', 0, true)
          ],
          capture: () => ({ f: m.f, D: m.distance, L: m.lever, s: m.shift * 1000, c: 0 }),
          derive: (row) => {
            const s = Number(row.s) / 1000;
            return {
              ...row,
              c: s > 0 ? (8 * Math.PI * Number(row.f) * Number(row.D) * Number(row.L)) / s : Number.NaN
            };
          },
          comparison: {
            label: 'speed of light',
            unit: '×10⁸ m/s',
            experimental: m.cMeasured / 1e8,
            theoretical: CONSTANTS.C_LIGHT / 1e8,
            precision: 4
          },
          captureEnabled: m.spinning,
          captureHint: 'Take the zero with the mirror at rest, then spin it and record the displacement.'
        };
      }}
    />
  );
}

export { definition, education };
