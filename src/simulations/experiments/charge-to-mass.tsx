import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { CONSTANTS } from '@/physics-engine/constants';
import { velocityAfterAcceleration } from '@/physics-engine/electrostatics';
import { gyroradius } from '@/physics-engine/magnetism';
import { formatSI } from '@/utils/format';
import { num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './charge-to-mass.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ffc65c',
  controls: [
    { kind: 'slider', key: 'vAcc', label: 'Accelerating voltage', symbol: 'V', unit: 'V', min: 100, max: 5000, step: 10, initial: 2000 },
    { kind: 'slider', key: 'eField', label: 'Deflecting field', symbol: 'E', unit: 'kV/m', min: 0, max: 200, step: 1, initial: 60 },
    { kind: 'slider', key: 'bField', label: 'Magnetic field', symbol: 'B', unit: 'mT', min: 0, max: 5, step: 0.01, initial: 1.6, precision: 2, hint: 'At the balance field B = E/\u221a(4V\u00b7(e/m)) \u2248 1.60 mT the beam is undeflected and e/m = E\u00b2/(4VB\u00b2).' },
    { kind: 'slider', key: 'length', label: 'Deflection length', symbol: 'l', unit: 'cm', min: 2, max: 12, step: 0.5, initial: 5, precision: 1 },
    { kind: 'slider', key: 'screen', label: 'Field to screen', symbol: 'L', unit: 'cm', min: 10, max: 40, step: 1, initial: 20 }
  ],
  defaults: { vAcc: 2000, eField: 60, bField: 1.6, length: 5, screen: 20 }
};

const education: EducationPack = {
  theory: [
    'An electron gun accelerates electrons from rest through a potential difference V, so each electron leaves with kinetic energy eV. Its speed is therefore fixed by V and by the unknown ratio e/m.',
    'The beam then passes between charged plates that bend it electrically, and through a magnetic field that bends it the other way. When the two deflections cancel, the beam travels straight and e/m can be found from the balance condition.',
    'The balance condition is eE = evB, which gives v = E/B. Combining this with ½mv² = eV eliminates v and gives e/m = E²/(4VB²).',
    'J. J. Thomson used exactly this method in 1897. The value he obtained was about a thousand times larger than that of the hydrogen ion, which is what suggested that the electron is a universal constituent of matter.'
  ],
  formulas: [
    { tex: '\\frac{1}{2} m v^2 = eV', caption: 'Energy gained in the accelerating field.' },
    { tex: 'eE = evB', caption: 'Balance of electric and magnetic forces.' },
    { tex: '\\frac{e}{m} = \\frac{E^2}{4VB^2}', caption: 'Specific charge from the balance condition, since \u00bdmv\u00b2 = eV.' },
    { tex: 'r = \\frac{mv}{eB}', caption: 'Radius of the circular path when only the magnetic field acts.' }
  ],
  variables: [
    { symbol: 'e', name: 'Elementary charge', unit: 'C', note: '1.602 × 10⁻¹⁹' },
    { symbol: 'm', name: 'Electron mass', unit: 'kg', note: '9.109 × 10⁻³¹' },
    { symbol: 'V', name: 'Accelerating voltage', unit: 'V' },
    { symbol: 'E', name: 'Deflecting electric field', unit: 'V m⁻¹' },
    { symbol: 'B', name: 'Magnetic field', unit: 'T' },
    { symbol: 'v', name: 'Electron speed', unit: 'm s⁻¹' },
    { symbol: 'r', name: 'Path radius', unit: 'm' }
  ],
  procedure: [
    'Set the accelerating voltage, for example 2000 V.',
    'With the magnetic field at zero, raise the electric field until the beam is clearly deflected.',
    'Now raise the magnetic field until the beam returns to the undeflected line — this is the balance point.',
    'Record V, E and B at balance and press Record reading.',
    'Repeat for several accelerating voltages and average the values of e/m obtained.'
  ],
  precautions: [
    'The non-relativistic formula is accurate only while v is well below the speed of light; above about 5 kV a correction is needed.',
    'Stray magnetic fields from the Earth and from nearby equipment must be compensated.',
    'The beam has finite thickness, so the balance point cannot be located more precisely than about a millimetre.'
  ],
  tips: [
    'At balance the readout labelled “net deflection” reads zero — that is the condition to search for.',
    'Compare the value you obtain with the accepted 1.759 × 10¹¹ C/kg.'
  ],
  viva: [
    { q: 'Why is the beam undeflected at balance?', a: 'Because the electric force eE and the magnetic force evB are equal and opposite, so the net transverse force is zero.' },
    { q: 'Derive e/m = E²/(4VB²).', a: 'From eE = evB, v = E/B. Substituting into ½mv² = eV gives v² = 2V(e/m), so E²/B² = 2V(e/m) and e/m = E²/(4VB²).' },
    { q: 'What is the accepted value of e/m for the electron?', a: 'About 1.759 × 10¹¹ C/kg.' },
    { q: 'Why does the method become inaccurate at high accelerating voltage?', a: 'Because the electron speed becomes a significant fraction of c and relativistic mass increase matters.' },
    { q: 'What did Thomson conclude from the large value of e/m?', a: 'That the electron is much lighter than any ion and is a universal constituent of atoms.' }
  ],
  resultTemplate: 'The value of e/m obtained from the balance condition agrees with the accepted value within the experimental uncertainty.'
};

