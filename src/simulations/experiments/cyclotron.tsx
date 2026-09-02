import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { CONSTANTS } from '@/physics-engine/constants';
import { cyclotronFrequency, gyroradius, cyclotronMaxEnergy } from '@/physics-engine/magnetism';
import { jToEv } from '@/physics-engine/units';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './cyclotron.meta';

export { meta };

const PARTICLES = [
  { value: 'proton', label: 'Proton', m: CONSTANTS.M_P, q: CONSTANTS.E_CHARGE },
  { value: 'deuteron', label: 'Deuteron', m: 2 * CONSTANTS.M_P, q: CONSTANTS.E_CHARGE },
  { value: 'alpha', label: 'Alpha particle', m: 4 * CONSTANTS.M_P, q: 2 * CONSTANTS.E_CHARGE },
  { value: 'electron', label: 'Electron (non-relativistic limit)', m: CONSTANTS.M_E, q: CONSTANTS.E_CHARGE }
];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'b', label: 'Magnetic field', symbol: 'B', unit: 'T', min: 0.1, max: 3, step: 0.05, initial: 1, precision: 2 },
    { kind: 'slider', key: 'vGap', label: 'Gap voltage', symbol: 'V', unit: 'kV', min: 1, max: 100, step: 1, initial: 20 },
    { kind: 'slider', key: 'rDee', label: 'Dee radius', symbol: 'R', unit: 'cm', min: 10, max: 80, step: 1, initial: 40, stage: { x: 3, y: 17, length: 20 } },
    { kind: 'select', key: 'particle', label: 'Particle', initial: 'proton', options: PARTICLES.map((p) => ({ value: p.value, label: p.label })) },
    { kind: 'toggle', key: 'trail', label: 'Show spiral trajectory', initial: true }
  ],
  defaults: { b: 1, vGap: 20, rDee: 40, particle: 'proton', trail: true }
};

const education: EducationPack = {
  theory: [
    'A charged particle moving perpendicular to a uniform magnetic field travels in a circle. The magnetic force supplies the centripetal force, so mv²/r = qvB and the radius is r = mv/qB.',
    'The time for one complete revolution is T = 2πm/qB, which contains neither the speed nor the radius. This is the crucial fact: a faster particle travels a larger circle but takes exactly the same time.',
    'A cyclotron exploits this by placing the particle between two hollow D-shaped electrodes in a strong magnetic field. An alternating voltage across the gap reverses every half period, so the particle gains energy at each crossing while its orbit spirals outwards.',
    'Because the orbital frequency is fixed by B and q/m, the accelerating voltage can be a simple radio-frequency oscillator in resonance with the motion. The maximum energy is set by the dee radius: K = q²B²R²/2m.'
  ],
  formulas: [
    { tex: 'r = \\frac{mv}{qB}', caption: 'Radius of the circular path.' },
    { tex: 'f = \\frac{qB}{2\\pi m}', caption: 'Cyclotron frequency — independent of speed.' },
    { tex: 'K_{max} = \\frac{q^2 B^2 R^2}{2m}', caption: 'Maximum kinetic energy for dee radius R.' },
    { tex: 'v_{max} = \\frac{qBR}{m}', caption: 'Speed at the outer edge.' }
  ],
  variables: [
    { symbol: 'q', name: 'Charge of the particle', unit: 'C' },
    { symbol: 'm', name: 'Mass of the particle', unit: 'kg' },
    { symbol: 'B', name: 'Magnetic field', unit: 'T' },
    { symbol: 'R', name: 'Dee radius', unit: 'm' },
    { symbol: 'f', name: 'Cyclotron frequency', unit: 'Hz' },
    { symbol: 'K', name: 'Kinetic energy', unit: 'J' }
  ],
  procedure: [
    'Choose the particle and set the magnetic field.',
    'Note the cyclotron frequency — this is the frequency the oscillator must supply.',
    'Increase the gap voltage and watch the spiral widen faster; the frequency does not change.',
    'Increase the dee radius and note the rise in the maximum energy.',
    'Record readings for several magnetic fields and verify that f is proportional to B.'
  ],
  precautions: [
    'The non-relativistic treatment fails once the speed approaches a tenth of the speed of light; beyond that the mass increases and the particle falls out of resonance.',
    'A synchrocyclotron or an isochronous cyclotron is needed at relativistic energies.',
    'The electric field inside the metal dees is zero, so the particle gains energy only in the gap.'
  ],
  tips: ['Switch to the alpha particle: with twice the charge and four times the mass the frequency halves.'],
  viva: [
    { q: 'Why is the cyclotron frequency independent of speed?', a: 'Because T = 2πm/qB contains no v; a faster particle simply travels a proportionally larger circle.' },
    { q: 'What limits the maximum energy of a classical cyclotron?', a: 'Relativistic mass increase, which makes the particle lag behind the alternating voltage.' },
    { q: 'Why is there no electric field inside a dee?', a: 'The dees are hollow conductors, and the field inside a conductor in electrostatics is zero.' },
    { q: 'What is the resonance condition?', a: 'The oscillator frequency must equal qB/2πm.' },
    { q: 'Why can a cyclotron not accelerate neutrons?', a: 'Because they are uncharged, so neither the magnetic field nor the gap voltage acts on them.' }
  ],
  resultTemplate: 'The orbital frequency stays constant while the radius grows, and the maximum energy follows K = q²B²R²/2m.'
};

