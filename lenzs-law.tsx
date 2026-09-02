import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BarMagnet, MeterFace, CoilLoop } from '@/components/instruments/Instruments';
import { useReducedMotion } from '@/hooks/useAnimation';
import { magneticFlux, inducedEmf } from '@/physics-engine/magnetism';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './lenzs-law.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ffc65c',
  controls: [
    { kind: 'slider', key: 'speed', label: 'Speed of the magnet', symbol: 'v', unit: 'cm/s', min: 0, max: 100, step: 1, initial: 30 },
    { kind: 'slider', key: 'turns', label: 'Number of turns', symbol: 'N', unit: 'turns', min: 20, max: 500, step: 10, initial: 150 },
    { kind: 'slider', key: 'radius', label: 'Coil radius', symbol: 'R', unit: 'cm', min: 2, max: 12, step: 0.5, initial: 5, precision: 1 },
    { kind: 'segmented', key: 'pole', label: 'Pole approaching', initial: 'north', options: [{ value: 'north', label: 'North first' }, { value: 'south', label: 'South first' }] },
    { kind: 'segmented', key: 'motion', label: 'Motion', initial: 'in', options: [{ value: 'in', label: 'Moving in' }, { value: 'out', label: 'Moving out' }, { value: 'still', label: 'Held still' }] },
    { kind: 'slider', key: 'resistance', label: 'Circuit resistance', symbol: 'R_c', unit: '\u03a9', min: 1, max: 100, step: 1, initial: 10 },
    { kind: 'toggle', key: 'animate', label: 'Animate the magnet', initial: true }
  ],
  defaults: { speed: 30, turns: 150, radius: 5, pole: 'north', motion: 'in', resistance: 10, animate: true }
};

const education: EducationPack = {
  theory: [
    'Whenever the magnetic flux linking a coil changes, an emf is induced in it. The induced emf equals the negative rate of change of flux linkage, which is Faraday\u2019s law of electromagnetic induction.',
    'The negative sign is Lenz\u2019s law: the induced current always flows in such a direction that its own magnetic field opposes the change that produced it. This is a direct consequence of the conservation of energy.',
    'When the north pole of a magnet approaches a coil, the near face of the coil becomes a north pole and repels the magnet. When the magnet is withdrawn, the near face becomes a south pole and attracts it. In both cases work must be done against the induced effect, and that work appears as electrical energy in the circuit.'
  ],
  formulas: [
    { tex: '\\varepsilon = -N \\frac{d\\Phi}{dt}', caption: 'Faraday\u2019s law with Lenz\u2019s sign.' },
    { tex: '\\Phi = BA\\cos\\theta', caption: 'Magnetic flux.' },
    { tex: 'I = \\frac{\\varepsilon}{R}', caption: 'Induced current.' }
  ],
  variables: [
    { symbol: '\\varepsilon', name: 'Induced emf', unit: 'V' },
    { symbol: 'N', name: 'Number of turns', unit: '\u2014' },
    { symbol: '\\Phi', name: 'Magnetic flux', unit: 'Wb' },
    { symbol: 'I', name: 'Induced current', unit: 'A' },
    { symbol: 'v', name: 'Speed of the magnet', unit: 'm/s' }
  ],
  procedure: [
    'Connect the coil to a centre-zero galvanometer.',
    'Push the north pole of the magnet into the coil and note the direction of the deflection.',
    'Hold the magnet still inside the coil and note that the deflection falls to zero.',
    'Withdraw the magnet and note that the deflection reverses.',
    'Repeat with the south pole first and with different speeds and turn counts.'
  ],
  precautions: ['The galvanometer is delicate; keep the series resistance high enough to protect it.', 'Keep other magnets and iron objects away from the coil.', 'Move the magnet along the axis so that the flux change is uniform.'],
  tips: ['Doubling the speed doubles the induced emf; doubling the number of turns does the same.'],
  viva: [
    { q: 'State Lenz\u2019s law.', a: 'The direction of the induced current is such that it opposes the change in flux that produced it.' },
    { q: 'On what principle is Lenz\u2019s law based?', a: 'Conservation of energy — the induced current must require work to be done against it.' },
    { q: 'Why is there no deflection when the magnet is held still?', a: 'Because the flux through the coil is not changing, so no emf is induced.' },
    { q: 'What happens when the magnet is withdrawn?', a: 'The induced current reverses so that the coil attracts the magnet and opposes its withdrawal.' },
    { q: 'How can the induced emf be increased?', a: 'By using more turns, a stronger magnet, a larger coil area or by moving the magnet faster.' }
  ],
  resultTemplate: 'The direction of the induced current always opposes the change in flux, confirming Lenz\u2019s law, and the emf is proportional to N dΦ/dt.'
};