function compute(params: ParamValues): ModelOutput {
  const vAcc = num(params, 'vAcc', 2000);
  const eField = num(params, 'eField', 60) * 1000;
  const bField = num(params, 'bField', 1.14) / 1000;
  const length = num(params, 'length', 5) / 100;
  const screen = num(params, 'screen', 20) / 100;

  const qmTrue = CONSTANTS.E_CHARGE / CONSTANTS.M_E;
  const v = velocityAfterAcceleration(CONSTANTS.E_CHARGE, vAcc, CONSTANTS.M_E);
  const qmMeasured = bField === 0 ? Number.POSITIVE_INFINITY : (eField * eField) / (4 * vAcc * bField * bField);
  const fE = CONSTANTS.E_CHARGE * eField;
  const fB = CONSTANTS.E_CHARGE * v * bField;
  const netForce = fE - fB;
  // Transverse displacement on the screen for a beam of the true e/m.
  const accel = netForce / CONSTANTS.M_E;
  const tIn = length / v;
  const yIn = 0.5 * accel * tIn * tIn;
  const slope = accel * tIn / v;
  const yScreen = yIn + slope * (screen - length / 2);
  const radius = gyroradius(CONSTANTS.M_E, v, CONSTANTS.E_CHARGE, bField);

  const points: { x: number; y: number }[] = [];
  for (let b = 0.0001; b <= 0.005; b += 0.00005) {
    const a2 = (CONSTANTS.E_CHARGE * (eField - v * b)) / CONSTANTS.M_E;
    const y2 = 0.5 * a2 * tIn * tIn + (a2 * tIn / v) * (screen - length / 2);
    points.push({ x: b * 1000, y: y2 * 1000 });
  }

  return {
    readouts: [
      ro('v', 'Electron speed', v, 'm/s', 4, { sub: `${((v / CONSTANTS.C_LIGHT) * 100).toFixed(2)}% of c` }),
      ro('qm', 'e/m from balance', qmMeasured, 'C/kg', 4, { tone: Math.abs(qmMeasured - qmTrue) / qmTrue < 0.02 ? 'normal' : 'alert' }),
      ro('qmT', 'Accepted e/m', qmTrue, 'C/kg', 4, { tone: 'dim' }),
      ro('defl', 'Screen deflection', yScreen * 1000, 'mm', 2, { tone: Math.abs(yScreen) < 1e-4 ? 'normal' : 'alert' }),
      ro('r', 'Path radius', radius, 'm', 4)
    ],
    graph: singleSeriesGraph({
      title: 'Screen deflection against magnetic field', xLabel: 'B (mT)', yLabel: 'deflection (mm)',
      seriesLabel: 'deflection', color: '#ffc65c', points,
      live: { x: bField * 1000, y: yScreen * 1000 },
      guides: [{ axis: 'y', value: 0, label: 'balance', color: '#45d68b' }]
    }),
    description: `Electrons accelerated through ${vAcc} volts travel at ${formatSI(v, 3)} metres per second. The electric and magnetic deflections are ${formatSI(fE, 3)} and ${formatSI(fB, 3)} newton, so the beam lands ${formatSI(yScreen * 1000, 3)} millimetre from the undeflected line.`,
    result: Math.abs(yScreen) < 2e-4
      ? `The beam is undeflected, so eE = evB and e/m = E²/(4VB²) = ${formatSI(qmMeasured, 4)} C/kg, within ${(((qmMeasured - qmTrue) / qmTrue) * 100).toFixed(2)}% of the accepted ${formatSI(qmTrue, 4)} C/kg.`
      : `The beam is deflected by ${formatSI(yScreen * 1000, 3)} mm. Adjust the magnetic field until the deflection is zero, then read e/m from the measurement panel.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const vAcc = num(params, 'vAcc', 2000);
  const eField = num(params, 'eField', 60) * 1000;
  const bField = num(params, 'bField', 1.14) / 1000;
  const v = velocityAfterAcceleration(CONSTANTS.E_CHARGE, vAcc, CONSTANTS.M_E);
  const netForce = CONSTANTS.E_CHARGE * (eField - v * bField);
  const length = num(params, 'length', 5) / 100;
  const screen = num(params, 'screen', 20) / 100;
  const accel = netForce / CONSTANTS.M_E;
  const tIn = length / v;
  const yIn = 0.5 * accel * tIn * tIn;
  const slope = (accel * tIn) / v;
  const yScreen = yIn + slope * (screen - length / 2);

  const beamRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!beamRef.current) return;
    const x0 = 120;
    const xPlate0 = 300;
    const xPlate1 = 400;
    const xScreen = 700;
    const scale = 1400;
    const yMid = 240;
    const y1 = yMid - yIn * scale;
    const y2 = yMid - yScreen * scale;
    beamRef.current.setAttribute(
      'd',
      `M${x0} ${yMid} L${xPlate0} ${yMid} Q${(xPlate0 + xPlate1) / 2} ${(yMid + y1) / 2} ${xPlate1} ${y1} L${xScreen} ${Math.max(30, Math.min(450, y2))}`
    );
  }, [yIn, yScreen]);

  return (
    <svg viewBox="0 0 800 480" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <rect x={70} y={205} width={70} height={70} rx={8} fill="url(#lab-case)" stroke="#3a4c60" />
      <text x={105} y={244} textAnchor="middle" fontSize={10} fill="#8497ad">e⁻ gun</text>
      <text x={105} y={292} textAnchor="middle" fontSize={10} className="label-mono">{vAcc.toFixed(0)} V</text>
      <rect x={290} y={170} width={120} height={14} rx={3} fill="url(#lab-plate)" stroke="#5c7085" />
      <rect x={290} y={296} width={120} height={14} rx={3} fill="url(#lab-plate)" stroke="#5c7085" />
      {Array.from({ length: 6 }, (_, i) => (
        <text key={i} x={305 + i * 20} y={190} fontSize={11} fill="#ff6b7d" fontWeight={700}>+</text>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <text key={`n${i}`} x={305 + i * 20} y={308} fontSize={12} fill="#5aa9ff" fontWeight={700}>−</text>
      ))}
      <text x={350} y={160} textAnchor="middle" fontSize={10} fill="#8497ad">E = {(eField / 1000).toFixed(0)} kV/m</text>
      <g opacity={0.85}>
        {Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 3 }, (_, j) => (
            <circle key={`${i}-${j}`} cx={470 + i * 34} cy={200 + j * 40} r={7} fill="none" stroke="#9d8cff" strokeWidth={1.2} />
          ))
        )}
        {Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 3 }, (_, j) => (
            <circle key={`d${i}-${j}`} cx={470 + i * 34} cy={200 + j * 40} r={1.8} fill="#9d8cff" />
          ))
        )}
      </g>
      <text x={555} y={176} textAnchor="middle" fontSize={10} fill="#9d8cff">B = {(bField * 1000).toFixed(2)} mT (out of screen)</text>
      <rect x={696} y={40} width={14} height={400} rx={3} fill="url(#lab-metal)" stroke="#5c7085" />
      <text x={703} y={32} textAnchor="middle" fontSize={10} fill="#8497ad">screen</text>
      <line x1={120} y1={240} x2={700} y2={240} className="dim-line" />
      <path ref={beamRef} d="M120 240 L700 240" fill="none" stroke="#ffd257" strokeWidth={2.6} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #ffd25788)' }} />
      <text x={400} y={56} textAnchor="middle" fontSize={12.5} fill="#eaf1f8" fontWeight={600}>
        {Math.abs(yScreen) < 2e-4 ? 'Balanced — electric and magnetic deflections cancel' : 'Beam deflected — adjust B to restore balance'}
      </text>
      {/* The magnet's field is set on the apparatus, beside the deflection region. */}
      <Knob
        spec={control('bField', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={400}
        y={432}
        radius={19}
        label="Magnetic field B — turn the magnet supply"
      />
        </svg>
  );
}

export default function ChargeToMassExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const vAcc = num(p, 'vAcc', 2000);
        const eField = num(p, 'eField', 60) * 1000;
        const bField = num(p, 'bField', 1.14) / 1000;
        const qm = (eField * eField) / (4 * vAcc * bField * bField);
        return {
          title: 'Observation table — determination of e/m',
          columns: [
            { key: 'v', label: 'V', unit: 'V', precision: 0 },
            { key: 'e', label: 'E', unit: 'kV/m', precision: 1 },
            { key: 'b', label: 'B', unit: 'mT', precision: 2 },
            { key: 'qm', label: 'e/m', unit: '×10¹¹ C/kg', precision: 3, derived: true }
          ],
          capture: () => ({ v: vAcc, e: eField / 1000, b: bField * 1000, qm: 0 }),
          derive: (row) => {
            const V = Number(row.v);
            const E = Number(row.e) * 1000;
            const B = Number(row.b) / 1000;
            return { ...row, qm: B === 0 ? Number.NaN : (E * E) / (2 * V * B * B) / 1e11 };
          },
          comparison: { label: 'specific charge', unit: '×10¹¹ C/kg', experimental: qm / 1e11, theoretical: CONSTANTS.E_CHARGE / CONSTANTS.M_E / 1e11, precision: 3 },
          captureHint: 'Adjust B until the beam is undeflected, then record.'
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
