import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { ChargeGlyph } from '@/components/instruments/Instruments';
import { potentialPointCharge, electricFieldPointCharge, potentialEnergyPair } from '@/physics-engine/electrostatics';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { DragX, Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './potential-difference.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'charge', label: 'Source charge', symbol: 'Q', unit: '\u00b5C', min: -20, max: 20, step: 0.5, initial: 2, precision: 1 },
    { kind: 'slider', key: 'rA', label: 'Distance of point A', symbol: 'r_A', unit: 'cm', min: 1, max: 40, step: 0.5, initial: 10, precision: 1 },
    { kind: 'slider', key: 'rB', label: 'Distance of point B', symbol: 'r_B', unit: 'cm', min: 1, max: 40, step: 0.5, initial: 30, precision: 1 },
    { kind: 'slider', key: 'test', label: 'Test charge', symbol: 'q', unit: 'nC', min: -100, max: 100, step: 1, initial: 5 },
    { kind: 'toggle', key: 'surfaces', label: 'Show equipotential surfaces', initial: true }
  ],
  defaults: { charge: 2, rA: 10, rB: 30, test: 5, surfaces: true }
};

const education: EducationPack = {
  theory: [
    'The electric potential at a point is the work done per unit positive charge in bringing a test charge from infinity to that point. It is a scalar, so potentials from several charges simply add.',
    'The potential difference between two points is the work done per unit charge in moving between them. It does not depend on the path taken, because the electrostatic field is conservative.',
    'Points at the same potential form an equipotential surface. For a point charge these are concentric spheres, and the field lines always cut them at right angles. No work is done in moving a charge along an equipotential surface.'
  ],
  formulas: [
    { tex: 'V = \\frac{1}{4\\pi\\varepsilon_0}\\frac{Q}{r}', caption: 'Potential of a point charge.' },
    { tex: 'V_A - V_B = \\frac{W_{A \\to B}}{q}', caption: 'Potential difference as work per unit charge.' },
    { tex: 'W = q(V_A - V_B)', caption: 'Work done on the test charge.' },
    { tex: '\\vec{E} = -\\frac{dV}{dr}\\hat{r}', caption: 'Field is the negative gradient of potential.' }
  ],
  variables: [
    { symbol: 'V', name: 'Electric potential', unit: 'V' },
    { symbol: 'Q', name: 'Source charge', unit: 'C' },
    { symbol: 'q', name: 'Test charge', unit: 'C' },
    { symbol: 'r', name: 'Distance from the charge', unit: 'm' },
    { symbol: 'W', name: 'Work done', unit: 'J' }
  ],
  procedure: [
    'Set the source charge and choose the distances of points A and B from it.',
    'Read the potentials at A and B and compute the potential difference.',
    'Move a test charge from A to B and note the work done on it.',
    'Display the equipotential surfaces and confirm that the field lines cut them at right angles.'
  ],
  precautions: ['The formula assumes a point charge in free space; a real conductor distorts the field.', 'Potential is defined relative to infinity, so only differences are physically measurable.', 'The test charge must be small enough not to disturb the source charge distribution.'],
  tips: ['Doubling the distance halves the potential but reduces the field to a quarter.'],
  viva: [
    { q: 'Is electric potential a vector or a scalar?', a: 'A scalar — potentials from several charges add algebraically.' },
    { q: 'What is the work done in moving a charge along an equipotential surface?', a: 'Zero, because there is no potential difference along it.' },
    { q: 'Why are field lines perpendicular to equipotential surfaces?', a: 'Because any component of the field along the surface would do work and so would create a potential difference.' },
    { q: 'How does the potential fall off with distance?', a: 'As 1/r, while the field falls off as 1/r².' },
    { q: 'Can the potential be zero where the field is not zero?', a: 'Yes — for example midway between two equal and opposite charges.' }
  ],
  resultTemplate: 'The potential difference between A and B is V_A − V_B = … volt and the work done in moving the test charge is … joule.'
};

