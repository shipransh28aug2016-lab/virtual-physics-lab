import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BarMagnet } from '@/components/instruments/Instruments';
import { useReducedMotion } from '@/hooks/useAnimation';
import { lorentzForce, gyroradius } from '@/physics-engine/magnetism';
import { CONSTANTS } from '@/physics-engine/constants';
import { degToRad } from '@/physics-engine/units';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './magnetic-force-charge.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#45d68b',
  controls: [
    { kind: 'select', key: 'particle', label: 'Particle', initial: 'electron', options: [
      { value: 'electron', label: 'Electron' }, { value: 'proton', label: 'Proton' }, { value: 'alpha', label: 'Alpha particle' }
    ] },
    { kind: 'slider', key: 'speed', label: 'Speed of the particle', symbol: 'v', unit: 'km/s', min: 10, max: 50000, step: 10, initial: 5000, scale: 'log' },
    { kind: 'slider', key: 'b', label: 'Magnetic field', symbol: 'B', unit: 'T', min: 0.01, max: 2, step: 0.01, initial: 0.5, precision: 2, scale: 'log' },
    { kind: 'slider', key: 'angle', label: 'Angle of entry to the field', symbol: '\\theta', unit: '°', min: 0, max: 90, step: 1, initial: 90, hint: 'Below 90° the path is a helix' },
    { kind: 'select', key: 'sign', label: 'Charge sign', initial: 'negative', options: [{ value: 'negative', label: 'Negative' }, { value: 'positive', label: 'Positive' }] },
    { kind: 'toggle', key: 'animate', label: 'Animate the trajectory', initial: true }
  ],
  defaults: { particle: 'electron', speed: 5000, b: 0.5, angle: 90, sign: 'negative', animate: true }
};

const PARTICLES: Record<string, { label: string; m: number; q: number }> = {
  electron: { label: 'electron', m: CONSTANTS.M_E, q: CONSTANTS.E_CHARGE },
  proton: { label: 'proton', m: CONSTANTS.M_P, q: CONSTANTS.E_CHARGE },
  alpha: { label: 'alpha particle', m: 4 * CONSTANTS.M_P, q: 2 * CONSTANTS.E_CHARGE }
};

const education: EducationPack = {
  theory: [
    'A charge moving in a magnetic field experiences a force qv × B that is always perpendicular both to the velocity and to the field. Because the force is perpendicular to the motion it can change the direction of the velocity but never its magnitude.',
    'When the velocity is exactly perpendicular to the field the force acts as a centripetal force and the particle travels in a circle of radius r = mv/qB. The time for one revolution, T = 2πm/qB, is independent of the speed.',
    'When the velocity has a component along the field, that component is unaffected while the perpendicular component produces circular motion. The combination is a helix whose pitch is the parallel speed multiplied by the period.'
  ],
  formulas: [
    { tex: '\\vec{F} = q \\vec{v} \\times \\vec{B}', caption: 'Lorentz force.' },
    { tex: 'F = qvB\\sin\\theta', caption: 'Magnitude.' },
    { tex: 'r = \\frac{mv}{qB}', caption: 'Radius of the circular path.' },
    { tex: 'T = \\frac{2\\pi m}{qB}', caption: 'Period, independent of speed.' },
    { tex: 'p = v_\\parallel T', caption: 'Pitch of the helix.' }
  ],
  variables: [
    { symbol: 'r', name: 'Radius of the path', unit: 'm' },
    { symbol: 'v', name: 'Speed', unit: 'm/s' },
    { symbol: 'B', name: 'Magnetic flux density', unit: 'T' },
    { symbol: 'q', name: 'Charge', unit: 'C' },
    { symbol: 'm', name: 'Mass', unit: 'kg' },
    { symbol: 'T', name: 'Period of revolution', unit: 's' }
  ],
  procedure: [
    'Choose the particle and set its speed and the field strength.',
    'Enter the field at 90° and observe the circular path; note the radius.',
    'Reduce the entry angle and observe the helical path and its pitch.',
    'Reverse the sign of the charge and confirm that the sense of rotation reverses.'
  ],
  precautions: ['The field must be uniform over the whole path, otherwise the radius changes as the particle moves.', 'At very high speed relativistic corrections become important and the classical radius is too small.', 'Collisions with gas molecules in a real tube shorten the visible path.'],
  tips: ['Double the speed and the radius doubles, but the period stays the same — that is the basis of the cyclotron.'],
  viva: [
    { q: 'Why does the magnetic field not change the speed?', a: 'Because the force is always perpendicular to the velocity, so it does no work.' },
    { q: 'Why is the period independent of speed?', a: 'Because a faster particle travels a proportionally larger circle, and the two effects cancel in T = 2πm/qB.' },
    { q: 'What happens if the velocity is parallel to the field?', a: 'The force is zero and the particle continues in a straight line.' },
    { q: 'How can this motion be used to measure q/m?', a: 'By measuring the radius for a known speed and field, since q/m = v/(rB).' },
    { q: 'Which way does an electron curve compared with a proton at the same speed?', a: 'In the opposite sense, and with a much smaller radius because its mass is far smaller.' }
  ],
  resultTemplate: 'The charged particle follows a circular path of radius r = mv/qB, or a helix when it has a velocity component along the field.'
};

