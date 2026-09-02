import type { EducationPack, ExperimentDefinition, ParamValues, ValidationIssue } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { ChargeGlyph, Ray } from '@/components/instruments/Instruments';
import { ViewPill } from '@/components/shell/Viewport';
import { CONSTANTS } from '@/physics-engine/constants';
import { coulombForce, potentialEnergyPair, electricFieldPointCharge } from '@/physics-engine/electrostatics';
import { mergeIssues, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, bool, singleSeriesGraph } from './_shared';
import { DragX, type StageApi } from '@/components/controls/StageKit';

import { meta } from './coulombs-law.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id,
  slug: meta.slug,
  title: meta.title,
  shortTitle: meta.shortTitle,
  aim: meta.aim,
  unit: meta.unit,
  chapter: meta.chapter,
  kind: meta.kind,
  difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle,
  accent: '#25d0ee',
  controls: [
    {
      kind: 'slider',
      key: 'q1',
      label: 'Charge q₁',
      symbol: 'q_1',
      unit: 'μC',
      min: -10,
      max: 10,
      step: 0.1,
      initial: 4,
      hint: 'Signed — a negative value is an excess of electrons',
      stage: { x: 3, y: 7, length: 22 }
    },
    {
      kind: 'slider',
      key: 'q2',
      label: 'Charge q₂',
      symbol: 'q_2',
      unit: 'μC',
      min: -10,
      max: 10,
      step: 0.1,
      initial: 4,
      hint: 'Give the two charges opposite signs to see attraction',
      stage: { x: 62, y: 7, length: 22 }
    },
    {
      kind: 'slider',
      key: 'r',
      label: 'Separation',
      symbol: 'r',
      unit: 'cm',
      min: 2,
      max: 100,
      step: 0.5,
      initial: 30,
      precision: 1,
      hint: 'Centre-to-centre distance',
      stage: { x: 34, y: 86, length: 30 }
    },
    {
      kind: 'slider',
      key: 'kappa',
      label: 'Medium permittivity',
      symbol: '\\kappa',
      unit: '×ε₀',
      min: 1,
      max: 80,
      step: 0.5,
      initial: 1,
      hint: '1 = vacuum · 80 ≈ water'
    },
    { kind: 'toggle', key: 'showField', label: 'Show field lines of q₁', initial: true },
    { kind: 'toggle', key: 'showVectors', label: 'Show force vectors', initial: true }
  ],
  defaults: { q1: 4, q2: 4, r: 30, kappa: 1, showField: true, showVectors: true }
};

