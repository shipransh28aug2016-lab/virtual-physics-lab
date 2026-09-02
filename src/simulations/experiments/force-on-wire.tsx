import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BarMagnet, BatteryCell, Switch } from '@/components/instruments/Instruments';
import { forceOnWire } from '@/physics-engine/magnetism';
import { CONSTANTS } from '@/physics-engine/constants';
import { degToRad } from '@/physics-engine/units';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './force-on-wire.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#45d68b',
  controls: [
    { kind: 'slider', key: 'current', label: 'Current in the wire', symbol: 'I', unit: 'A', min: 0, max: 10, step: 0.1, initial: 3, precision: 1 },
    { kind: 'slider', key: 'b', label: 'Magnetic field', symbol: 'B', unit: 'T', min: 0, max: 1.5, step: 0.01, initial: 0.4, precision: 2 },
    { kind: 'slider', key: 'length', label: 'Length of wire in the field', symbol: 'L', unit: 'cm', min: 1, max: 30, step: 0.5, initial: 10, precision: 1 },
    { kind: 'slider', key: 'angle', label: 'Angle between wire and field', symbol: '\\theta', unit: '°', min: 0, max: 180, step: 1, initial: 90 },
    { kind: 'toggle', key: 'reverse', label: 'Reverse the current', initial: false, hint: 'Flips the direction of the force' }
  ],
  defaults: { current: 3, b: 0.4, length: 10, angle: 90, reverse: false }
};

const education: EducationPack = {
  theory: [
    'A conductor carrying current contains moving charges. Each charge experiences the magnetic part of the Lorentz force, and the sum of these forces appears as a force on the wire itself.',
    'The magnitude of the force is F = BIL sin θ, where θ is the angle between the wire and the field. The force is greatest when the wire is perpendicular to the field and zero when it is parallel.',
    'The direction is given by Fleming\u2019s left-hand rule: the first finger points along the field, the second along the current, and the thumb then shows the direction of the force. Reversing either the current or the field reverses the force.'
  ],
  formulas: [
    { tex: '\\vec{F} = I \\vec{L} \\times \\vec{B}', caption: 'Vector form.' },
    { tex: 'F = BIL \\sin\\theta', caption: 'Magnitude.' },
    { tex: 'F = qvB\\sin\\theta', caption: 'Force on the individual charge carriers.' }
  ],
  variables: [
    { symbol: 'F', name: 'Force on the wire', unit: 'N' },
    { symbol: 'B', name: 'Magnetic flux density', unit: 'T' },
    { symbol: 'I', name: 'Current', unit: 'A' },
    { symbol: 'L', name: 'Length of wire in the field', unit: 'm' },
    { symbol: '\\theta', name: 'Angle between wire and field', unit: '°' }
  ],
  procedure: [
    'Set the field strength and the length of wire inside the field.',
    'Increase the current and note how the force grows in proportion.',
    'Rotate the wire and observe that the force varies as sin θ, becoming zero when the wire is parallel to the field.',
    'Reverse the current and confirm that the force reverses direction.'
  ],
  precautions: ['The wire heats up at high current, which changes its resistance.', 'The field of the magnet is not perfectly uniform, so the effective length differs slightly from the geometric length.', 'Keep the leads away from the field so that only the test conductor is acted on.'],
  tips: ['Set θ = 30° and check that the force is exactly half of the value at θ = 90°.'],
  viva: [
    { q: 'State Fleming\u2019s left-hand rule.', a: 'With the thumb, first finger and second finger of the left hand mutually perpendicular, the first finger gives the field, the second the current and the thumb the force.' },
    { q: 'When is the force zero?', a: 'When the wire is parallel or antiparallel to the field, because sin θ is then zero.' },
    { q: 'Why does the wire experience a force at all?', a: 'Because the moving charge carriers inside it each experience the magnetic Lorentz force.' },
    { q: 'What is this effect used for?', a: 'Electric motors, moving-coil meters and loudspeakers.' },
    { q: 'Does the force depend on the sign of the charge carriers?', a: 'No. Reversing the carrier sign also reverses their drift direction, so the force on the wire is unchanged.' }
  ],
  resultTemplate: 'The force on the conductor is F = BIL sin θ and varies linearly with current and as sin θ with orientation.'
};

