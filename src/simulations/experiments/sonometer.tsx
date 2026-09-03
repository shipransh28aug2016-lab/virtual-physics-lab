import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import {
  linearDensityFromWire,
  resonantLength,
  stringFrequency,
  tensionFromMass
} from '@/physics-engine/waves-acoustics';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { DragX, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './sonometer.meta';

export { meta };

/** The a.c. mains the electromagnet is driven from. */
const MAINS_HZ = 50;
/** A steel sonometer wire; ρ is the density of the wire material. */
const STEEL_DENSITY = 7800; // kg/m³

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  practicalNo: meta.practicalNo, thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'mass', label: 'Load in the hanger', symbol: 'M', unit: 'kg', min: 0.5, max: 5, step: 0.1, initial: 2, precision: 1, onStage: true },
    { kind: 'slider', key: 'dia', label: 'Wire diameter', symbol: 'd', unit: 'mm', min: 0.2, max: 0.8, step: 0.01, initial: 0.35, precision: 2, hint: 'Screw-gauge reading', onStage: true },
    { kind: 'slider', key: 'length', label: 'Length between bridges', symbol: 'l', unit: 'cm', min: 10, max: 90, step: 0.1, initial: 40, precision: 1, onStage: true, hint: 'Slide a bridge until the paper rider flies off' },
    { kind: 'toggle', key: 'magnet', label: 'Electromagnet energised', initial: true, onStage: true }
  ],
  defaults: { mass: 2, dia: 0.35, length: 40, magnet: true }
};

const education: EducationPack = {
  theory: [
    'A sonometer is a stretched wire whose vibrating length can be changed by moving two movable bridges. The frequency of its fundamental mode is set by that length, by the tension in the wire and by the mass per unit length of the wire.',
    'When an electromagnet fed from the a.c. mains is held over a steel wire, it attracts the wire twice in every cycle — once on each half-cycle, since the attraction does not depend on the direction of the current. The wire is therefore driven at twice the mains frequency, so at resonance the wire vibrates at 2ν and the mains frequency is half the frequency computed for the wire.',
    'Resonance is detected mechanically: a small paper rider placed at the middle of the wire is thrown off violently the moment the driven length matches a natural length of the wire. That makes the null a visible event rather than a judgement call.',
    'The mass per unit length is not weighed directly. It is computed from the density of the wire material and the diameter measured with a screw gauge, µ = ρ·πd²/4.'
  ],
  formulas: [
    { tex: 'f = \\frac{1}{2l}\\sqrt{\\frac{T}{\\mu}}', caption: 'Fundamental frequency of a stretched string.' },
    { tex: 'T = Mg', caption: 'Tension from the load hanging over the pulley.' },
    { tex: '\\mu = \\rho\\frac{\\pi d^2}{4}', caption: 'Mass per unit length from the density and diameter.' },
    { tex: '\\nu = \\frac{f}{2}', caption: 'The mains frequency is half the frequency of the wire.' }
  ],
  variables: [
    { symbol: 'f', name: 'Frequency of the vibrating wire', unit: 'Hz' },
    { symbol: '\\nu', name: 'Frequency of the a.c. mains', unit: 'Hz' },
    { symbol: 'l', name: 'Resonating length', unit: 'm' },
    { symbol: 'T', name: 'Tension in the wire', unit: 'N' },
    { symbol: '\\mu', name: 'Mass per unit length', unit: 'kg/m' },
    { symbol: 'M', name: 'Load in the hanger', unit: 'kg' }
  ],
  procedure: [
    'Measure the diameter of the sonometer wire with a screw gauge at several places and take the mean.',
    'Hang a known load from the hanger and note the tension T = Mg.',
    'Place the electromagnet close to the middle of the wire and switch it on.',
    'Put a small paper rider at the centre of the wire between the two bridges.',
    'Move one bridge slowly until the rider is thrown off — that is the resonating length; record it.',
    'Repeat for at least five different loads.',
    'Plot l against 1/√T; the graph is a straight line, and each row gives ν = f/2.'
  ],
  precautions: [
    'Keep the electromagnet close to the wire but never touching it.',
    'Add the load gently — a jerk can snap the wire or change its zero tension.',
    'Move the bridge slowly near resonance; the rider flies off over a narrow range of length.',
    'Take the screw-gauge reading at several places and correct for its zero error.'
  ],
  sourcesOfError: [
    'Friction at the pulley makes the tension in the wire slightly less than Mg.',
    'The wire may not be perfectly uniform, so µ varies along it.',
    'The bridges have a finite width, so the vibrating length is slightly uncertain.',
    'Yielding of the wire over a long run slowly changes the tension.'
  ],
  tips: [
    'Quadruple the load and the resonating length only doubles — the length goes as √T.',
    'Set the diameter thinner and watch the resonating length grow for the same load.'
  ],
  viva: [
    { q: 'Why does the wire vibrate at twice the mains frequency?', a: 'The electromagnet attracts the steel wire on both halves of each cycle, so it pulls twice per cycle and drives the wire at 2ν.' },
    { q: 'What is the purpose of the paper rider?', a: 'It makes resonance visible: it is thrown off the instant the wire starts vibrating with a large amplitude.' },
    { q: 'How is the mass per unit length found?', a: 'From µ = ρπd²/4, using the density of the wire material and the diameter measured with a screw gauge.' },
    { q: 'How does the resonating length depend on the tension?', a: 'l ∝ √T at fixed frequency, so a graph of l against √T is a straight line through the origin.' },
    { q: 'Why is a steel wire used rather than copper?', a: 'The electromagnet must attract it; steel is ferromagnetic, copper is not.' }
  ],
  resultTemplate:
    'The frequency of the a.c. mains computed from the resonating length, the tension and the mass per unit length is close to 50 Hz.'
};