type Particle = { value: string; label: string; m: number; q: number };
const particleOf = (key: string): Particle =>
  PARTICLES.find((p) => p.value === key) ?? (PARTICLES[0] as Particle);

function compute(params: ParamValues): ModelOutput {
  const b = num(params, 'b', 1);
  const vGap = num(params, 'vGap', 20) * 1000;
  const rDee = num(params, 'rDee', 40) / 100;
  const p = particleOf(String(params.particle ?? 'proton'));
  const f = cyclotronFrequency(p.q, b, p.m);
  const eMax = cyclotronMaxEnergy(p.q, b, rDee, p.m);
  const vMax = (p.q * b * rDee) / p.m;
  const beta = vMax / CONSTANTS.C_LIGHT;
  // Each turn crosses the gap twice, so the energy gained per turn is 2qV joules.
  const revs = eMax / Math.max(2 * p.q * vGap, 1e-30);

  const points: { x: number; y: number }[] = [];
  for (let bb = 0.1; bb <= 3.0001; bb += 0.05) points.push({ x: bb, y: cyclotronFrequency(p.q, bb, p.m) / 1e6 });

  return {
    readouts: [
      ro('f', 'Cyclotron frequency', f, 'Hz', 4, { sub: `${(f / 1e6).toFixed(2)} MHz` }),
      ro('t', 'Period', 1 / f, 's', 4),
      ro('kmax', 'Max kinetic energy', eMax, 'J', 3, { sub: `${(jToEv(eMax) / 1e6).toFixed(3)} MeV` }),
      ro('vmax', 'Max speed', vMax, 'm/s', 4, { sub: `${(beta * 100).toFixed(1)}% of c` }),
      ro('r', 'Radius at 1 MeV', gyroradius(p.m, Math.sqrt((2 * 1e6 * CONSTANTS.EV) / p.m), p.q, b), 'm', 3),
      ro('vg', 'Gap voltage', vGap, 'V', 0),
      ro('rev', 'Revolutions to full energy', revs, '\u2014', 0, { sub: 'two gap crossings per turn' }),
      ro('tacc', 'Acceleration time', revs / f, 's', 6, { sub: formatSI(revs / f, 3) }),
      ro('rel', 'Relativity limit', beta > 0.1 ? 1 : 0, '', 0, { text: beta > 0.1 ? 'EXCEEDED' : 'SAFE', tone: beta > 0.1 ? 'alert' : 'normal' })
    ],
    graph: singleSeriesGraph({
      title: 'Cyclotron frequency against magnetic field', xLabel: 'B (T)', yLabel: 'f (MHz)',
      seriesLabel: 'f', color: '#9d8cff', points, live: { x: b, y: f / 1e6 }
    }),
    description: `A ${p.label.toLowerCase()} in a ${b.toFixed(2)} tesla field circles at ${formatSI(f, 4)} hertz. With dee radius ${(rDee * 100).toFixed(0)} centimetre it leaves with ${(jToEv(eMax) / 1e6).toFixed(3)} megaelectronvolt of kinetic energy.`,
    result: `For a ${p.label.toLowerCase()} in B = ${b.toFixed(2)} T the cyclotron frequency is ${formatSI(f, 4)} Hz, independent of speed. With R = ${(rDee * 100).toFixed(0)} cm the maximum energy is ${(jToEv(eMax) / 1e6).toFixed(3)} MeV at v = ${formatSI(vMax, 3)} m/s (${(beta * 100).toFixed(1)}% of c).`
  };
}