function compute(params: ParamValues): ModelOutput {
  const speed = num(params, 'speed', 30) / 100;
  const turns = num(params, 'turns', 150);
  const radius = num(params, 'radius', 5) / 100;
  const pole = String(params.pole ?? 'north') === 'north' ? 1 : -1;
  const motion = String(params.motion ?? 'in');
  const resistance = num(params, 'resistance', 10);

  const area = Math.PI * radius * radius;
  const bMagnet = 0.08;
  const dir = motion === 'still' ? 0 : motion === 'in' ? 1 : -1;
  const flux = magneticFlux(bMagnet, area, turns, 0);
  const fluxRate = dir * pole * bMagnet * area * speed / 0.05;
  const emf = inducedEmf(fluxRate, 1) * turns;
  const current = emf / resistance;

  const points: { x: number; y: number }[] = [];
  for (let v = 0; v <= 1; v += 0.01) {
    points.push({ x: v * 100, y: Math.abs(inducedEmf(dir * pole * bMagnet * area * v, 1) * turns) * 1000 });
  }

  return {
    readouts: [
      ro('emf', 'Induced emf', emf, 'V', 5, { sub: formatSI(emf, 3), tone: emf < 0 ? 'neg' : 'normal' }),
      ro('i', 'Induced current', current, 'A', 6, { sub: `${(current * 1000).toFixed(3)} mA`, tone: current < 0 ? 'neg' : 'normal' }),
      ro('flux', 'Flux linkage', flux, 'Wb', 6, { sub: `${(flux * 1000).toFixed(3)} mWb` }),
      ro('dflux', 'Rate of change of flux', fluxRate, 'Wb/s', 5),
      ro('dir', 'Direction of induced current', motion === 'still' ? 0 : emf > 0 ? 1 : -1, '\u2014', 0, { text: motion === 'still' ? 'none (no change of flux)' : emf > 0 ? 'anticlockwise seen from the magnet' : 'clockwise seen from the magnet' }),
      ro('n', 'Turns', turns, '\u2014', 0)
    ],
    graph: {
      title: 'Magnitude of the induced emf against the speed of the magnet',
      xLabel: 'v (cm/s)', yLabel: '|ε| (mV)',
      series: [{ key: 'e', label: '|ε|', color: '#ffc65c', points }]
    },
    live: { x: num(params, 'speed', 30), y: Math.abs(emf) * 1000 },
    description: motion === 'still'
      ? 'With the magnet held still the flux through the coil does not change, so the induced emf and the galvanometer deflection are both zero.'
      : `Moving the ${pole > 0 ? 'north' : 'south'} pole ${motion === 'in' ? 'into' : 'out of'} the coil at ${speed * 100} cm/s changes the flux at ${formatSI(fluxRate, 3)} weber per second, inducing ${formatSI(emf, 3)} volt and a current of ${formatSI(current, 3)} ampere.`,
    result: `\u03b5 = \u2212N d\u03a6/dt = ${formatSI(emf, 4)} V for N = ${turns.toFixed(0)} turns at ${speed * 100} cm/s. The induced current of ${formatSI(current, 4)} A flows so as to ${motion === 'in' ? 'repel the approaching magnet' : 'attract the receding magnet'}, in agreement with Lenz\u2019s law.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const speed = num(params, 'speed', 30) / 100;
  const turns = num(params, 'turns', 150);
  const radius = num(params, 'radius', 5) / 100;
  const pole = String(params.pole ?? 'north') === 'north' ? 1 : -1;
  const motion = String(params.motion ?? 'in');
  const resistance = num(params, 'resistance', 10);
  const animate = Boolean(params.animate ?? true);
  const reduced = useReducedMotion();
  const magnetRef = useRef<SVGGElement | null>(null);

  const dir = motion === 'still' ? 0 : motion === 'in' ? 1 : -1;
  const emf = inducedEmf(dir * pole * 0.08 * Math.PI * radius * radius * speed / 0.05, 1) * turns;
  const current = emf / resistance;
  const deflection = Math.max(Math.min(current / 0.004, 1), -1);

  useEffect(() => {
    if (!animate || reduced || dir === 0) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = ((now - start) / 2600) % 1;
      const x = 150 + Math.sin(t * Math.PI * 2) * 150 * dir;
      magnetRef.current?.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, reduced, dir]);

  return (
    <svg viewBox="0 0 800 440" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={30} y={50} width={740} height={250} rx={12} />
      <g transform="translate(420 175)">
        <CoilLoop radius={radius * 700} turns={Math.min(Math.round(turns / 20), 14)} current={Math.abs(current)} direction={current >= 0 ? 1 : -1} />
      </g>
      <g ref={magnetRef} transform="translate(150 0)" style={{ transition: reduced ? 'none' : undefined }}>
        <g transform={`rotate(${pole > 0 ? 0 : 180} 80 175)`}>
          <BarMagnet x={20} y={156} width={120} height={38} />
        </g>
      </g>
      {dir !== 0 && speed > 0 ? (
        <line x1={170} y1={112} x2={170 + dir * 90} y2={112} stroke="#ffc65c" strokeWidth={2.4} markerEnd="url(#lab-arrow)" />
      ) : null}
      <text x={400} y={80} textAnchor="middle" fontSize={12} fill="#eaf1f8" fontWeight={600}>
        {motion === 'still' ? 'Magnet at rest — no change of flux' : `${pole > 0 ? 'North' : 'South'} pole ${motion === 'in' ? 'entering' : 'leaving'} the coil`}
      </text>
      <g transform="translate(420 350)">
        <MeterFace scale={0.62} deflection={deflection} symbol="G" zeroCentre value={`${(current * 1000).toFixed(2)} mA`} />
        <line x1={-40} y1={-40} x2={-40} y2={-90} stroke="#6f8296" strokeWidth={2} />
        <line x1={40} y1={-40} x2={40} y2={-90} stroke="#6f8296" strokeWidth={2} />
        <text y={70} textAnchor="middle" fontSize={9.5} fill="#8497ad">
          {current === 0 ? 'no deflection' : current > 0 ? 'deflection one way' : 'deflection reversed'}
        </text>
      </g>
      <text x={400} y={420} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        N = {turns.toFixed(0)} turns · R = {(radius * 100).toFixed(1)} cm · circuit {resistance.toFixed(0)} Ω · ε = {formatSI(emf, 3)} V
      </text>
      {/* The magnet is driven at a set speed through the coil. */}
      <Knob
        spec={control('speed', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={130}
        y={402}
        radius={18}
        label="Speed of the magnet — turn the drive"
      />
      <Knob
        spec={control('resistance', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={670}
        y={402}
        radius={18}
        label="Circuit resistance R"
      />
        </svg>
  );
}

export default function LenzsLawExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const speed = num(p, 'speed', 30) / 100;
        const turns = num(p, 'turns', 150);
        const radius = num(p, 'radius', 5) / 100;
        const resistance = num(p, 'resistance', 10);
        const pole = String(p.pole ?? 'north') === 'north' ? 1 : -1;
        const dir = String(p.motion ?? 'in') === 'in' ? 1 : -1;
        return {
          title: "Observation table — Lenz's law",
          columns: [
            { key: 'n', label: 'N', unit: '—', precision: 0 },
            { key: 'v', label: 'v', unit: 'cm/s', precision: 1 },
            { key: 'e', label: 'ε', unit: 'mV', precision: 3, derived: true },
            { key: 'i', label: 'I', unit: 'mA', precision: 4, derived: true }
          ],
          capture: () => ({ n: turns, v: speed * 100, e: 0, i: 0 }),
          derive: (row) => {
            const v = Number(row.v) / 100;
            const n = Number(row.n);
            const e = inducedEmf(dir * pole * 0.08 * Math.PI * radius * radius * v / 0.05, 1) * n;
            return { ...row, e: e * 1000, i: (e / resistance) * 1000 };
          }
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