function compute(params: ParamValues): ModelOutput {
  const q = num(params, 'charge', 8) * 1e-6;
  const rA = num(params, 'rA', 6) / 100;
  const rB = num(params, 'rB', 18) / 100;
  const test = num(params, 'test', 5) * 1e-9;

  const vA = potentialPointCharge(q, rA);
  const vB = potentialPointCharge(q, rB);
  const dv = vA - vB;
  const work = test * dv;
  const eA = electricFieldPointCharge(q, rA);
  const eB = electricFieldPointCharge(q, rB);
  const pe = potentialEnergyPair(q, test, rA);

  const points: { x: number; y: number }[] = [];
  for (let r = 1; r <= 40; r += 0.5) points.push({ x: r, y: potentialPointCharge(q, r / 100) });

  return {
    readouts: [
      ro('va', 'Potential at A', vA, 'V', 1, { sub: formatSI(vA, 4) }),
      ro('vb', 'Potential at B', vB, 'V', 1, { sub: formatSI(vB, 4) }),
      ro('dv', 'Potential difference A − B', dv, 'V', 1, { sub: formatSI(dv, 4), tone: dv < 0 ? 'neg' : 'normal' }),
      ro('w', 'Work on the test charge', work, 'J', 4, { sub: `${formatSI(work, 3)} J`, tone: work < 0 ? 'neg' : 'normal' }),
      ro('ea', 'Field at A', eA, 'N/C', 1, { sub: formatSI(eA, 3) }),
      ro('eb', 'Field at B', eB, 'N/C', 1, { sub: formatSI(eB, 3) }),
      ro('pe', 'Potential energy at A', pe, 'J', 4, { sub: `${formatSI(pe, 3)} J` })
    ],
    graph: {
      title: 'Potential against distance from the charge',
      xLabel: 'r (cm)', yLabel: 'V (V)',
      series: [{ key: 'v', label: 'V', color: '#9d8cff', points }]
    },
    live: { x: rA * 100, y: vA },
    description: `A source charge of ${(q * 1e6).toFixed(1)} microcoulomb gives a potential of ${formatSI(vA, 3)} volt at ${(rA * 100).toFixed(1)} cm and ${formatSI(vB, 3)} volt at ${(rB * 100).toFixed(1)} cm, so the potential difference is ${formatSI(dv, 3)} volt.`,
    result: `V_A \u2212 V_B = ${formatSI(vA, 4)} \u2212 ${formatSI(vB, 4)} = ${formatSI(dv, 4)} V. Moving q = ${formatSI(test, 3)} C from A to B does W = q(V_A \u2212 V_B) = ${formatSI(work, 4)} J of work.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const q = num(params, 'charge', 8) * 1e-6;
  const rA = num(params, 'rA', 6) / 100;
  const rB = num(params, 'rB', 18) / 100;
  const test = num(params, 'test', 5) * 1e-9;
  const showSurfaces = Boolean(params.surfaces ?? true);
  const cx = 400;
  const cy = 210;
  const px = (m: number) => m * 900;

  return (
    <svg viewBox="0 0 800 430" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={40} width={760} height={330} rx={12} />
      {showSurfaces
        ? [0.04, 0.08, 0.14, 0.2, 0.28].map((r) => (
            <circle key={r} cx={cx} cy={cy} r={px(r)} fill="none" stroke="#2c3f52" strokeDasharray="5 6" />
          ))
        : null}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        const r0 = px(0.03);
        const r1 = px(0.3);
        return (
          <line
            key={a}
            x1={cx + r0 * Math.cos(rad)}
            y1={cy + r0 * Math.sin(rad)}
            x2={cx + (q >= 0 ? r1 : r0) * Math.cos(rad)}
            y2={cy + (q >= 0 ? r1 : r0) * Math.sin(rad)}
            stroke={q >= 0 ? '#3f6f8a' : '#7d5566'}
            strokeWidth={1.2}
            markerEnd={q >= 0 ? 'url(#lab-arrow)' : undefined}
            markerStart={q < 0 ? 'url(#lab-arrow)' : undefined}
            opacity={0.75}
          />
        );
      })}
      <g transform={`translate(${cx} ${cy})`}>
        <ChargeGlyph q={q * 1e6} radius={15} />
      </g>
      <g transform={`translate(${cx + px(rA)} ${cy})`}>
        <circle r={6} fill="#ffc65c" stroke="#0b121c" strokeWidth={1.5} />
        <text y={-14} textAnchor="middle" fontSize={11} fill="#ffc65c">A</text>
        <text y={24} textAnchor="middle" fontSize={9.5} fill="#8497ad" fontFamily="ui-monospace, monospace">
          {formatSI(potentialPointCharge(q, rA), 3)} V
        </text>
      </g>
      <g transform={`translate(${cx - px(rB)} ${cy})`}>
        <circle r={6} fill="#25d0ee" stroke="#0b121c" strokeWidth={1.5} />
        <text y={-14} textAnchor="middle" fontSize={11} fill="#25d0ee">B</text>
        <text y={24} textAnchor="middle" fontSize={9.5} fill="#8497ad" fontFamily="ui-monospace, monospace">
          {formatSI(potentialPointCharge(q, rB), 3)} V
        </text>
      </g>
      <g transform={`translate(${cx + px(rA) / 2} ${cy - 60})`}>
        <ChargeGlyph q={test * 1e9} radius={7} />
        <text y={-14} textAnchor="middle" fontSize={9.5} fill="#8497ad">test charge q</text>
      </g>
      <text x={400} y={66} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        Equipotential surfaces cut the field lines at right angles
      </text>
      <text x={400} y={356} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        r_A = {(rA * 100).toFixed(1)} cm · r_B = {(rB * 100).toFixed(1)} cm · V_A − V_B = {formatSI(potentialPointCharge(q, rA) - potentialPointCharge(q, rB), 3)} V
      </text>
      {/* Points A and B are placed by dragging; the source charge has its own dial. */}
      <DragX
        spec={control('rA', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={400}
        y={392}
        length={340}
        label="Distance of point A — drag the marker"
      />
      <Knob
        spec={control('charge', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={70}
        y={392}
        radius={18}
        label="Source charge Q"
      />
        </svg>
  );
}

export default function PotentialDifferenceExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const q = num(p, 'charge', 8) * 1e-6;
        const rA = num(p, 'rA', 6) / 100;
        const rB = num(p, 'rB', 18) / 100;
        const test = num(p, 'test', 5) * 1e-9;
        return {
          title: 'Observation table — potential and work',
          columns: [
            { key: 'ra', label: 'r_A', unit: 'cm', precision: 1 },
            { key: 'rb', label: 'r_B', unit: 'cm', precision: 1 },
            { key: 'va', label: 'V_A', unit: 'V', precision: 1, derived: true },
            { key: 'vb', label: 'V_B', unit: 'V', precision: 1, derived: true },
            { key: 'w', label: 'W', unit: 'nJ', precision: 4, derived: true }
          ],
          capture: () => ({ ra: rA * 100, rb: rB * 100, va: 0, vb: 0, w: 0 }),
          derive: (row) => {
            const va = potentialPointCharge(q, Number(row.ra) / 100);
            const vb = potentialPointCharge(q, Number(row.rb) / 100);
            return { ...row, va, vb, w: test * (va - vb) * 1e9 };
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