const education: EducationPack = {
  theory: [
    'Two point charges exert forces on each other along the line joining them. The force is repulsive when the charges carry the same sign and attractive when they carry opposite signs. Its magnitude is proportional to the product of the charges and inversely proportional to the square of the separation.',
    'The proportionality constant depends on the medium. In free space k = 1/(4πε₀) ≈ 8.99 × 10⁹ N m² C⁻². Introducing a dielectric of relative permittivity κ divides the force by κ, which is why charged bodies attract far more weakly in water than in air.',
    'The inverse-square dependence is the reason field lines spread out and weaken with distance. Doubling the separation cuts the force to a quarter; halving it multiplies the force by four. The observation table lets you confirm this numerically.'
  ],
  formulas: [
    { tex: 'F = \\frac{1}{4\\pi\\epsilon_0 \\kappa} \\frac{|q_1 q_2|}{r^2}', caption: "Coulomb's law for two point charges in a medium of relative permittivity κ." },
    { tex: 'U = \\frac{1}{4\\pi\\epsilon_0 \\kappa} \\frac{q_1 q_2}{r}', caption: 'Electrostatic potential energy of the pair; negative for unlike charges.' },
    { tex: 'E = \\frac{1}{4\\pi\\epsilon_0 \\kappa} \\frac{|q|}{r^2}', caption: 'Field produced by one charge at the position of the other.' },
    { tex: 'k_{exp} = \\frac{F r^2}{q_1 q_2}', caption: 'Constant recovered from the recorded trials and compared with 1/(4πε₀).' }
  ],
  variables: [
    { symbol: 'F', name: 'Electrostatic force', unit: 'N', note: 'Negative in this lab means attraction' },
    { symbol: 'q_1, q_2', name: 'Point charges', unit: 'C', note: '1 μC = 10⁻⁶ C' },
    { symbol: 'r', name: 'Separation', unit: 'm', note: 'Centre to centre' },
    { symbol: '\\epsilon_0', name: 'Vacuum permittivity', unit: 'F m⁻¹', note: '8.854 × 10⁻¹²' },
    { symbol: '\\kappa', name: 'Relative permittivity', unit: '—', note: 'Dimensionless; 1 in vacuum' },
    { symbol: 'U', name: 'Potential energy', unit: 'J', note: 'Work to assemble the pair from infinity' },
    { symbol: 'E', name: 'Electric field', unit: 'N C⁻¹', note: 'Equivalent to V m⁻¹' }
  ],
  procedure: [
    'Set both charges to +4 μC and leave the medium as vacuum (κ = 1).',
    'Set the separation to 20 cm, note the force and press Record reading.',
    'Repeat at 30, 40, 60 and 80 cm, recording each trial.',
    'Check that F₁/F₂ equals (r₂/r₁)² for consecutive trials — the table computes the ratio.',
    'Reverse the sign of q₂ and confirm that the force turns negative and the arrows point inwards.',
    'Raise κ to 80 and confirm the force falls by the same factor while the direction is unchanged.'
  ],
  precautions: [
    'The point-charge approximation holds only when the separation is much larger than the size of the charged bodies.',
    'Below a few centimetres a real experiment shows leakage and corona discharge; the simulation warns about this.',
    'Always record the medium with the reading — the force is meaningless without κ.',
    'Keep the sign convention consistent: a negative force here means attraction.'
  ],
  sourcesOfError: [
    'Finite size of the charged spheres, ignored by the point-charge model.',
    'Charge leakage through humid air or across the insulating supports.',
    'Induced charges on nearby conductors distorting the field.'
  ],
  tips: [
    'Keep q₁ = q₂ and sweep r for the cleanest view of the inverse-square law on the graph.',
    'Try κ = 80 to model water and watch the force fall by two orders of magnitude.'
  ],
  viva: [
    {
      q: 'State Coulomb’s law in vector form.',
      a: 'F₁₂ = (1/4πε₀)(q₁q₂/r²) r̂₁₂, where r̂₁₂ is the unit vector from q₁ to q₂. For like signs the force on q₂ points away from q₁.'
    },
    {
      q: 'Why is the electrostatic force called a central force?',
      a: 'It acts along the line joining the charges, so the torque about either charge is zero and angular momentum is conserved.'
    },
    {
      q: 'What happens to the force if air is replaced by water?',
      a: 'It is divided by the relative permittivity, about 80 for water, so it becomes roughly 1/80 of its value in air.'
    },
    {
      q: 'What would fail if the force were an inverse cube law instead?',
      a: 'Gauss’s law would fail, the field inside a closed conducting shell would not vanish, and electrostatic shielding would not work.'
    },
    {
      q: 'Is Coulomb’s law valid for moving charges?',
      a: 'No. Moving charges also exert magnetic forces and retardation effects appear; the full description needs the Lorentz force and Maxwell’s equations.'
    }
  ],
  resultTemplate:
    'The force recorded at each separation follows F ∝ 1/r², and the constant recovered from the trials agrees with 1/(4πε₀), confirming Coulomb’s law.'
};

/* ------------------------------------------------------------------- model */

