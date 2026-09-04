import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { bohrEnergyEv, bohrRadius, hydrogenLineNm } from '@/physics-engine/quantum';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './bohr-hydrogen-spectrum.meta';

export { meta };

const SERIES = [
  { value: '1', label: 'Lyman (→ n=1, ultraviolet)', nf: 1, color: '#9d8cff' },
  { value: '2', label: 'Balmer (→ n=2, visible)', nf: 2, color: '#5df2b0' },
  { value: '3', label: 'Paschen (→ n=3, infrared)', nf: 3, color: '#ff6b7d' }
];
const MAX_N = 6;

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ff8a5c',
  controls: [
    { kind: 'slider', key: 'n', label: 'Electron orbit', symbol: 'n', min: 1, max: MAX_N, step: 1, initial: 4, hint: 'Principal quantum number of the excited electron', stage: { x: 8, y: 8, length: 24 } },
    { kind: 'select', key: 'series', label: 'Transition falls to', initial: '2', options: SERIES.map((s) => ({ value: s.value, label: s.label })) }
  ],
  defaults: { n: 4, series: '2' }
};

const education: EducationPack = {
  theory: [
    'Bohr proposed that an electron can only occupy certain allowed circular orbits, each with a fixed angular momentum L = nh/2π, n = 1, 2, 3 …. While in an orbit the electron does not radiate, resolving the central objection to Rutherford’s model.',
    'Each orbit has a definite energy Eₙ = −13.6/n² eV for hydrogen. The electron jumps between orbits by absorbing or emitting a single photon whose energy exactly equals the energy difference between the two levels.',
    'A transition from a higher orbit nᵢ to a lower orbit n_f releases a photon of energy hν = Eₙᵢ − Eₙf. Grouping every transition that ends on the same lower orbit gives a spectral series: Lyman (n_f = 1, ultraviolet), Balmer (n_f = 2, mostly visible) and Paschen (n_f = 3, infrared).',
    'The orbit radius grows as n², rₙ = 0.529 Å · n² — the electron in an excited atom sits much further from the nucleus than in the ground state, and is correspondingly more loosely bound.'
  ],
  formulas: [
    { tex: 'E_n = -\\frac{13.6}{n^2}\\,\\text{eV}', caption: 'Energy of the nth Bohr orbit.' },
    { tex: 'r_n = 0.529\\,n^2\\,\\text{Å}', caption: 'Radius of the nth Bohr orbit.' },
    { tex: 'h\\nu = E_{n_i} - E_{n_f}', caption: 'Photon energy released on a downward transition.' },
    { tex: '\\frac{1}{\\lambda} = R\\left(\\frac{1}{n_f^2} - \\frac{1}{n_i^2}\\right)', caption: 'The Rydberg formula for the emitted wavelength.' }
  ],
  variables: [
    { symbol: 'n', name: 'Principal quantum number', unit: '—' },
    { symbol: 'E_n', name: 'Energy of orbit n', unit: 'eV' },
    { symbol: 'r_n', name: 'Radius of orbit n', unit: 'pm' },
    { symbol: '\\lambda', name: 'Emitted wavelength', unit: 'nm' },
    { symbol: 'R', name: 'Rydberg constant', unit: 'm⁻¹', note: '1.097 × 10⁷' }
  ],
  procedure: [
    'Choose the spectral series by picking the orbit the electron falls to (n_f).',
    'Raise the electron to orbit n with the slider and read its energy and radius.',
    'Confirm the electron sits above n_f — below it, no photon is emitted and the meter shows no transition.',
    'Read the transition energy and the emitted wavelength, and note which part of the spectrum it falls in.',
    'Repeat for every n above n_f in turn and tabulate the wavelengths — this is the spectral series for that n_f.'
  ],
  precautions: [
    'A transition needs n strictly greater than n_f; the model shows no emission otherwise.',
    'The Bohr model applies to hydrogen and hydrogen-like single-electron ions only.',
    'Energies are quoted in electron-volts; convert with 1 eV = 1.602 × 10⁻¹⁹ J before using SI formulas elsewhere.'
  ],
  tips: ['The Balmer series is the only one with lines in visible light — that is why it was discovered first, in 1885.'],
  viva: [
    { q: 'State Bohr’s quantisation postulate.', a: 'The angular momentum of the orbiting electron is an integral multiple of h/2π: L = nh/2π.' },
    { q: 'Why does the atom not radiate energy continuously in the Bohr model?', a: 'Because the electron is postulated to move only in certain stationary orbits in which it does not radiate; emission happens only in a jump between orbits.' },
    { q: 'Which series lies in the ultraviolet?', a: 'The Lyman series, every transition that ends on n = 1.' },
    { q: 'What happens to the orbit radius as n increases?', a: 'It grows as n², so higher orbits are much larger and more loosely bound.' },
    { q: 'What is the ionisation energy of hydrogen from the ground state?', a: '13.6 eV, the energy needed to take the electron from n = 1 to n = ∞.' }
  ],
  resultTemplate: 'The photon energy and wavelength emitted on each transition match hν = Eₙᵢ − Eₙf, and transitions grouped by a common n_f reproduce the Lyman, Balmer and Paschen series.'
};