function compute(params: ParamValues): ModelOutput {
  const key = String(params.particle ?? 'electron');
  const p = PARTICLES[key] ?? PARTICLES.electron!;
  const sign = String(params.sign ?? 'negative') === 'negative' ? -1 : 1;
  const v = num(params, 'speed', 5000) * 1000;
  const b = num(params, 'b', 0.5);
  const angle = num(params, 'angle', 90);
  const q = p.q * sign;
  const force = lorentzForce(q, v, b, angle);
  const r = gyroradius(p.m, v * Math.sin(degToRad(angle)), p.q, b);
  const period = (2 * Math.PI * p.m) / (p.q * b);
  const pitch = v * Math.cos(degToRad(angle)) * period;
  const ke = 0.5 * p.m * v * v;
  const points: { x: number; y: number }[] = [];
  for (let bb = 0.01; bb <= 2; bb += 0.01) points.push({ x: bb, y: gyroradius(p.m, v * Math.sin(degToRad(angle)), p.q, bb) * 100 });

  return {
    readouts: [
      ro('r', 'Radius of the path', r, 'm', 6, { sub: `${(r * 100).toFixed(3)} cm` }),
      ro('f', 'Magnetic force', force, 'N', 22, { sub: formatSI(force, 3) }),
      ro('t', 'Period of revolution', period, 's', 10, { sub: formatSI(period, 3) }),
      ro('freq', 'Cyclotron frequency', 1 / period, 'Hz', 4, { sub: formatSI(1 / period, 3) }),
      ro('pitch', 'Pitch of the helix', pitch, 'm', 6, { sub: angle >= 89.5 ? 'circular path' : `${(pitch * 100).toFixed(3)} cm` }),
      ro('ke', 'Kinetic energy', ke, 'J', 20, { sub: `${(ke / CONSTANTS.EV).toFixed(2)} eV` }),
      ro('qm', 'Specific charge q/m', p.q / p.m, 'C/kg', 6, { sub: formatSI(p.q / p.m, 4) })
    ],
    graph: {
      title: 'Radius against magnetic field strength',
      xLabel: 'B (T)', yLabel: 'r (cm)',
      series: [{ key: 'r', label: 'r', color: '#45d68b', points }]
    },
    live: { x: b, y: r * 100 },
    description: `A ${p.label} moving at ${formatSI(v, 3)} m/s at ${angle.toFixed(0)}° to a ${b.toFixed(2)} tesla field follows ${angle >= 89.5 ? 'a circle' : 'a helix'} of radius ${(r * 100).toFixed(3)} cm with a period of ${formatSI(period, 3)} second.`,
    result: `r = mv/qB = ${formatSI(p.m, 3)} \u00d7 ${formatSI(v, 3)}/(${formatSI(p.q, 3)} \u00d7 ${b.toFixed(2)}) = ${formatSI(r, 4)} m; T = 2\u03c0m/qB = ${formatSI(period, 4)} s${angle < 89.5 ? `; pitch = ${formatSI(pitch, 4)} m` : ''}.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const key = String(params.particle ?? 'electron');
  const p = PARTICLES[key] ?? PARTICLES.electron!;
  const sign = String(params.sign ?? 'negative') === 'negative' ? -1 : 1;
  const v = num(params, 'speed', 5000) * 1000;
  const b = num(params, 'b', 0.5);
  const angle = num(params, 'angle', 90);
  const animate = Boolean(params.animate ?? true);
  const reduced = useReducedMotion();
  const r = gyroradius(p.m, v * Math.sin(degToRad(angle)), p.q, b);
  const period = (2 * Math.PI * p.m) / (p.q * b);
  const pathRef = useRef<SVGPathElement | null>(null);
  const dotRef = useRef<SVGCircleElement | null>(null);

  const pxR = Math.min(Math.max(r * 1e5, 24), 150);
  const pitchPx = angle >= 89.5 ? 0 : Math.min((v * Math.cos(degToRad(angle)) * period) * 1e5, 320);
  const cx = 400 - pitchPx / 2;
  const cy = 200;
  const sense = sign;
  const steps = 90;
  let d = '';
  for (let k = 0; k <= steps; k += 1) {
    const t = (k / steps) * Math.PI * 2;
    const x = cx + (pitchPx * k) / steps + pxR * Math.sin(t) * 0.28;
    const y = cy + sense * pxR * Math.cos(t);
    d += `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }

  useEffect(() => {
    if (!animate || reduced) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      const frac = (elapsed % 2) / 2;
      const node = pathRef.current;
      const dot = dotRef.current;
      if (node && dot) {
        // SVGGeometryElement measurements are unavailable in some engines; walk
        // the path data we generated instead so the particle always moves.
        let x: number | null = null;
        let y: number | null = null;
        if (typeof node.getTotalLength === 'function' && typeof node.getPointAtLength === 'function') {
          try {
            const pt = node.getPointAtLength(frac * node.getTotalLength());
            x = pt.x;
            y = pt.y;
          } catch {
            x = null;
          }
        }
        if (x === null || y === null) {
          const pts = (node.getAttribute('d') ?? '')
            .trim()
            .split(/\s+/)
            .map((tok) => tok.slice(1).split(',').map(Number));
          const at = pts[Math.min(pts.length - 1, Math.round(frac * (pts.length - 1)))] ?? [0, 0];
          x = at[0] ?? 0;
          y = at[1] ?? 0;
        }
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(y));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, reduced, d]);

  return (
    <svg viewBox="0 0 800 440" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={30} y={50} width={740} height={300} rx={12} />
      <BarMagnet x={60} y={80} width={120} height={38} rotate={-90} />
      <BarMagnet x={620} y={80} width={120} height={38} rotate={90} />
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={640} y1={130 + i * 42} x2={170} y2={130 + i * 42} stroke="#3f6f8a" strokeWidth={1.1} markerEnd="url(#lab-arrow)" opacity={0.4} />
      ))}
      <text x={400} y={72} textAnchor="middle" fontSize={10} fill="#5e93ad">B = {b.toFixed(2)} T, into the region shown</text>
      <path ref={pathRef} d={d} fill="none" stroke="#45d68b" strokeWidth={2} opacity={0.85} />
      <circle ref={dotRef} cx={cx} cy={cy + sense * pxR} r={6} fill={sign < 0 ? '#ff7a90' : '#25d0ee'} stroke="#0b121c" strokeWidth={1.5} />
      <text x={400} y={372} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        {p.label}, {sign < 0 ? 'negative' : 'positive'} · r = {(r * 100).toFixed(3)} cm · T = {formatSI(period, 3)} s · {angle >= 89.5 ? 'circular path' : `helix, pitch ${formatSI(v * Math.cos(degToRad(angle)) * period, 3)} m`}
      </text>
      <text x={400} y={400} textAnchor="middle" fontSize={11} fill="#eaf1f8" fontWeight={600}>
        Lorentz force F = qvB sin θ = {formatSI(lorentzForce(p.q, v, b, angle), 3)} N, always perpendicular to v
      </text>
      {/* The accelerator and the entry angle are set on the apparatus. */}
      <Knob
        spec={control('speed', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={70}
        y={300}
        radius={18}
        label="Particle speed v — turn the accelerator"
      />
      <Knob
        spec={control('angle', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={730}
        y={300}
        radius={18}
        label="Angle of entry to the field"
      />
        </svg>
  );
}

export default function MagneticForceChargeExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const key = String(p.particle ?? 'electron');
        const particle = PARTICLES[key] ?? PARTICLES.electron!;
        const v = num(p, 'speed', 5000) * 1000;
        const b = num(p, 'b', 0.5);
        const angle = num(p, 'angle', 90);
        return {
          title: 'Observation table — motion of a charge in a magnetic field',
          columns: [
            { key: 'v', label: 'v', unit: 'km/s', precision: 1 },
            { key: 'b', label: 'B', unit: 'T', precision: 3 },
            { key: 'a', label: 'θ', unit: '°', precision: 0 },
            { key: 'r', label: 'r', unit: 'cm', precision: 4, derived: true },
            { key: 't', label: 'T', unit: 'µs', precision: 4, derived: true }
          ],
          capture: () => ({ v: v / 1000, b, a: angle, r: 0, t: 0 }),
          derive: (row) => ({
            ...row,
            r: gyroradius(particle.m, Number(row.v) * 1000 * Math.sin(degToRad(Number(row.a))), particle.q, Number(row.b)) * 100,
            t: ((2 * Math.PI * particle.m) / (particle.q * Number(row.b))) * 1e6
          })
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
