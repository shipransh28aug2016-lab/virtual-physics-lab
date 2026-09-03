import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { CONSTANTS } from '@/physics-engine/constants';
import { cageShielding, skinDepth } from '@/physics-engine/electrostatics';
import { formatSI } from '@/utils/format';
import { num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './faraday-cage.meta';

export { meta };

/** Annealed copper at 20 °C. The shell material is fixed; thickness is the variable. */
const COPPER_CONDUCTIVITY = 5.8e7; // S/m
/** Attenuation is reported up to this ceiling so the display stays finite. */
const MAX_ATTENUATION_DB = 200;

const cageLeak = (params: ParamValues): number =>
  cageShielding(
    num(params, 'freq', 1e6),
    COPPER_CONDUCTIVITY,
    num(params, 'thickness', 0.5) / 1000,
    num(params, 'hole', 5) / 1000
  );

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#9d8cff',
  controls: [
    { kind: 'slider', key: 'eExt', label: 'External field', symbol: 'E_0', unit: 'kV/m', min: 0, max: 500, step: 5, initial: 100 },
    { kind: 'slider', key: 'freq', label: 'Field frequency', symbol: 'f', unit: 'Hz', min: 1, max: 1e9, step: 1, initial: 1e6, scale: 'log', hint: '0 Hz equivalent: set 1 Hz and read the static result' },
    { kind: 'slider', key: 'thickness', label: 'Shell thickness', symbol: 't', unit: 'mm', min: 0.01, max: 5, step: 0.01, initial: 0.5, precision: 2 },
    { kind: 'slider', key: 'hole', label: 'Mesh hole size', symbol: 'a', unit: 'mm', min: 0.5, max: 40, step: 0.5, initial: 5, precision: 1, hint: 'Apertures leak below their cut-off frequency c/2a' }
  ],
  defaults: { eExt: 100, freq: 1e6, thickness: 0.5, hole: 5 }
};

const education: EducationPack = {
  theory: [
    'When a conductor is placed in an external electric field, its free charges move until they reach equilibrium. In equilibrium the field inside the conducting material must be zero, otherwise the charges would still be moving.',
    'The charges therefore pile up on the outer surface in exactly the distribution needed to cancel the external field everywhere inside the cavity. This is electrostatic shielding, and a closed conducting shell is called a Faraday cage.',
    'The result follows from Gauss’s law: any Gaussian surface drawn entirely inside the conducting material encloses no net charge, so the flux through it is zero, and by symmetry of a cavity the field inside vanishes.',
    'A real cage is a mesh, and it is being used against a field that varies in time. Two things then decide how much gets through: how deep the field penetrates the metal itself (the skin depth δ, which shrinks as 1/√f), and how big the holes are compared with the wavelength (an aperture behaves like a waveguide that is cut off below c/2a).',
    'At DC the two mechanisms disappear in opposite directions: a closed shell shields perfectly whatever its thickness, while any hole at all leaks freely, because a static field has no wavelength to be cut off.'
  ],
  formulas: [
    { tex: '\\vec{E}_{inside} = 0', caption: 'Field inside a closed conducting shell in electrostatic equilibrium.' },
    { tex: '\\oint \\vec{E} \\cdot d\\vec{A} = \\frac{q_{enc}}{\\epsilon_0}', caption: 'Gauss’s law — the basis of the shielding result.' },
    { tex: '\\delta = \\sqrt{\\frac{2}{\\omega \\mu \\sigma}}', caption: 'Skin depth in the shell metal; copper at 1 MHz gives δ ≈ 66 µm.' },
    { tex: '\\frac{E_{in}}{E_0} = \\max\\left(e^{-t/\\delta},\\; e^{-\\pi t / a}\\right)', caption: 'Leakage through the metal and through the mesh apertures; the weaker of the two paths dominates.' },
    { tex: 'f_{cut} = \\frac{c}{2a}', caption: 'Cut-off frequency of a mesh aperture of width a — above it the mesh stops working.' }
  ],
  variables: [
    { symbol: 'E_0', name: 'External field', unit: 'V m⁻¹' },
    { symbol: 'f', name: 'Field frequency', unit: 'Hz' },
    { symbol: 't', name: 'Shell thickness', unit: 'm' },
    { symbol: 'a', name: 'Mesh hole size', unit: 'm' },
    { symbol: '\\delta', name: 'Skin depth', unit: 'm' },
    { symbol: '\\sigma', name: 'Conductivity of copper', unit: 'S m⁻¹', note: 'Fixed at 5.8 × 10⁷' }
  ],
  procedure: [
    'Set the frequency to 1 Hz and confirm that the interior field reads essentially zero.',
    'Raise the frequency to 1 GHz and read the new interior field and the shielding in dB.',
    'Reduce the mesh hole size to 1 mm and note how much the attenuation improves.',
    'Thin the shell to 0.05 mm at 1 GHz and observe the shielding fall as the thickness approaches the skin depth.',
    'Sweep the frequency across the whole range and record the shielding at each decade.'
  ],
  precautions: [
    'Shielding a static field needs a closed shell; thickness is irrelevant there, holes are fatal.',
    'A person inside a cage is protected from the field but not from current flowing through the shell if it is struck.',
    'The aperture model assumes square holes in a thin sheet and ignores resonance near the cut-off frequency.',
    'Attenuation beyond about 200 dB is a measurement limit in practice, not a physical one; the readout is capped there.'
  ],
  tips: [
    'A car body acts as a crude Faraday cage during a lightning strike — the current flows through the shell, not the interior.',
    'The mesh on a microwave oven door is cut off at 2.45 GHz, which is why you can see in but the radiation stays out.'
  ],
  viva: [
    { q: 'Why is the field inside a conductor zero in electrostatics?', a: 'Free charges move until the internal field is cancelled; any residual field would keep them moving.' },
    { q: 'Where does the charge on a conductor reside?', a: 'Entirely on its outer surface, with the density greatest where the curvature is greatest.' },
    { q: 'Does a Faraday cage work for a mobile phone signal?', a: 'Only if the mesh is much finer than the wavelength. At 1.8 GHz the wavelength is 17 cm, so a 5 mm mesh still gives tens of dB; a coarse mesh lets it through.' },
    { q: 'What happens to the skin depth as the frequency rises?', a: 'It falls as 1/√f, so high-frequency fields are confined to a thinner surface layer and are shielded more easily by the metal.' },
    { q: 'State Gauss’s law.', a: 'The total flux of the electric field through a closed surface equals the enclosed charge divided by ε₀.' }
  ],
  resultTemplate: 'A closed conducting shell reduces a static interior field to zero, confirming electrostatic shielding; for a meshed shell the shielding is limited by skin depth and aperture cut-off.'
};

