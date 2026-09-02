import { useMemo } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { ChargeGlyph } from '@/components/instruments/Instruments';
import { electricFieldSuperposition, potentialPointCharge } from '@/physics-engine/electrostatics';
import { mag2 } from '@/physics-engine/vectors';
import { formatSI } from '@/utils/format';
import { col, num, ro, bool } from './_shared';
import { DragX, type StageApi } from '@/components/controls/StageKit';

import { meta } from './electric-field-charges.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#7dd3fc',
  controls: [
    { kind: 'slider', key: 'q1', label: 'Charge q₁', symbol: 'q_1', unit: 'μC', min: -10, max: 10, step: 0.5, initial: 5 },
    { kind: 'slider', key: 'q2', label: 'Charge q₂', symbol: 'q_2', unit: 'μC', min: -10, max: 10, step: 0.5, initial: -5 },
    { kind: 'slider', key: 'sep', label: 'Separation', symbol: 'd', unit: 'cm', min: 4, max: 60, step: 1, initial: 24 },
    { kind: 'slider', key: 'probe', label: 'Probe position', symbol: 'x', unit: 'cm', min: -30, max: 30, step: 0.5, initial: 0, hint: 'Point where the field is measured' },
    { kind: 'toggle', key: 'showLines', label: 'Show field lines', initial: true },
    { kind: 'toggle', key: 'showEquipotential', label: 'Show equipotential grid', initial: false }
  ],
  defaults: { q1: 5, q2: -5, sep: 24, probe: 0, showLines: true, showEquipotential: false }
};

const education: EducationPack = {
  theory: [
    'A charge modifies the space around it so that any other charge placed there experiences a force. That modification is the electric field, defined as the force per unit positive test charge.',
    'The field of a system of charges is the vector sum of the fields of the individual charges. This principle of superposition is what the field map here computes at every plotted point.',
    'Field lines start on positive charges and end on negative ones. They never cross, because the field at a point has a single direction. Where the lines crowd together the field is strong.',
    'The electric potential is a scalar, so it simply adds. A dipole has zero potential on its perpendicular bisector even though the field there is not zero — a useful reminder that field and potential carry different information.'
  ],
  formulas: [
    { tex: '\\vec{E} = \\frac{1}{4\\pi\\epsilon_0} \\frac{q}{r^2} \\hat{r}', caption: 'Field of a single point charge.' },
    { tex: '\\vec{E}_{net} = \\sum_i \\vec{E}_i', caption: 'Superposition of fields.' },
    { tex: 'V = \\frac{1}{4\\pi\\epsilon_0} \\sum_i \\frac{q_i}{r_i}', caption: 'Scalar addition of potentials.' },
    { tex: 'p = q d', caption: 'Dipole moment for two equal and opposite charges separated by d.' }
  ],
  variables: [
    { symbol: '\\vec{E}', name: 'Electric field', unit: 'N C⁻¹' },
    { symbol: 'V', name: 'Electric potential', unit: 'V' },
    { symbol: 'q', name: 'Source charge', unit: 'C' },
    { symbol: 'r', name: 'Distance from the charge', unit: 'm' },
    { symbol: 'p', name: 'Dipole moment', unit: 'C m' }
  ],
  procedure: [
    'Set q₁ = +5 μC and q₂ = −5 μC to build an electric dipole.',
    'Move the probe along the axis and note how the field grows as the probe approaches either charge.',
    'Place the probe at the midpoint and confirm that the field is large but the potential is zero.',
    'Make both charges positive and confirm that a null point appears between them.',
    'Switch on the equipotential grid and check that the lines are perpendicular to the field lines.'
  ],
  precautions: [
    'A test charge must be small enough not to disturb the source charges.',
    'Field values diverge at the position of a point charge; readings very close to a charge are not physical.',
    'Remember that field lines are a drawing convention, not physical objects.'
  ],
  tips: [
    'Equal like charges give a null point exactly between them — watch the probe reading fall to zero.',
    'The equipotential grid is densest where the field is strongest.'
  ],
  viva: [
    { q: 'Why do electric field lines never cross?', a: 'Because the field at a point has a unique direction; crossing lines would imply two directions at the same point.' },
    { q: 'What is the field at the centre of an electric dipole?', a: 'It is not zero. On the axial line E = 2kp/r³ directed from the positive to the negative charge.' },
    { q: 'Can the potential be zero where the field is not zero?', a: 'Yes. On the equatorial plane of a dipole the potential is zero while the field is finite.' },
    { q: 'State Gauss’s law.', a: 'The flux of the electric field through any closed surface equals the enclosed charge divided by ε₀.' },
    { q: 'Why is the field inside a conductor zero in electrostatics?', a: 'Any internal field would move free charges until they redistribute and cancel it.' }
  ],
  resultTemplate: 'The field map and the probe reading both follow the superposition of the two point-charge fields.'
};