function compute(params: ParamValues): ModelOutput {
  const q1uC = num(params, 'q1', 4);
  const q2uC = num(params, 'q2', 4);
  const rCm = num(params, 'r', 30);
  const kappa = num(params, 'kappa', 1);

  const q1 = q1uC * 1e-6;
  const q2 = q2uC * 1e-6;
  const rM = rCm / 100;

  const rawForce = coulombForce(q1, q2, rM);
  const force = Number.isFinite(rawForce) ? rawForce / kappa : 0;
  const mag = Math.abs(force);
  const rawU = potentialEnergyPair(q1, q2, rM);
  const energy = Number.isFinite(rawU) ? rawU / kappa : 0;
  const rawE = electricFieldPointCharge(q1, rM);
  const field = Number.isFinite(rawE) ? rawE / kappa : 0;

  const issues: ValidationIssue[] = mergeIssues(
    validateRange('q1', 'Charge q₁', q1uC, -10, 10),
    validateRange('q2', 'Charge q₂', q2uC, -10, 10),
    validateRange('r', 'Separation', rCm, 2, 100),
    validateRange('kappa', 'Relative permittivity', kappa, 1, 80)
  );
  if (rCm < 5 && (Math.abs(q1uC) > 5 || Math.abs(q2uC) > 5)) {
    issues.push({
      field: 'r',
      severity: 'warning',
      message: 'At this separation a real pair of charged spheres would leak charge through the air.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let r = 2; r <= 100; r += 1) {
    points.push({ x: r / 100, y: Math.abs(coulombForce(q1, q2, r / 100)) / kappa });
  }

  const ratioAtHalfR = rCm > 4 ? mag / (Math.abs(coulombForce(q1, q2, (rCm / 2) / 100)) / kappa) : 1;

  return {
    readouts: [
      ro('force', 'Force F', mag, 'N', 4, {
        tone: mag === 0 ? 'dim' : 'normal',
        sub: force < 0 ? 'attractive' : force > 0 ? 'repulsive' : 'none'
      }),
      ro('energy', 'Potential energy U', energy, 'J', 3, { tone: energy < 0 ? 'neg' : 'normal' }),
      ro('field', 'Field of q₁ at q₂', field, 'N/C', 3),
      ro('const', 'k / κ', CONSTANTS.K_E / kappa, 'N m² C⁻²', 4),
      ro('half', 'F(r) / F(r/2)', ratioAtHalfR, '×', 3, { sub: 'inverse-square check' })
    ],
    graph: singleSeriesGraph({
      title: 'Force magnitude against separation',
      xLabel: 'r (m)',
      yLabel: '|F| (N)',
      seriesLabel: '|F|',
      points,
      live: { x: rM, y: mag },
      markers: mag > 0 ? [{ x: rM, y: mag, label: `${formatSI(mag, 3)} N`, color: '#ffc65c' }] : []
    }),
    description: `Two point charges, ${q1uC.toFixed(1)} microcoulomb and ${q2uC.toFixed(1)} microcoulomb, separated by ${rCm.toFixed(1)} centimetres in a medium of relative permittivity ${kappa.toFixed(1)}. The force between them is ${formatSI(mag, 3)} newton and is ${force < 0 ? 'attractive' : 'repulsive'}.`,
    result: `With q₁ = ${q1uC.toFixed(1)} μC, q₂ = ${q2uC.toFixed(1)} μC and r = ${rCm.toFixed(1)} cm in a medium of κ = ${kappa.toFixed(1)}, the electrostatic force is ${formatSI(mag, 3)} N and is ${force < 0 ? 'attractive' : force > 0 ? 'repulsive' : 'zero'}. The potential energy of the pair is ${formatSI(energy, 3)} J.`
  };
}

/* -------------------------------------------------------------------- view */

const W = 800;
const H = 480;
const AXIS_Y = 250;

function Stage({ params, set, control }: StageApi) {
  const q1uC = num(params, 'q1', 4);
  const q2uC = num(params, 'q2', 4);
  const rCm = num(params, 'r', 30);
  const kappa = num(params, 'kappa', 1);
  const showField = bool(params, 'showField', true);
  const showVectors = bool(params, 'showVectors', true);

  const q1 = q1uC * 1e-6;
  const q2 = q2uC * 1e-6;
  const rM = rCm / 100;
  const force = coulombForce(q1, q2, rM) / kappa;
  const mag = Math.abs(force);
  const attractive = force < 0;

  const gap = Math.min(Math.max((rM * 4000) / 10, 80), 520);
  const x1 = 400 - gap / 2;
  const x2 = 400 + gap / 2;
  const radius = 20;
  const arrowLen = mag > 0 ? Math.min(38 + Math.log10(mag + 1e-6) * 46, 150) : 0;
  // Force on q₂ points away from q₁ when repulsive (positive force).
  const dir = attractive ? -1 : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <line x1={40} y1={AXIS_Y} x2={760} y2={AXIS_Y} className="axis-line" strokeDasharray="6 5" opacity={0.55} />

      {showField ? <FieldLines x={x1} q={q1} /> : null}

      <g>
        <line x1={x1} y1={AXIS_Y + 82} x2={x2} y2={AXIS_Y + 82} className="dim-line" />
        <line x1={x1} y1={AXIS_Y + 74} x2={x1} y2={AXIS_Y + 90} className="dim-line" />
        <line x1={x2} y1={AXIS_Y + 74} x2={x2} y2={AXIS_Y + 90} className="dim-line" />
        <text x={400} y={AXIS_Y + 104} textAnchor="middle" className="measure-text">
          r = {rCm.toFixed(1)} cm
        </text>
      </g>

      <ChargeGlyph x={x1} y={AXIS_Y} q={q1} radius={radius} label={`q₁ = ${q1uC.toFixed(1)} μC`} />
      <ChargeGlyph x={x2} y={AXIS_Y} q={q2} radius={radius} label={`q₂ = ${q2uC.toFixed(1)} μC`} />

      {showVectors && mag > 0 ? (
        <>
          <Ray
            from={{ x: x1 - dir * (radius + 6), y: AXIS_Y }}
            to={{ x: x1 - dir * (radius + 6 + arrowLen), y: AXIS_Y }}
            color="#ff6b7d"
            markerId="lab-arrow-red"
            width={2.6}
          />
          <Ray
            from={{ x: x2 + dir * (radius + 6), y: AXIS_Y }}
            to={{ x: x2 + dir * (radius + 6 + arrowLen), y: AXIS_Y }}
            color="#ff6b7d"
            markerId="lab-arrow-red"
            width={2.6}
          />
          <text
            x={x1}
            y={AXIS_Y + 44}
            textAnchor="middle"
            className="measure-text"
            fill="#ff97a4"
          >
            F = {formatSI(mag, 3)} N
          </text>
          <text
            x={x2}
            y={AXIS_Y + 44}
            textAnchor="middle"
            className="measure-text"
            fill="#ff97a4"
          >
            F = {formatSI(mag, 3)} N
          </text>
        </>
      ) : null}

      <text x={400} y={62} textAnchor="middle" fontSize={13.5} fill="#eaf1f8" fontWeight={600}>
        {q1 === 0 || q2 === 0
          ? 'One charge is neutral — no force acts'
          : attractive
          ? 'Attraction — unlike charges'
          : 'Repulsion — like charges'}
      </text>
      <text x={400} y={84} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        κ = {kappa.toFixed(1)} · k/κ = {formatSI(CONSTANTS.K_E / kappa, 3)} N m² C⁻²
      </text>
      {/* The separation is set by dragging q₂ away from q₁ along the line of centres. */}
      <DragX
        spec={control('r', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={140}
        y={AXIS_Y + 48}
        length={520}
        mapping={{ toValue: (dx) => 2 + (dx / 520) * 98, invert: (cm) => 140 + ((cm - 2) / 98) * 520 }}
        label="Separation r — drag q₂ along the line"
      />
        </svg>
  );
}

function FieldLines({ x, q }: { x: number; q: number }) {
  if (q === 0) return null;
  const outward = q > 0;
  const count = 14;
  return (
    <g opacity={0.45}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const r0 = 28;
        const r1 = 118;
        const from = { x: x + Math.cos(a) * r0, y: AXIS_Y + Math.sin(a) * r0 };
        const to = { x: x + Math.cos(a) * r1, y: AXIS_Y + Math.sin(a) * r1 };
        return (
          <line
            key={i}
            x1={outward ? from.x : to.x}
            y1={outward ? from.y : to.y}
            x2={outward ? to.x : from.x}
            y2={outward ? to.y : from.y}
            className="field-line"
            markerEnd="url(#lab-arrow-blue)"
            strokeWidth={1.1}
          />
        );
      })}
    </g>
  );
}

