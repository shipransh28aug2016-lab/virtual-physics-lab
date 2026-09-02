import type { EducationPack, ExperimentDefinition, ParamValues, ValidationIssue } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BatteryCell } from '@/components/instruments/Instruments';
import { parallelPlateCapacitor } from '@/physics-engine/electrostatics';
import { CONSTANTS } from '@/physics-engine/constants';
import { mergeIssues, validatePositive, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';

import { meta } from './parallel-plate-capacitor.meta';

export { meta };

const DIELECTRICS = [
  { value: 'vacuum', label: 'Vacuum (κ = 1.00)', kappa: 1 },
  { value: 'air', label: 'Air (κ = 1.0006)', kappa: 1.0006 },
  { value: 'paper', label: 'Paper (κ = 3.5)', kappa: 3.5 },
  { value: 'mica', label: 'Mica (κ = 5.4)', kappa: 5.4 },
  { value: 'glass', label: 'Glass (κ = 7.0)', kappa: 7 },
  { value: 'ceramic', label: 'Ceramic (κ = 12)', kappa: 12 },
  { value: 'water', label: 'Water (κ = 80)', kappa: 80 }
];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#25d0ee',
  controls: [
    { kind: 'slider', key: 'area', label: 'Plate area', symbol: 'A', unit: 'cm²', min: 10, max: 2000, step: 10, initial: 400 },
    { kind: 'slider', key: 'sep', label: 'Plate separation', symbol: 'd', unit: 'mm', min: 0.2, max: 20, step: 0.1, initial: 2, precision: 1 },
    { kind: 'slider', key: 'voltage', label: 'Applied voltage', symbol: 'V', unit: 'V', min: 0, max: 500, step: 5, initial: 100 },
    { kind: 'select', key: 'dielectric', label: 'Dielectric between plates', initial: 'air', options: DIELECTRICS },
    { kind: 'toggle', key: 'connected', label: 'Battery stays connected', initial: true, hint: 'If off, the charge is fixed and V changes with d' }
  ],
  defaults: { area: 400, sep: 2, voltage: 100, dielectric: 'air', connected: true }
};

const education: EducationPack = {
  theory: [
    'A parallel plate capacitor stores charge on two large conducting plates separated by a small gap. Because the plates are large compared with the gap, the field between them is nearly uniform and equals V/d.',
    'The capacitance is a geometric property: it grows with plate area and shrinks with separation. Inserting a dielectric multiplies it by the relative permittivity κ, because the polarised dielectric produces a field that partially cancels the applied field.',
    'Whether the battery stays connected changes what is conserved. With the battery connected the potential difference is fixed, so changing the separation changes the charge. With the battery disconnected the charge is fixed, so changing the separation changes the voltage.',
    'The energy stored is U = ½CV². Pulling the plates apart while they are isolated increases the energy — the extra energy is the mechanical work you do against the attraction between the plates.'
  ],
  formulas: [
    { tex: 'C = \\frac{\\kappa \\epsilon_0 A}{d}', caption: 'Capacitance of a parallel plate capacitor.' },
    { tex: 'Q = CV', caption: 'Charge stored at a potential difference V.' },
    { tex: 'E = \\frac{V}{d} = \\frac{\\sigma}{\\kappa \\epsilon_0}', caption: 'Uniform field between the plates.' },
    { tex: 'U = \\frac{1}{2}CV^2 = \\frac{Q^2}{2C}', caption: 'Energy stored.' },
    { tex: 'u = \\frac{1}{2}\\kappa\\epsilon_0 E^2', caption: 'Energy density of the field.' }
  ],
  variables: [
    { symbol: 'C', name: 'Capacitance', unit: 'F' },
    { symbol: 'A', name: 'Plate area', unit: 'm²' },
    { symbol: 'd', name: 'Separation', unit: 'm' },
    { symbol: '\\kappa', name: 'Relative permittivity', unit: '—' },
    { symbol: 'Q', name: 'Charge on each plate', unit: 'C' },
    { symbol: 'E', name: 'Field between plates', unit: 'V m⁻¹' },
    { symbol: 'U', name: 'Stored energy', unit: 'J' }
  ],
  procedure: [
    'Leave the battery connected and note the capacitance and charge.',
    'Double the plate separation and confirm that the capacitance halves and the charge halves.',
    'Insert a dielectric and confirm that both capacitance and charge rise by the factor κ.',
    'Disconnect the battery, then change the separation and confirm that the charge stays fixed while V changes.',
    'Record a series of readings and check that C is proportional to A and inversely proportional to d.'
  ],
  precautions: [
    'The uniform-field approximation fails near the plate edges (fringing), which this model neglects.',
    'Above the breakdown field of the dielectric (about 3 × 10⁶ V/m for air) a real capacitor would spark.',
    'A capacitor keeps its charge after the battery is removed — discharge it before handling.'
  ],
  tips: [
    'Disconnect the battery and halve the separation: the voltage doubles but the stored energy halves.',
    'Compare air and water at the same voltage — the charge differs by a factor of eighty.'
  ],
  viva: [
    { q: 'Why does inserting a dielectric increase the capacitance?', a: 'The dielectric polarises and its internal field opposes the applied field, so the same charge produces a smaller potential difference, and C = Q/V increases.' },
    { q: 'What stays constant if the battery is disconnected before the plates are moved?', a: 'The charge on the plates.' },
    { q: 'What is the energy density between the plates?', a: 'u = ½κε₀E².' },
    { q: 'What is the field inside the dielectric?', a: 'E = E₀/κ, reduced by the relative permittivity.' },
    { q: 'Define one farad.', a: 'The capacitance of a conductor that stores one coulomb per volt of potential difference.' }
  ],
  resultTemplate: 'The capacitance follows C = κε₀A/d and the stored energy follows U = ½CV² for every setting of the controls.'
};