function model(params: ParamValues) {
  const mass = num(params, 'mass', 2);
  const diaMm = num(params, 'dia', 0.35);
  const lengthCm = num(params, 'length', 40);
  const magnet = params.magnet !== false;

  const tension = tensionFromMass(mass);
  const mu = linearDensityFromWire(STEEL_DENSITY, diaMm / 1000);
  const lengthM = lengthCm / 100;
  const wireFrequency = stringFrequency(lengthM, tension, mu);
  // The magnet drives the wire at twice the mains frequency.
  const driveHz = 2 * MAINS_HZ;
  const resonantM = resonantLength(driveHz, tension, mu);
  const detune = Math.abs(wireFrequency - driveHz) / driveHz;
  // A sharply peaked resonance: the rider only flies off very close to the null.
  const amplitude = magnet ? 1 / (1 + (detune / 0.012) ** 2) : 0;

  return {
    mass, diaMm, lengthCm, lengthM, magnet, tension, mu,
    wireFrequency, driveHz, resonantM, resonantCm: resonantM * 100, amplitude,
    mains: wireFrequency / 2
  };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validatePositive('mass', 'Load in the hanger', m.mass),
    validatePositive('dia', 'Wire diameter', m.diaMm),
    validateRange('length', 'Length between bridges', m.lengthCm, 10, 90)
  );
  if (m.resonantCm > 90 || m.resonantCm < 10) {
    issues.push({
      field: 'mass',
      severity: 'warning',
      message: `With this load and wire the resonating length is ${m.resonantCm.toFixed(1)} cm, outside the travel of the bridges. Change the load.`
    });
  }
  if (!m.magnet) {
    issues.push({ field: 'magnet', severity: 'info', message: 'The electromagnet is off, so nothing drives the wire.' });
  }

  // Resonance curve: amplitude against the length between the bridges.
  const points: { x: number; y: number }[] = [];
  for (let l = 10; l <= 90; l += 0.5) {
    const f = stringFrequency(l / 100, m.tension, m.mu);
    const d = Math.abs(f - m.driveHz) / m.driveHz;
    points.push({ x: l, y: m.magnet ? 1 / (1 + (d / 0.012) ** 2) : 0 });
  }

  return {
    readouts: [
      ro('l', 'Resonating length l', m.lengthCm, 'cm', 1, { sub: `resonance at ${m.resonantCm.toFixed(1)} cm` }),
      ro('t', 'Tension T = Mg', m.tension, 'N', 2),
      ro('mu', 'Mass per unit length µ', m.mu, 'kg/m', 3),
      ro('f', 'Frequency of the wire f', m.wireFrequency, 'Hz', 1),
      ro('nu', 'Mains frequency ν = f/2', m.mains, 'Hz', 2, { tone: Math.abs(m.mains - MAINS_HZ) < 2 ? 'normal' : 'alert' }),
      ro('rider', 'Paper rider', m.amplitude, '', 2, { tone: m.amplitude > 0.5 ? 'alert' : 'dim', text: m.amplitude > 0.5 ? 'THROWN OFF' : m.amplitude > 0.1 ? 'trembling' : 'at rest' })
    ],
    graph: singleSeriesGraph({
      title: 'Amplitude of the wire against the length between the bridges',
      xLabel: 'l (cm)',
      yLabel: 'relative amplitude',
      seriesLabel: 'resonance curve',
      color: '#9d8cff',
      points,
      live: { x: m.lengthCm, y: m.amplitude },
      guides: [{ axis: 'x', value: m.resonantCm, label: `l₀ = ${m.resonantCm.toFixed(1)} cm`, color: '#ffc65c' }]
    }),
    issues,
    description: `A steel wire ${m.diaMm.toFixed(2)} millimetre in diameter is stretched by a ${m.mass.toFixed(1)} kilogram load, giving a tension of ${m.tension.toFixed(2)} newton. The bridges are ${m.lengthCm.toFixed(1)} centimetre apart and the electromagnet is ${m.magnet ? 'energised' : 'switched off'}.`,
    result: `At resonance the wire vibrates at f = ${m.wireFrequency.toFixed(1)} Hz for l = ${m.lengthCm.toFixed(1)} cm, T = ${m.tension.toFixed(2)} N and µ = ${m.mu.toExponential(3)} kg/m. Since the electromagnet pulls twice per cycle, the mains frequency is ν = f/2 = ${m.mains.toFixed(2)} Hz.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const x0 = 130;
  const span = 560;
  const wireY = 250;
  const bridgeX = x0 + (m.lengthCm / 90) * span;
  const swell = m.amplitude * 26;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={140} width={780} height={250} rx={14} />

      <text x={410} y={122} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        Sonometer · steel wire driven by an electromagnet on {MAINS_HZ} Hz mains
      </text>

      {/* The wire, drawn with the envelope of its fundamental mode. */}
      <line x1={x0 - 60} y1={wireY} x2={760} y2={wireY} stroke="#c79a4d" strokeWidth={2.4} />
      {swell > 0.4 ? (
        <>
          <path
            d={`M ${x0} ${wireY} Q ${(x0 + bridgeX) / 2} ${wireY - swell} ${bridgeX} ${wireY}`}
            fill="none"
            stroke="#25d0ee"
            strokeWidth={1.6}
            opacity={0.85}
          />
          <path
            d={`M ${x0} ${wireY} Q ${(x0 + bridgeX) / 2} ${wireY + swell} ${bridgeX} ${wireY}`}
            fill="none"
            stroke="#25d0ee"
            strokeWidth={1.6}
            opacity={0.85}
          />
        </>
      ) : null}

      {/* Fixed and movable bridges. */}
      {[x0, bridgeX].map((bx, i) => (
        <g key={i}>
          <path d={`M ${bx - 9} ${wireY + 22} L ${bx} ${wireY - 4} L ${bx + 9} ${wireY + 22} Z`} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={1} />
        </g>
      ))}
      <line x1={x0} y1={wireY + 26} x2={bridgeX} y2={wireY + 26} className="dim-line" />
      <text x={(x0 + bridgeX) / 2} y={wireY + 42} textAnchor="middle" fontSize={10.5} fill="#8497ad">
        l = {m.lengthCm.toFixed(1)} cm
      </text>

      {/* Electromagnet over the middle of the vibrating segment. */}
      <g transform={`translate(${(x0 + bridgeX) / 2} ${wireY - 62})`}>
        <rect x={-26} y={-18} width={52} height={30} rx={4} fill="#1d2836" stroke={m.magnet ? '#25d0ee' : '#3a5069'} strokeWidth={1.4} />
        <text y={2} textAnchor="middle" fontSize={9.5} fill={m.magnet ? '#25d0ee' : '#5e7189'}>
          {m.magnet ? '~ 50 Hz' : 'off'}
        </text>
        <line x1={-10} y1={12} x2={-10} y2={30} stroke="#94a8bd" strokeWidth={3} />
        <line x1={10} y1={12} x2={10} y2={30} stroke="#94a8bd" strokeWidth={3} />
      </g>

      {/* Paper rider at the antinode. */}
      <g transform={`translate(${(x0 + bridgeX) / 2} ${m.amplitude > 0.5 ? wireY - 46 : wireY - 6})`}>
        <path d="M -7 0 L 0 -7 L 7 0 L 0 7 Z" fill={m.amplitude > 0.5 ? '#ffc65c' : '#eaf1f8'} />
      </g>

      {/* Pulley and the hanging load that sets the tension. */}
      <circle cx={760} cy={wireY} r={16} fill="none" stroke="#94a8bd" strokeWidth={3} />
      <line x1={776} y1={wireY} x2={776} y2={wireY + 70} stroke="#94a8bd" strokeWidth={1.6} />
      <rect x={764} y={wireY + 70} width={24} height={10 + m.mass * 6} rx={2} fill="url(#lab-metal)" stroke="#2c3a4b" strokeWidth={1} />
      <text x={776} y={wireY + 96 + m.mass * 6} textAnchor="middle" fontSize={10} fill="#8497ad">
        {m.mass.toFixed(1)} kg
      </text>

      <text x={410} y={412} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        f = (1/2l)√(T/µ) = {m.wireFrequency.toFixed(1)} Hz → ν = f/2 = {m.mains.toFixed(2)} Hz
      </text>

      <Knob spec={control('mass', 'slider')} params={params} onChange={set} x={150} y={62} radius={20} label="Load in the hanger — turn the dial" />
      <Knob spec={control('dia', 'slider')} params={params} onChange={set} x={300} y={62} radius={18} label="Wire diameter from the screw gauge — turn the dial" />
      {/* The movable bridge is the control: drag it until the rider flies off. */}
      <DragX
        spec={control('length', 'slider')}
        params={params}
        onChange={set}
        x={x0}
        y={wireY + 60}
        length={span}
        mapping={{ toValue: (dx) => (dx / span) * 90, invert: (l) => x0 + (l / 90) * span }}
        label="Movable bridge — drag it until the paper rider is thrown off"
      />
    </svg>
  );
}

export default function SonometerExperiment() {
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
            <ViewPill label="l" value={m.lengthCm.toFixed(1)} unit="cm" />
            <ViewPill label="ν" value={m.mains.toFixed(2)} unit="Hz" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — resonating length against load',
          columns: [
            col('mass', 'M', 'kg', 2),
            col('t', 'T = Mg', 'N', 2),
            col('l', 'l', 'cm', 1),
            col('f', 'f = (1/2l)√(T/µ)', 'Hz', 1, true),
            col('nu', 'ν = f/2', 'Hz', 2, true)
          ],
          capture: () => ({ mass: m.mass, t: m.tension, l: m.lengthCm, f: 0, nu: 0 }),
          derive: (row) => {
            const f = stringFrequency(Number(row.l) / 100, Number(row.t), m.mu);
            return { ...row, f, nu: f / 2 };
          },
          comparison: { label: 'mains frequency', unit: 'Hz', experimental: m.mains, theoretical: MAINS_HZ, precision: 2 },
          captureEnabled: m.amplitude > 0.5,
          captureHint: 'Drag the bridge until the paper rider is thrown off, then record. Repeat for five loads.'
        };
      }}
    />
  );
}

export { definition, education };