/* -------------------------------------------------------------- experiment */

export default function CoulombsLawExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      viewportOverlay={(params) => {
        const q1 = num(params, 'q1', 4) * 1e-6;
        const q2 = num(params, 'q2', 4) * 1e-6;
        const f = coulombForce(q1, q2, num(params, 'r', 30) / 100) / num(params, 'kappa', 1);
        return (
          <>
            <ViewPill label="F" value={formatSI(Math.abs(f), 3)} unit="N" />
            <ViewPill label="nature" value={f < 0 ? 'attractive' : f > 0 ? 'repulsive' : 'zero'} />
          </>
        );
      }}
      notebook={({ params: p, rows }) => {
        const q1 = num(p, 'q1', 4) * 1e-6;
        const q2 = num(p, 'q2', 4) * 1e-6;
        const rM = num(p, 'r', 30) / 100;
        const kappa = num(p, 'kappa', 1);
        const force = coulombForce(q1, q2, rM) / kappa;
        const ks = rows
          .map((row) => {
            const a = Number(row.q1) * 1e-6;
            const b = Number(row.q2) * 1e-6;
            const r = Number(row.r) / 100;
            const f = Number(row.f) / 100;
            return Math.abs(a * b) < 1e-18 ? Number.NaN : (f * r * r) / (a * b);
          })
          .filter((v) => Number.isFinite(v));
        const meanK = ks.length ? ks.reduce((a, b) => a + b, 0) / ks.length : Number.NaN;
        return {
          title: "Observation table \u2014 verification of Coulomb's law",
          columns: [
            col('q1', 'q\u2081', '\u03bcC', 1),
            col('q2', 'q\u2082', '\u03bcC', 1),
            col('r', 'r', 'cm', 1),
            col('f', 'F (measured)', '\u00d710\u207b\u00b2 N', 4),
            col('kexp', 'k = Fr\u00b2/q\u2081q\u2082', '\u00d710\u2079 N m\u00b2 C\u207b\u00b2', 3, true)
          ],
          capture: () => ({
            q1: num(p, 'q1', 4),
            q2: num(p, 'q2', 4),
            r: num(p, 'r', 30),
            f: Math.abs(force) * 100,
            kexp: 0
          }),
          derive: (row) => {
            const a = Number(row.q1) * 1e-6;
            const b = Number(row.q2) * 1e-6;
            const r = Number(row.r) / 100;
            const f = Number(row.f) / 100;
            const kexp = Math.abs(a * b) < 1e-18 ? Number.NaN : (f * r * r) / (a * b);
            return { ...row, kexp: kexp / 1e9 };
          },
          comparison: {
            label: 'Coulomb constant',
            unit: '\u00d710\u2079 N m\u00b2 C\u207b\u00b2',
            experimental: meanK,
            theoretical: CONSTANTS.K_E / 1e9,
            precision: 3
          },
          extraFoot: [
            {
              label: 'Inverse-square check',
              value: 'Halve the separation between two trials \u2014 the recorded force becomes four times larger.'
            }
          ],
          captureHint: 'Vary the charges or the separation before each reading.'
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