const W = 800;
const H = 480;
const CY = 250;

function compute(params: ParamValues): ModelOutput {
  const q1 = num(params, 'q1', 5) * 1e-6;
  const q2 = num(params, 'q2', -5) * 1e-6;
  const sep = num(params, 'sep', 24) / 100;
  const probe = num(params, 'probe', 0) / 100;

  const p1 = { x: -sep / 2, y: 0 };
  const p2 = { x: sep / 2, y: 0 };
  const at = { x: probe, y: 0 };

  const e = electricFieldSuperposition([{ q: q1, pos: p1 }, { q: q2, pos: p2 }], at);
  // The probe may be dragged onto a charge, where the point-charge field diverges;
  // clamp it so the plot stays finite and say so instead of drawing Infinity.
  const onCharge = Math.min(Math.hypot(at.x - p1.x, at.y - p1.y), Math.hypot(at.x - p2.x, at.y - p2.y)) < 1e-3;
  const emag = onCharge ? Number.NaN : mag2(e);
  const v = potentialPointCharge(q1, Math.hypot(at.x - p1.x, at.y - p1.y)) + potentialPointCharge(q2, Math.hypot(at.x - p2.x, at.y - p2.y));
  const dipole = Math.abs(q1) * sep;

  const points: { x: number; y: number }[] = [];
  for (let x = -0.3; x <= 0.3001; x += 0.01) {
    const ee = electricFieldSuperposition([{ q: q1, pos: p1 }, { q: q2, pos: p2 }], { x, y: 0 });
    points.push({ x: x * 100, y: mag2(ee) });
  }

  return {
    readouts: [
      ro('emag', 'Field at probe', emag, 'N/C', 4, { tone: onCharge ? 'alert' : 'normal', text: onCharge ? 'undefined at a point charge' : undefined }),
      ro('edir', 'Field direction', (e.x >= 0 ? 0 : 180), '°', 0, { sub: e.x >= 0 ? 'to the right' : 'to the left' }),
      ro('v', 'Potential at probe', v, 'V', 4, { tone: v < 0 ? 'neg' : 'normal' }),
      ro('p', 'Dipole moment', dipole, 'C·m', 3),
      ro('d', 'Separation', sep * 100, 'cm', 1)
    ],
    graph: {
      title: 'Field magnitude along the line joining the charges',
      xLabel: 'x (cm)',
      yLabel: '|E| (N/C)',
      series: [{ key: 'e', label: '|E|', color: '#7dd3fc', points }],
      markers: Number.isFinite(emag)
        ? [{ x: probe * 100, y: emag, label: `${formatSI(emag, 3)} N/C`, color: '#ffc65c' }]
        : [],
      live: Number.isFinite(emag) ? { x: probe * 100, y: emag } : undefined
    },
    live: Number.isFinite(emag) ? { x: probe * 100, y: emag } : undefined,
    description: `Two point charges of ${q1 * 1e6} and ${q2 * 1e6} microcoulomb separated by ${(sep * 100).toFixed(0)} centimetres. At the probe position the field magnitude is ${formatSI(emag, 3)} newton per coulomb and the potential is ${formatSI(v, 3)} volt.`,
    result: `At x = ${(probe * 100).toFixed(1)} cm the resultant field is ${formatSI(emag, 3)} N/C directed ${e.x >= 0 ? 'to the right' : 'to the left'}, and the potential is ${formatSI(v, 3)} V.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const q1 = num(params, 'q1', 5) * 1e-6;
  const q2 = num(params, 'q2', -5) * 1e-6;
  const sep = num(params, 'sep', 24);
  const probe = num(params, 'probe', 0);
  const showLines = bool(params, 'showLines', true);
  const showEq = bool(params, 'showEquipotential', false);

  const scale = 10;
  const x1 = 400 - (sep * scale) / 2;
  const x2 = 400 + (sep * scale) / 2;
  const px = 400 + probe * scale;

  const lines = useMemo(() => {
    if (!showLines) return [];
    const out: { d: string }[] = [];
    const charges = [{ q: q1, pos: { x: x1, y: CY } }, { q: q2, pos: { x: x2, y: CY } }];
    for (const c of charges) {
      if (c.q === 0) continue;
      const n = 16;
      for (let i = 0; i < n; i += 1) {
        const a0 = (i / n) * Math.PI * 2;
        let x = c.pos.x + Math.cos(a0) * 22;
        let y = c.pos.y + Math.sin(a0) * 22;
        let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
        const sign = c.q > 0 ? 1 : -1;
        for (let step = 0; step < 90; step += 1) {
          const ex = electricFieldSuperposition(
            charges.map((cc) => ({
              q: cc.q,
              pos: { x: (cc.pos.x - 400) / scale / 100, y: (cc.pos.y - CY) / scale / 100 }
            })),
            { x: (x - 400) / scale / 100, y: (y - CY) / scale / 100 }
          );
          const m = mag2(ex);
          if (m < 1e-6) break;
          x += (ex.x / m) * sign * 5;
          y += (ex.y / m) * sign * 5;
          if (x < 10 || x > W - 10 || y < 10 || y > H - 10) break;
          d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        out.push({ d });
      }
    }
    return out;
  }, [q1, q2, x1, x2, showLines]);

  const eProbe = electricFieldSuperposition(
    [{ q: q1, pos: { x: probe / 100 - sep / 200, y: 0 } }, { q: q2, pos: { x: probe / 100 + sep / 200, y: 0 } }],
    { x: probe / 100, y: 0 }
  );
  const eMag = mag2(eProbe);
  const arrow = Math.min(Math.log10(eMag + 1e-6) * 22 + 40, 120);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <line x1={30} y1={CY} x2={W - 30} y2={CY} className="axis-line" strokeDasharray="6 5" opacity={0.45} />
      {showEq ? (
        <g opacity={0.28}>
          {Array.from({ length: 15 }, (_, i) => (
            <ellipse key={i} cx={400} cy={CY} rx={20 + i * 24} ry={16 + i * 18} fill="none" stroke="#9d8cff" strokeWidth={1} />
          ))}
        </g>
      ) : null}
      {lines.map((l, i) => (
        <path key={i} d={l.d} className="field-line" markerEnd="url(#lab-arrow-blue)" strokeWidth={1.1} fill="none" />
      ))}
      <ChargeGlyph x={x1} y={CY} q={q1} radius={17} label={`q₁ = ${(q1 * 1e6).toFixed(1)} μC`} />
      <ChargeGlyph x={x2} y={CY} q={q2} radius={17} label={`q₂ = ${(q2 * 1e6).toFixed(1)} μC`} />
      <g>
        <line x1={px} y1={CY - 46} x2={px} y2={CY + 46} stroke="#ffc65c" strokeWidth={1.4} strokeDasharray="4 3" />
        <circle cx={px} cy={CY} r={7} fill="none" stroke="#ffc65c" strokeWidth={2} />
        <text x={px} y={CY - 54} textAnchor="middle" fontSize={10} className="measure-text">
          probe
        </text>
      </g>
      {eMag > 0 ? (
        <line
          x1={px}
          y1={CY}
          x2={px + Math.sign(eProbe.x) * arrow}
          y2={CY}
          stroke="#ffc65c"
          strokeWidth={2.6}
          markerEnd="url(#lab-arrow)"
        />
      ) : null}
      <text x={400} y={56} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {q1 * q2 < 0 ? 'Electric dipole — unlike charges' : q1 === 0 || q2 === 0 ? 'Single charge' : 'Like charges — a null point exists between them'}
      </text>
      {/* The field probe is dragged along the line joining the two charges. */}
      <DragX
        spec={control('probe', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={60}
        y={H - 52}
        length={W - 120}
        label="Probe position — drag it between the charges"
      />
        </svg>
  );
}

export default function ElectricFieldChargesExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const q1 = num(p, 'q1', 5) * 1e-6;
        const q2 = num(p, 'q2', -5) * 1e-6;
        const sep = num(p, 'sep', 24) / 100;
        const probe = num(p, 'probe', 0) / 100;
        const e = electricFieldSuperposition(
          [{ q: q1, pos: { x: -sep / 2, y: 0 } }, { q: q2, pos: { x: sep / 2, y: 0 } }],
          { x: probe, y: 0 }
        );
        const v =
          potentialPointCharge(q1, Math.abs(probe + sep / 2)) + potentialPointCharge(q2, Math.abs(probe - sep / 2));
        return {
          title: 'Observation table — field and potential along the axis',
          columns: [col('x', 'Probe x', 'cm', 1), col('e', '|E|', 'N/C', 2), col('v', 'V', 'V', 2)],
          capture: () => ({ x: probe * 100, e: mag2(e), v }),
          captureHint: 'Move the probe to a new position before each reading.'
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