function seriesOf(value: string) {
  return SERIES.find((s) => s.value === value) ?? SERIES[1];
}

function compute(params: ParamValues): ModelOutput {
  const n = Math.max(1, Math.min(MAX_N, Math.round(num(params, 'n', 4))));
  const s = seriesOf(String(params.series ?? '2'));
  const nf = s.nf;
  const emits = n > nf;

  const En = bohrEnergyEv(n);
  const Enf = bohrEnergyEv(nf);
  const rn = bohrRadius(n);
  const deltaEv = emits ? Math.abs(Enf - En) : 0;
  const wavelengthNm = emits ? hydrogenLineNm(n, nf) : 0;

  const points: { x: number; y: number }[] = [];
  for (let k = 1; k <= MAX_N + 2; k += 1) points.push({ x: k, y: bohrEnergyEv(k) });

  return {
    readouts: [
      ro('n', 'Orbit n', n, '', 0),
      ro('en', 'Energy Eₙ', En, 'eV', 3),
      ro('rn', 'Orbit radius rₙ', rn * 1e12, 'pm', 1),
      ro('nf', 'Falls to n_f', nf, '', 0, { sub: s.label.split(' (')[1]?.replace(')', '') }),
      ro('de', 'Photon energy', deltaEv, 'eV', 3, { tone: emits ? 'normal' : 'dim' }),
      ro('wl', 'Wavelength λ', wavelengthNm, 'nm', 1, { tone: emits ? 'normal' : 'dim' }),
      ro('state', 'Transition', emits ? 1 : 0, '', 0, { text: emits ? 'EMITTING' : 'NO TRANSITION', tone: emits ? 'normal' : 'alert' })
    ],
    graph: singleSeriesGraph({
      title: 'Bohr energy levels', xLabel: 'n', yLabel: 'Eₙ (eV)',
      seriesLabel: 'Eₙ', color: '#ff8a5c', points, live: { x: n, y: En },
      guides: [{ axis: 'y', value: Enf, label: `n_f = ${nf}`, color: s.color }]
    }),
    description: emits
      ? `The electron falls from orbit n = ${n} (Eₙ = ${En.toFixed(2)} eV) to n_f = ${nf} (E = ${Enf.toFixed(2)} eV), releasing a photon of energy ${deltaEv.toFixed(3)} eV in the ${s.label.split(' (')[0]} series.`
      : `Orbit n = ${n} is not above n_f = ${nf}, so there is nothing to fall from — no photon is emitted for this pair.`,
    result: emits
      ? `Transition n = ${n} → n_f = ${nf}: ΔE = ${deltaEv.toFixed(3)} eV, λ = ${formatSI(wavelengthNm * 1e-9, 3)}m (${wavelengthNm.toFixed(1)} nm), in the ${s.label.split(' (')[0]} series.`
      : `Pick n > n_f to see an emission — the electron must start in a higher orbit than the one it falls to.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const n = Math.max(1, Math.min(MAX_N, Math.round(num(params, 'n', 4))));
  const s = seriesOf(String(params.series ?? '2'));
  const nf = s.nf;
  const emits = n > nf;

  const cx = 300;
  const cy = 250;
  const orbitGap = 26;
  const radiusFor = (k: number) => 30 + k * orbitGap;

  return (
    <svg viewBox="0 0 600 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={300} y={30} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {emits ? `n = ${n} → n_f = ${nf} — ${s.label.split(' (')[0]} series` : `n = ${n} — pick n_f below this orbit to emit`}
      </text>

      {Array.from({ length: MAX_N }, (_, i) => i + 1).map((k) => (
        <circle
          key={k}
          cx={cx}
          cy={cy}
          r={radiusFor(k)}
          fill="none"
          stroke={k === n ? '#ff8a5c' : k === nf ? s.color : '#26374a'}
          strokeWidth={k === n || k === nf ? 2 : 1}
          strokeDasharray={k === n || k === nf ? undefined : '2 4'}
          opacity={k === n || k === nf ? 0.9 : 0.5}
        />
      ))}
      {Array.from({ length: MAX_N }, (_, i) => i + 1).map((k) => (
        <text key={`lbl${k}`} x={cx + radiusFor(k) + 4} y={cy - 4} fontSize={9} fill="#5e7189">
          n={k}
        </text>
      ))}

      {/* Nucleus. */}
      <circle cx={cx} cy={cy} r={9} fill="url(#lab-brass)" stroke="#8a6522" />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={7} fontWeight={700} fill="#2c1d05">
        p
      </text>

      {/* Electron on orbit n. */}
      <circle cx={cx + radiusFor(n)} cy={cy} r={6} fill="#5aa9ff" stroke="#cfe4ff" strokeWidth={1.2} />

      {/* Emitted photon, drawn as a wavy arrow from orbit n inward to orbit n_f. */}
      {emits ? (
        <g>
          <path
            d={`M${cx + radiusFor(n) - 6} ${cy - 8} q-10 -14 -20 0 q-10 14 -20 0 q-10 -14 -20 0 q-10 14 -20 0 L${cx + radiusFor(nf) + 4} ${cy - 8}`}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <polygon
            points={`${cx + radiusFor(nf)},${cy - 8} ${cx + radiusFor(nf) + 10},${cy - 14} ${cx + radiusFor(nf) + 10},${cy - 2}`}
            fill={s.color}
            transform={`rotate(180 ${cx + radiusFor(nf)} ${cy - 8})`}
          />
          <text x={cx} y={cy - radiusFor(n) - 12} textAnchor="middle" fontSize={10} fill={s.color} fontFamily="ui-monospace, monospace">
            hν = {(Math.abs(bohrEnergyEv(n) - bohrEnergyEv(nf))).toFixed(2)} eV
          </text>
        </g>
      ) : null}

      <Knob
        spec={control('n', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={80}
        y={420}
        radius={20}
        label="Electron orbit n — turn to excite the atom"
      />
    </svg>
  );
}

export default function BohrHydrogenSpectrumExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const n = Math.max(1, Math.min(MAX_N, Math.round(num(p, 'n', 4))));
        const s = seriesOf(String(p.series ?? '2'));
        const emits = n > s.nf;
        const deltaEv = emits ? Math.abs(bohrEnergyEv(n) - bohrEnergyEv(s.nf)) : 0;
        const wavelengthNm = emits ? hydrogenLineNm(n, s.nf) : 0;
        return {
          title: 'Observation table — the hydrogen spectral series',
          columns: [
            col('n', 'n', '', 0),
            col('nf', 'n_f', '', 0),
            col('en', 'Eₙ', 'eV', 3),
            col('de', 'ΔE', 'eV', 3),
            col('wl', 'λ', 'nm', 1)
          ],
          capture: () => ({ n, nf: s.nf, en: bohrEnergyEv(n), de: deltaEv, wl: wavelengthNm }),
          comparison: { label: 'Rydberg constant R (from 1/λ)', unit: '×10⁷ m⁻¹', experimental: 1.097, theoretical: 1.097, precision: 3 },
          captureHint: 'Change the orbit n, then record the transition.'
        };
      }}
    />
  );
}

export { definition, education };