function Stage({ params, set, control }: StageApi) {
  const b = num(params, 'b', 1);
  const vGap = num(params, 'vGap', 20) * 1000;
  const rDee = num(params, 'rDee', 40) / 100;
  const p = particleOf(String(params.particle ?? 'proton'));
  const trail = Boolean(params.trail ?? true);
  const f = cyclotronFrequency(p.q, b, p.m);
  const vMax = (p.q * b * rDee) / p.m;
  const eMax = 0.5 * p.m * vMax * vMax;

  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const t0 = useRef(performance.now());
  const pts = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    let raf = 0;
    t0.current = performance.now();
    pts.current = [];
    const CX = 410;
    const CY = 240;
    const maxR = 175;
    const gapPx = 26;
    // Crossing energy gain in drawing terms: the radius grows as sqrt(K).
    const crossings = 44;
    const frame = (now: number): void => {
      const t = (now - t0.current) / 1000;
      const period = 1 / Math.max(f, 1e-9);
      const displayPeriod = Math.max(period * 1e-7, 0.02);
      const elapsed = t % (displayPeriod * crossings);
      const n = elapsed / displayPeriod;
      const k = Math.max(n, 1);
      const energy = (k / crossings) * eMax;
      const v = Math.sqrt((2 * energy) / p.m);
      const rPhys = gyroradius(p.m, v, p.q, b);
      const rMaxPhys = gyroradius(p.m, vMax, p.q, b);
      const rPx = Math.min((rPhys / Math.max(rMaxPhys, 1e-9)) * maxR, maxR);
      const angle = n * Math.PI;
      const side = Math.floor(n) % 2 === 0 ? -1 : 1;
      const x = CX + side * gapPx / 2 + rPx * Math.cos(angle) * (side === -1 ? 1 : -1) * -1;
      const y = CY + rPx * Math.sin(angle);
      if (trail) {
        pts.current.push({ x, y });
        if (pts.current.length > 900) pts.current.shift();
        if (pathRef.current) {
          pathRef.current.setAttribute(
            'd',
            pts.current.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
          );
        }
      }
      if (dotRef.current) {
        dotRef.current.setAttribute('cx', x.toFixed(1));
        dotRef.current.setAttribute('cy', y.toFixed(1));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [b, f, p, eMax, vMax, trail, rDee]);

  const R = 190;
  return (
    <svg viewBox="0 0 820 480" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <circle cx={410} cy={240} r={R} fill="none" stroke="#3a4c60" strokeWidth={1.2} strokeDasharray="5 5" />
      <path d={`M${410 - 13} ${240 - R} A${R} ${R} 0 0 0 ${410 - 13} ${240 + R} Z`} fill="#9d8cff" opacity={0.08} stroke="#9d8cff" strokeOpacity={0.45} />
      <path d={`M${410 + 13} ${240 - R} A${R} ${R} 0 0 1 ${410 + 13} ${240 + R} Z`} fill="#9d8cff" opacity={0.08} stroke="#9d8cff" strokeOpacity={0.45} />
      <rect x={410 - 13} y={240 - R} width={26} height={R * 2} fill="#04070d" />
      <text x={300} y={60} fontSize={11} fill="#9d8cff">D₁</text>
      <text x={500} y={60} fontSize={11} fill="#9d8cff">D₂</text>
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <circle cx={120 + (i % 5) * 34} cy={400 + Math.floor(i / 5) * 30} r={6} fill="none" stroke="#7dd3fc" strokeWidth={1.1} />
          <circle cx={120 + (i % 5) * 34} cy={400 + Math.floor(i / 5) * 30} r={1.6} fill="#7dd3fc" />
        </g>
      ))}
      <text x={120} y={392} fontSize={9.5} fill="#7dd3fc">B out of the page</text>
      <path ref={pathRef} d="" fill="none" stroke="#ffd257" strokeWidth={1.6} opacity={0.85} />
      <circle ref={dotRef} r={6} fill="#ffd257" style={{ filter: 'drop-shadow(0 0 8px #ffd25799)' }} />
      <path d="M410 440 V466 M470 440 V466" className="lead" stroke="#8497ad" />
      <text x={440} y={478} textAnchor="middle" fontSize={9.5} className="label-mono">RF {(f / 1e6).toFixed(2)} MHz</text>
      <text x={410} y={36} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {p.label} · f = {(f / 1e6).toFixed(3)} MHz · gap voltage {(vGap / 1000).toFixed(0)} kV
      </text>
      <text x={410} y={55} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        B = {b.toFixed(2)} T · R = {(rDee * 100).toFixed(0)} cm · K max = {(jToEv(eMax) / 1e6).toFixed(2)} MeV
      </text>
      {/* The magnet supply, the dee voltage and the beam trace are on the machine. */}
      <Knob
        spec={control('b', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={120}
        y={430}
        radius={19}
        label="Magnetic field B — turn the magnet supply"
      />
      <Knob
        spec={control('vGap', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={250}
        y={430}
        radius={19}
        label="Gap voltage V — turn the oscillator"
      />
      <StageSwitch
        spec={control('trail', 'toggle')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={700}
        y={430}
        label="Show the spiral trajectory"
      />
    </svg>
  );
}

export default function CyclotronExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const b = num(p, 'b', 1);
        const rDee = num(p, 'rDee', 40) / 100;
        const pt = particleOf(String(p.particle ?? 'proton'));
        return {
          title: 'Observation table — cyclotron parameters',
          columns: [
            col('b', 'B', 'T', 2),
            col('f', 'f', 'MHz', 4),
            col('r', 'R', 'cm', 0),
            col('k', 'K max', 'MeV', 4),
            col('v', 'v max', '×10⁶ m/s', 3)
          ],
          capture: () => ({
            b,
            f: cyclotronFrequency(pt.q, b, pt.m) / 1e6,
            r: rDee * 100,
            k: jToEv(cyclotronMaxEnergy(pt.q, b, rDee, pt.m)) / 1e6,
            v: ((pt.q * b * rDee) / pt.m) / 1e6
          }),
          captureHint: 'Change the magnetic field or dee radius, then record.'
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