function compute(params: ParamValues): ModelOutput {
  const eExt = num(params, 'eExt', 100) * 1000;
  const freq = num(params, 'freq', 1e6);
  const thickness = num(params, 'thickness', 0.5) / 1000;
  const hole = num(params, 'hole', 5) / 1000;

  const delta = skinDepth(freq, COPPER_CONDUCTIVITY);
  const leak = cageShielding(freq, COPPER_CONDUCTIVITY, thickness, hole);
  const eIn = eExt * leak;
  const cutOff = CONSTANTS.C_LIGHT / (2 * hole);
  const attenuation = leak > 0 ? Math.min(MAX_ATTENUATION_DB, 20 * Math.log10(1 / leak)) : MAX_ATTENUATION_DB;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= 100; i += 1) {
    const f = 1 + (i / 100) * (1e9 - 1);
    const l = cageShielding(f, COPPER_CONDUCTIVITY, thickness, hole);
    points.push({ x: f, y: l > 0 ? Math.min(MAX_ATTENUATION_DB, 20 * Math.log10(1 / l)) : MAX_ATTENUATION_DB });
  }

  const issues = [];
  if (freq > cutOff) {
    issues.push({
      field: 'hole',
      severity: 'warning' as const,
      message: `The field is above the mesh cut-off f_c = c/2a = ${formatSI(cutOff, 3)} Hz, so the apertures radiate rather than evanesce. Fine the mesh to restore shielding.`
    });
  }
  if (Number.isFinite(delta) && thickness < delta) {
    issues.push({
      field: 'thickness',
      severity: 'warning' as const,
      message: `The shell is thinner than one skin depth (δ = ${formatSI(delta, 3)} m at ${formatSI(freq, 3)} Hz), so most of the field passes straight through the metal.`
    });
  }

  return {
    readouts: [
      ro('eIn', 'Field inside', eIn, 'V/m', 3, { tone: eIn < eExt * 1e-6 ? 'normal' : 'alert' }),
      ro('eOut', 'Field outside', eExt, 'V/m', 3),
      ro('atten', 'Shielding', attenuation, 'dB', 1, { tone: attenuation >= 60 ? 'normal' : 'alert', sub: `${(attenuation / 20).toFixed(1)} decades` }),
      ro('shield', 'Shielding', eExt > 0 ? (1 - eIn / eExt) * 100 : 0, '%', 3),
      ro('delta', 'Skin depth δ', Number.isFinite(delta) ? delta : 0, 'm', 3, { sub: Number.isFinite(delta) ? `t/δ = ${(thickness / delta).toFixed(2)}` : 'static field' }),
      ro('fcut', 'Mesh cut-off f_c', cutOff, 'Hz', 3, { tone: freq > cutOff ? 'alert' : 'normal', sub: freq > cutOff ? 'above cut-off' : 'below cut-off' })
    ],
    graph: singleSeriesGraph({
      title: 'Shielding against frequency', xLabel: 'frequency (Hz)', yLabel: 'shielding (dB)',
      seriesLabel: 'Shielding', color: '#9d8cff', points, live: { x: freq, y: attenuation }
    }),
    live: { x: freq, y: attenuation },
    description: `A copper mesh shell ${(thickness * 1000).toFixed(2)} mm thick with ${(hole * 1000).toFixed(1)} mm holes sits in a ${formatSI(eExt, 3)} V/m field oscillating at ${formatSI(freq, 3)} Hz. The skin depth is ${Number.isFinite(delta) ? formatSI(delta, 3) : 'undefined'} m and the field inside is ${formatSI(eIn, 3)} V/m.`,
    result: freq > cutOff
      ? `At ${formatSI(freq, 3)} Hz the field is above the mesh cut-off of ${formatSI(cutOff, 3)} Hz, so the apertures pass the field: ${formatSI(eIn, 3)} V/m inside, only ${attenuation.toFixed(1)} dB of shielding.`
      : `The mesh is below cut-off and the shell is ${(thickness / (Number.isFinite(delta) ? delta : 1)).toFixed(1)} skin depths thick, so the interior field is ${formatSI(eIn, 3)} V/m — ${attenuation.toFixed(1)} dB of shielding against the ${formatSI(eExt, 3)} V/m applied.`,
    issues
  };
}