const kappaOf = (key: string): number => DIELECTRICS.find((d) => d.value === key)?.kappa ?? 1;

function compute(params: ParamValues): ModelOutput {
  const areaCm2 = num(params, 'area', 400);
  const sepMm = num(params, 'sep', 2);
  const voltage = num(params, 'voltage', 100);
  const kappa = kappaOf(String(params.dielectric ?? 'air'));
  const connected = Boolean(params.connected ?? true);

  const area = areaCm2 * 1e-4;
  const sep = sepMm / 1000;
  const r = parallelPlateCapacitor({ area, separation: sep, kappa, voltage });

  const issues: ValidationIssue[] = mergeIssues(
    validatePositive('area', 'Plate area', areaCm2),
    validatePositive('sep', 'Plate separation', sepMm),
    validateRange('voltage', 'Applied voltage', voltage, 0, 500)
  );
  const breakdown = 3e6 / kappa;
  if (r.field > breakdown) {
    issues.push({
      field: 'voltage',
      severity: 'warning',
      message: `Field exceeds the breakdown strength of the dielectric (${formatSI(breakdown, 2)} V/m). A real capacitor would spark.`
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let d = 0.2; d <= 20.001; d += 0.2) {
    const rr = parallelPlateCapacitor({ area, separation: d / 1000, kappa, voltage });
    points.push({ x: d, y: connected ? rr.capacitance * 1e12 : (r.charge / rr.capacitance) });
  }

  return {
    readouts: [
      ro('c', 'Capacitance C', r.capacitance, 'F', 3, { sub: `${(r.capacitance * 1e12).toFixed(2)} pF` }),
      ro('q', 'Charge Q', r.charge, 'C', 3, { sub: `${(r.charge * 1e9).toFixed(2)} nC` }),
      ro('e', 'Field E', r.field, 'V/m', 3, { tone: r.field > breakdown ? 'alert' : 'normal' }),
      ro('u', 'Stored energy U', r.energy, 'J', 3),
      ro('sigma', 'Surface charge density', r.surfaceChargeDensity, 'C/m²', 3),
      ro('uDen', 'Energy density', r.energyDensity, 'J/m³', 3)
    ],
    graph: singleSeriesGraph({
      title: connected ? 'Capacitance against plate separation' : 'Voltage against plate separation (isolated)',
      xLabel: 'd (mm)',
      yLabel: connected ? 'C (pF)' : 'V (V)',
      seriesLabel: connected ? 'C' : 'V',
      points,
      live: { x: sepMm, y: connected ? r.capacitance * 1e12 : voltage },
      yFormat: connected ? (v) => v.toFixed(1) : (v) => v.toFixed(1)
    }),
    description: `A parallel plate capacitor of area ${areaCm2} square centimetres and separation ${sepMm} millimetres with a dielectric of relative permittivity ${kappa}. At ${voltage} volts it stores ${(r.charge * 1e9).toFixed(2)} nanocoulomb and a capacitance of ${(r.capacitance * 1e12).toFixed(2)} picofarad.`,
    result: `C = ${(r.capacitance * 1e12).toFixed(3)} pF, Q = ${(r.charge * 1e9).toFixed(3)} nC, E = ${formatSI(r.field, 3)} V/m and U = ${formatSI(r.energy, 3)} J for A = ${areaCm2} cm², d = ${sepMm} mm and κ = ${kappa}.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const areaCm2 = num(params, 'area', 400);
  const sepMm = num(params, 'sep', 2);
  const voltage = num(params, 'voltage', 100);
  const kappa = kappaOf(String(params.dielectric ?? 'air'));
  const connected = Boolean(params.connected ?? true);
  const r = parallelPlateCapacitor({ area: areaCm2 * 1e-4, separation: sepMm / 1000, kappa, voltage });

  const plateW = 60 + (areaCm2 / 2000) * 220;
  const gap = 26 + (sepMm / 20) * 150;
  const cx = 400;
  const cy = 236;
  const charges = Math.min(Math.round((r.charge * 1e9) / 0.6) + 3, 16);

  return (
    <svg viewBox="0 0 800 480" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <line x1={cx} y1={cy - gap / 2 - 12} x2={cx} y2={cy - gap / 2 - 92} className="lead lead-live" />
      <line x1={cx} y1={cy + gap / 2 + 12} x2={cx} y2={cy + gap / 2 + 92} className="lead lead-live" />
      <BatteryCell x={cx} y={cy + gap / 2 + 132} emf={voltage} live />
      {kappa > 1.001 ? (
        <rect x={cx - plateW / 2} y={cy - gap / 2 + 3} width={plateW} height={gap - 6} fill="#25d0ee" opacity={0.09} stroke="#25d0ee" strokeOpacity={0.35} />
      ) : null}
      <rect x={cx - plateW / 2} y={cy - gap / 2 - 12} width={plateW} height={12} rx={2} fill="url(#lab-plate)" stroke="#5c7085" />
      <rect x={cx - plateW / 2} y={cy + gap / 2} width={plateW} height={12} rx={2} fill="url(#lab-plate)" stroke="#5c7085" />
      {Array.from({ length: charges }, (_, i) => {
        const x = cx - plateW / 2 + 10 + (i * (plateW - 20)) / Math.max(charges - 1, 1);
        return (
          <g key={i}>
            <text x={x} y={cy - gap / 2 - 18} textAnchor="middle" fontSize={12} fill="#ff6b7d" fontWeight={700}>+</text>
            <text x={x} y={cy + gap / 2 + 28} textAnchor="middle" fontSize={13} fill="#5aa9ff" fontWeight={700}>−</text>
          </g>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const x = cx - plateW / 3 + (i * (plateW * 2)) / 6;
        return (
          <line key={i} x1={x} y1={cy - gap / 2 + 6} x2={x} y2={cy + gap / 2 - 6} stroke="#7dd3fc" strokeWidth={1.2} markerEnd="url(#lab-arrow-blue)" opacity={0.6} />
        );
      })}
      <line x1={cx - plateW / 2 - 60} y1={cy - gap / 2 - 6} x2={cx - plateW / 2 - 20} y2={cy - gap / 2 - 6} className="dim-line" />
      <line x1={cx - plateW / 2 - 60} y1={cy + gap / 2 + 6} x2={cx - plateW / 2 - 20} y2={cy + gap / 2 + 6} className="dim-line" />
      <line x1={cx - plateW / 2 - 40} y1={cy - gap / 2 - 6} x2={cx - plateW / 2 - 40} y2={cy + gap / 2 + 6} className="dim-line" />
      <text x={cx - plateW / 2 - 46} y={cy + 4} textAnchor="end" fontSize={10} className="measure-text">
        d = {sepMm.toFixed(1)} mm
      </text>
      <text x={cx + plateW / 2 + 12} y={cy - gap / 2 + 4} fontSize={10} className="measure-text">
        A = {areaCm2} cm²
      </text>
      <text x={400} y={54} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        κ = {kappa} · {DIELECTRICS.find((d) => d.kappa === kappa)?.label.split(' (')[0]}
      </text>
      <text x={400} y={74} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        C = {(r.capacitance * 1e12).toFixed(2)} pF · Q = {(r.charge * 1e9).toFixed(2)} nC · E = {formatSI(r.field, 3)} V/m
      </text>
      <text x={400} y={446} textAnchor="middle" fontSize={10} fill="#5e7189">
        {connected ? 'Battery connected — V is fixed, Q changes with geometry' : 'Battery disconnected — Q is fixed, V changes with geometry'}
      </text>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#8497ad" fontFamily="ui-monospace, monospace">
        ε₀ = {CONSTANTS.EPSILON_0.toExponential(3)} F/m
      </text>
      {/* The plate separation dial and the battery link sit with the capacitor. */}
      <Knob
        spec={control('sep', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={150}
        y={420}
        radius={19}
        label="Plate separation d — turn the micrometer"
      />
      <StageSwitch
        spec={control('connected', 'toggle')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={660}
        y={420}
        label="Battery stays connected"
      />
        </svg>
  );
}

export default function ParallelPlateCapacitorExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const kappa = kappaOf(String(p.dielectric ?? 'air'));
        const r = parallelPlateCapacitor({
          area: num(p, 'area', 400) * 1e-4,
          separation: num(p, 'sep', 2) / 1000,
          kappa,
          voltage: num(p, 'voltage', 100)
        });
        return {
          title: 'Observation table — capacitance against geometry',
          columns: [
            col('a', 'A', 'cm²', 0),
            col('d', 'd', 'mm', 1),
            col('k', 'κ', '—', 3),
            col('c', 'C', 'pF', 3),
            col('q', 'Q', 'nC', 3),
            col('u', 'U', 'nJ', 3)
          ],
          capture: () => ({
            a: num(p, 'area', 400),
            d: num(p, 'sep', 2),
            k: kappa,
            c: r.capacitance * 1e12,
            q: r.charge * 1e9,
            u: r.energy * 1e9
          }),
          captureHint: 'Change area, separation or dielectric before each reading.'
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