function compute(params: ParamValues): ModelOutput {
  const current = num(params, 'current', 3);
  const b = num(params, 'b', 0.4);
  const length = num(params, 'length', 10) / 100;
  const angle = num(params, 'angle', 90);
  const reverse = Boolean(params.reverse);
  const force = forceOnWire(b, current, length, angle);
  const drift = current / (CONSTANTS.E_CHARGE * 8.5e28 * 1e-6);
  const points: { x: number; y: number }[] = [];
  for (let a = 0; a <= 180; a += 2) points.push({ x: a, y: forceOnWire(b, current, length, a) * 1000 });
  // Free electrons inside the length of wire that is in the field (n = 8.5e28 m⁻³ for copper).
  const carriers = 8.5e28 * 1e-6 * (length / 100);

  return {
    readouts: [
      ro('f', 'Force on the wire', force, 'N', 5, { sub: formatSI(force, 3), tone: reverse ? 'neg' : 'normal' }),
      ro('fmax', 'Maximum force (θ = 90°)', forceOnWire(b, current, length, 90), 'N', 5),
      ro('b', 'Field', b, 'T', 3),
      ro('i', 'Current', reverse ? -current : current, 'A', 2),
      ro('l', 'Length in field', length, 'm', 3),
      ro('sin', 'sin θ', Math.abs(Math.sin(degToRad(angle))), '\u2014', 3),
      ro('vd', 'Drift speed of electrons', drift, 'm/s', 6, { sub: `${(drift * 1000).toFixed(3)} mm/s` }),
      ro('q', 'Free electrons in the wire', carriers, '', 0, { text: formatSI(carriers, 3), sub: 'n = 8.5 × 10²⁸ m⁻³, A = 1 mm²' })
    ],
    graph: {
      title: 'Force against the angle between wire and field',
      xLabel: 'θ (°)', yLabel: 'F (mN)',
      series: [{ key: 'f', label: 'F', color: '#45d68b', points }]
    },
    live: { x: angle, y: force * 1000 },
    description: `A ${length * 100} cm wire carrying ${current.toFixed(1)} ampere at ${angle.toFixed(0)}° to a ${b.toFixed(2)} tesla field experiences a force of ${formatSI(force, 3)} newton${reverse ? ' in the reversed direction' : ''}.`,
    result: `F = BIL sin \u03b8 = ${b.toFixed(2)} \u00d7 ${current.toFixed(1)} \u00d7 ${length.toFixed(3)} \u00d7 ${Math.abs(Math.sin(degToRad(angle))).toFixed(3)} = ${formatSI(force, 4)} N, directed ${reverse ? 'opposite to' : 'along'} Fleming\u2019s left-hand thumb.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const current = num(params, 'current', 3);
  const b = num(params, 'b', 0.4);
  const length = num(params, 'length', 10) / 100;
  const angle = num(params, 'angle', 90);
  const reverse = Boolean(params.reverse);
  const force = forceOnWire(b, current, length, angle);
  const wireLen = length * 620;
  const rad = degToRad(angle);
  const dx = (wireLen / 2) * Math.cos(rad);
  const dy = (wireLen / 2) * Math.sin(rad) * 0.35;
  const arrow = Math.min(force * 260, 90);
  const dir = reverse ? -1 : 1;

  return (
    <svg viewBox="0 0 800 460" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={120} y={80} width={560} height={240} rx={10} />
      <BarMagnet x={78} y={130} width={160} height={44} rotate={-90} />
      <BarMagnet x={638} y={130} width={160} height={44} rotate={90} />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={690 - i * 2} y1={110 + i * 30} x2={620 - i * 2} y2={110 + i * 30} stroke="#3f6f8a" strokeWidth={1.2} markerEnd="url(#lab-arrow)" opacity={0.55} />
      ))}
      <text x={400} y={104} textAnchor="middle" fontSize={10} fill="#5e93ad">magnetic field B = {b.toFixed(2)} T (N → S)</text>
      <line x1={400 - dx} y1={200 - dy} x2={400 + dx} y2={200 + dy} stroke="#ffc65c" strokeWidth={5} strokeLinecap="round" />
      <line x1={400 - dx} y1={200 - dy} x2={140} y2={120} stroke="#6f8296" strokeWidth={2} />
      <line x1={400 + dx} y1={200 + dy} x2={660} y2={120} stroke="#6f8296" strokeWidth={2} />
      {current > 0 ? (
        <g>
          <line x1={400 - dx * 0.6} y1={200 - dy * 0.6} x2={400 + dx * 0.6} y2={200 + dy * 0.6} stroke={reverse ? '#ff7a90' : '#45d68b'} strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#lab-arrow)" />
          <text x={400 + dx * 0.7} y={200 + dy * 0.7 - 10} fontSize={11} fill={reverse ? '#ff7a90' : '#45d68b'}>
            I = {(reverse ? -current : current).toFixed(1)} A
          </text>
        </g>
      ) : null}
      {force > 1e-9 ? (
        <g transform={`translate(400 200)`}>
          <line x1={0} y1={0} x2={0} y2={dir * arrow} stroke="#ff7a90" strokeWidth={3.4} markerEnd="url(#lab-arrow)" />
          <text x={10} y={dir * arrow} fontSize={11} fill="#ff7a90" fontFamily="ui-monospace, monospace">
            F = {formatSI(force, 3)} N
          </text>
        </g>
      ) : (
        <text x={400} y={260} textAnchor="middle" fontSize={11} fill="#8497ad">no force — wire parallel to the field</text>
      )}
      <g transform="translate(400 380)">
        <BatteryCell x={-200} y={0} emf={current} live={current > 0} />
        <Switch x={-60} y={0} closed={current > 0} live={current > 0} label="K" />
        <text x={40} y={5} fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
          θ = {angle.toFixed(0)}° · L = {(length * 100).toFixed(0)} cm
        </text>
      </g>
      <text x={400} y={462} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        Fleming’s left-hand rule · F = BIL sin θ
      </text>
      {/* The commutator switch that reverses the current through the wire. */}
      <StageSwitch
        spec={control('reverse', 'toggle')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={400}
        y={418}
        label="Reverse the current"
      />
        </svg>
  );
}

export default function ForceOnWireExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const current = num(p, 'current', 3);
        const b = num(p, 'b', 0.4);
        const length = num(p, 'length', 10) / 100;
        const angle = num(p, 'angle', 90);
        return {
          title: 'Observation table — force on a current-carrying wire',
          columns: [
            { key: 'i', label: 'I', unit: 'A', precision: 2 },
            { key: 'b', label: 'B', unit: 'T', precision: 3 },
            { key: 'l', label: 'L', unit: 'm', precision: 3 },
            { key: 'a', label: 'θ', unit: '°', precision: 0 },
            { key: 'f', label: 'F', unit: 'mN', precision: 3, derived: true }
          ],
          capture: () => ({ i: current, b, l: length, a: angle, f: 0 }),
          derive: (row) => ({ ...row, f: forceOnWire(Number(row.b), Number(row.i), Number(row.l), Number(row.a)) * 1000 })
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