function Stage({ params, set, control }: StageApi) {
  const eExt = num(params, 'eExt', 100);
  const freq = num(params, 'freq', 1e6);
  const thickness = num(params, 'thickness', 0.5);
  const hole = num(params, 'hole', 5);
  const eIn = eExt * 1000 * cageLeak(params);
  const r = 120;
  // Hole size sets the mesh pitch on the drawing, so the aperture term is visible.
  const pitch = 6 + hole * 1.4;
  const cells = Math.max(12, Math.round((2 * Math.PI * r) / pitch));
  const gapFrac = Math.min(0.72, hole / (hole + 3));
  return (
    <svg viewBox="0 0 800 480" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1={40 + i * 54} y1={40} x2={40 + i * 54} y2={440} stroke="#7dd3fc" strokeWidth={1.4} markerEnd="url(#lab-arrow-blue)" opacity={0.4} />
      ))}
      <g>
        {Array.from({ length: cells }, (_, i) => {
          const a0 = (i / cells) * Math.PI * 2;
          const a1 = a0 + ((Math.PI * 2) / cells) * (1 - gapFrac);
          const x0 = 400 + r * Math.cos(a0);
          const y0 = 240 + r * Math.sin(a0);
          const x1 = 400 + r * Math.cos(a1);
          const y1 = 240 + r * Math.sin(a1);
          return <path key={i} d={`M${x0} ${y0} L${x1} ${y1}`} stroke="url(#lab-metal)" strokeWidth={Math.max(thickness * 4, 3)} strokeLinecap="round" />;
        })}
      </g>
      <circle cx={400} cy={240} r={r - 26} fill="#0b121c" opacity={0.55} />
      <text x={400} y={228} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        E inside
      </text>
      <text x={400} y={250} textAnchor="middle" fontSize={14} fill="#25d0ee" fontFamily="ui-monospace, monospace">
        {formatSI(eIn, 3)} V/m
      </text>
      <text x={400} y={270} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        {formatSI(freq, 3)} Hz
      </text>
      <text x={400} y={54} textAnchor="middle" fontSize={12} fill="#8497ad">
        External field E₀ = {eExt.toFixed(0)} kV/m
      </text>
      <text x={400} y={440} textAnchor="middle" fontSize={11} fill="#8497ad">
        Mesh pitch {(hole * 1.0).toFixed(1)} mm · shell {thickness.toFixed(2)} mm
      </text>
      {/* The signal generator that drives the external field. */}
      <Knob
        spec={control('freq', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={130}
        y={430}
        radius={19}
        label="Field frequency f — turn the generator"
      />
        </svg>
  );
}

export default function FaradayCageExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const eExt = num(p, 'eExt', 100) * 1000;
        const leak = cageLeak(p);
        return {
          title: 'Observation table — shielding against frequency',
          columns: [
            { key: 'f', label: 'Frequency', unit: 'Hz', precision: 3 },
            { key: 't', label: 'Thickness', unit: 'mm', precision: 2 },
            { key: 'a', label: 'Hole size', unit: 'mm', precision: 1 },
            { key: 'ein', label: 'E inside', unit: 'V/m', precision: 4 },
            { key: 'sh', label: 'Shielding', unit: '%', precision: 2, derived: true }
          ],
          capture: () => ({
            f: num(p, 'freq', 1e6),
            t: num(p, 'thickness', 0.5),
            a: num(p, 'hole', 5),
            ein: eExt * leak,
            sh: 0
          }),
          derive: (row) => ({ ...row, sh: eExt > 0 ? (1 - Number(row.ein) / eExt) * 100 : 0 })
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
