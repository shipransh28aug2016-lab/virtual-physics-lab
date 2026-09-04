import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { CONSTANTS, HC_EV_NM } from '@/physics-engine/constants';
import { wavelengthToRgb } from '@/physics-engine/optics';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './em-spectrum-explorer.meta';

export { meta };

const LOG_MIN = -12;
const LOG_MAX = 3;
const LOG_INITIAL = Math.log10(550e-9);

interface Band {
  name: string;
  maxLambda: number;
  color: string;
  use: string;
}

/** Bands in ascending order of wavelength; each entry's `maxLambda` is its upper edge in metres. */
const BANDS: Band[] = [
  { name: 'Gamma ray', maxLambda: 1e-11, color: '#c26bff', use: 'nuclear decay, radiotherapy' },
  { name: 'X-ray', maxLambda: 1e-8, color: '#9d8cff', use: 'medical and crystallography imaging' },
  { name: 'Ultraviolet', maxLambda: 4e-7, color: '#7dd3fc', use: 'sterilisation, causes sunburn' },
  { name: 'Visible light', maxLambda: 7e-7, color: '#5df2b0', use: 'human vision' },
  { name: 'Infrared', maxLambda: 1e-3, color: '#ffc65c', use: 'remote controls, thermal imaging' },
  { name: 'Microwave', maxLambda: 1e-1, color: '#ffb454', use: 'radar, microwave ovens, mobile data' },
  { name: 'Radio wave', maxLambda: Number.POSITIVE_INFINITY, color: '#ff6b7d', use: 'broadcast and communication' }
];

const bandOf = (lambdaM: number): Band => BANDS.find((b) => lambdaM < b.maxLambda) ?? BANDS[BANDS.length - 1];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#45d68b',
  controls: [
    { kind: 'slider', key: 'logLambda', label: 'Wavelength (power of ten)', symbol: '\\log_{10}\\lambda', min: LOG_MIN, max: LOG_MAX, step: 0.01, initial: LOG_INITIAL, precision: 2, hint: 'Slides the whole electromagnetic spectrum, gamma rays to radio waves', stage: { x: 8, y: 8, length: 40 } }
  ],
  defaults: { logLambda: LOG_INITIAL }
};

const education: EducationPack = {
  theory: [
    'Maxwell showed that an accelerating charge radiates energy as coupled, mutually perpendicular electric and magnetic fields that travel through vacuum at the speed of light c. This is an electromagnetic wave — the same phenomenon whether it is a radio signal, visible light or a gamma ray.',
    'Every electromagnetic wave obeys c = νλ: wavelength and frequency are inversely related, and both fix the wave completely once c is known. The whole electromagnetic spectrum — radio, microwave, infrared, visible, ultraviolet, X-ray and gamma ray — is one family distinguished only by wavelength.',
    'Quantum mechanically, the wave also carries energy in discrete photons of energy E = hν = hc/λ. Shorter wavelength means higher frequency and higher photon energy — which is why X-rays and gamma rays are ionising and dangerous, while radio waves are not.',
    'No sharp boundary separates one band from the next; the named ranges are a convention based on how the radiation is produced and detected, not a physical discontinuity.'
  ],
  formulas: [
    { tex: 'c = \\nu\\lambda', caption: 'Wave equation relating speed, frequency and wavelength.' },
    { tex: 'E = h\\nu = \\frac{hc}{\\lambda}', caption: 'Photon energy from frequency or wavelength.' },
    { tex: 'T = \\frac{1}{\\nu}', caption: 'Period of one oscillation.' }
  ],
  variables: [
    { symbol: '\\lambda', name: 'Wavelength', unit: 'm' },
    { symbol: '\\nu', name: 'Frequency', unit: 'Hz' },
    { symbol: 'E', name: 'Photon energy', unit: 'eV' },
    { symbol: 'c', name: 'Speed of light', unit: 'm/s', note: '2.998 × 10⁸' },
    { symbol: 'T', name: 'Period', unit: 's' }
  ],
  procedure: [
    'Slide across the full range and note which band the wavelength falls into at each extreme.',
    'Set the wavelength to about 550 nm and confirm it reads as visible light — this is the middle of what the human eye detects.',
    'Move towards shorter wavelengths and watch the frequency and photon energy both rise.',
    'Move towards longer wavelengths and watch the same two quantities fall.',
    'Record the wavelength, frequency and photon energy at the edge of each band and tabulate them.'
  ],
  precautions: [
    'Wavelength and frequency always move oppositely — if both appear to rise together, recheck the reading.',
    'Photon energy is quoted in electron-volts here; convert with 1 eV = 1.602 × 10⁻¹⁹ J to use it in SI formulas.',
    'Band boundaries are conventional, not exact — a wavelength near an edge may be described as either neighbouring band in different texts.'
  ],
  tips: ['Displacement current, not just conduction current, is what makes Ampère’s law consistent for a charging capacitor — that missing piece is what let Maxwell predict this whole spectrum as one phenomenon.'],
  viva: [
    { q: 'State the relation between the speed, frequency and wavelength of an electromagnetic wave.', a: 'c = νλ — the speed of light equals the frequency times the wavelength, for every band of the spectrum.' },
    { q: 'Why are X-rays more penetrating than visible light?', a: 'Their much shorter wavelength gives each photon far more energy, so they interact less with matter and penetrate further.' },
    { q: 'What did Maxwell add to Ampère’s circuital law to predict electromagnetic waves?', a: 'The displacement current, ε₀ dΦ_E/dt, needed so the law stays consistent even where no conduction current flows, as between capacitor plates.' },
    { q: 'Do electromagnetic waves need a medium to travel?', a: 'No — unlike sound, they are self-sustaining oscillations of the electric and magnetic fields and travel through vacuum.' },
    { q: 'Which part of the spectrum has the highest photon energy?', a: 'Gamma rays — the shortest wavelength and so the highest frequency and photon energy of any band.' }
  ],
  resultTemplate: 'Across the whole spectrum, frequency and photon energy rise exactly as wavelength falls, consistent with c = νλ and E = hc/λ, with no discontinuity at any named band boundary.'
};

function compute(params: ParamValues): ModelOutput {
  const logLambda = Math.max(LOG_MIN, Math.min(LOG_MAX, num(params, 'logLambda', LOG_INITIAL)));
  const lambdaM = 10 ** logLambda;
  const freq = CONSTANTS.C_LIGHT / lambdaM;
  const energyEv = HC_EV_NM / (lambdaM * 1e9);
  const period = 1 / freq;
  const band = bandOf(lambdaM);

  const points: { x: number; y: number }[] = [];
  for (let l = LOG_MIN; l <= LOG_MAX; l += 0.3) {
    const lm = 10 ** l;
    points.push({ x: l, y: HC_EV_NM / (lm * 1e9) });
  }

  return {
    readouts: [
      ro('lambda', 'Wavelength λ', lambdaM, 'm', 4),
      ro('freq', 'Frequency ν', freq, 'Hz', 4),
      ro('e', 'Photon energy E', energyEv, 'eV', 4),
      ro('t', 'Period T', period, 's', 4),
      ro('band', 'Band', 0, '', 0, { text: band.name.toUpperCase(), tone: 'normal' })
    ],
    graph: singleSeriesGraph({
      title: 'Photon energy across the spectrum', xLabel: 'log₁₀ λ (m)', yLabel: 'E (eV)',
      seriesLabel: 'E', color: band.color, points, live: { x: logLambda, y: energyEv }
    }),
    description: `A wavelength of ${formatSI(lambdaM, 3)}m falls in the ${band.name} band (${band.use}), with frequency ${formatSI(freq, 3)}Hz and photon energy ${formatSI(energyEv, 3)}eV.`,
    result: `λ = ${formatSI(lambdaM, 3)}m, ν = ${formatSI(freq, 3)}Hz, E = ${formatSI(energyEv, 3)}eV — the ${band.name} band. c = νλ = ${formatSI(freq * lambdaM, 4)} m/s, matching the speed of light.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const logLambda = Math.max(LOG_MIN, Math.min(LOG_MAX, num(params, 'logLambda', LOG_INITIAL)));
  const lambdaM = 10 ** logLambda;
  const band = bandOf(lambdaM);
  const fraction = (logLambda - LOG_MIN) / (LOG_MAX - LOG_MIN);

  const barX = 40;
  const barW = 660;
  const barY = 120;
  const markerX = barX + fraction * barW;

  const visibleColor =
    lambdaM >= 380e-9 && lambdaM <= 780e-9
      ? (() => {
          const rgb = wavelengthToRgb(lambdaM * 1e9);
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        })()
      : band.color;

  const pathRef = useRef<SVGPathElement>(null);
  const t0 = useRef(performance.now());
  // Illustrative only — the drawn wave is not to physical scale, or nothing on
  // screen would be visible across twelve decades of wavelength. Shorter
  // (higher-energy) wavelengths simply pack more visual cycles into the band.
  const visualCycles = 2 + (1 - fraction) * 7;

  useEffect(() => {
    let raf = 0;
    const width = 600;
    const amp = 26;
    const frame = (now: number): void => {
      const t = (now - t0.current) / 1000;
      const pts: string[] = [];
      for (let i = 0; i <= 120; i += 1) {
        const x = 60 + (i / 120) * width;
        const phase = (i / 120) * visualCycles * Math.PI * 2 - t * 3;
        pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(230 - Math.sin(phase) * amp).toFixed(1)}`);
      }
      if (pathRef.current) pathRef.current.setAttribute('d', pts.join(' '));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [visualCycles]);

  return (
    <svg viewBox="0 0 740 360" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={370} y={28} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {band.name} — λ = {formatSI(lambdaM, 3)}m
      </text>
      <text x={370} y={46} textAnchor="middle" fontSize={10} fill="#8497ad">
        used for {band.use}
      </text>

      {/* The spectrum bar, one segment per band, spanning the log-wavelength slider range. */}
      {BANDS.map((b, i) => {
        const prevMax = i === 0 ? LOG_MIN : Math.log10(BANDS[i - 1].maxLambda);
        const thisMax = Number.isFinite(b.maxLambda) ? Math.log10(b.maxLambda) : LOG_MAX;
        const x0 = barX + ((Math.max(prevMax, LOG_MIN) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * barW;
        const x1 = barX + ((Math.min(thisMax, LOG_MAX) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * barW;
        return <rect key={b.name} x={x0} y={barY} width={Math.max(1, x1 - x0)} height={22} fill={b.color} opacity={b.name === band.name ? 0.95 : 0.35} />;
      })}
      <rect x={barX} y={barY} width={barW} height={22} fill="none" stroke="#293a4e" strokeWidth={1} />
      <polygon points={`${markerX - 6},${barY - 10} ${markerX + 6},${barY - 10} ${markerX},${barY - 1}`} fill="#eaf1f8" />
      <text x={barX} y={barY + 38} fontSize={9} fill="#5e7189">
        shorter · higher energy
      </text>
      <text x={barX + barW} y={barY + 38} fontSize={9} fill="#5e7189" textAnchor="end">
        longer · lower energy
      </text>

      {/* Illustrative transverse wave — not to scale. */}
      <rect x={40} y={170} width={660} height={130} rx={10} fill="#0d1621" stroke="#26374a" />
      <line x1={60} y1={230} x2={660} y2={230} stroke="#26374a" strokeWidth={1} />
      <path ref={pathRef} d="" fill="none" stroke={visibleColor} strokeWidth={2.4} strokeLinecap="round" />
      <text x={370} y={286} textAnchor="middle" fontSize={9} fill="#5e7189">
        transverse E-field oscillation — illustrative, not to scale
      </text>

      <Knob
        spec={control('logLambda', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={80}
        y={318}
        radius={18}
        label="Wavelength across the spectrum"
      />
    </svg>
  );
}

export default function EmSpectrumExplorerExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const logLambda = Math.max(LOG_MIN, Math.min(LOG_MAX, num(p, 'logLambda', LOG_INITIAL)));
        const lambdaM = 10 ** logLambda;
        const freq = CONSTANTS.C_LIGHT / lambdaM;
        const energyEv = HC_EV_NM / (lambdaM * 1e9);
        return {
          title: 'Observation table — the electromagnetic spectrum',
          columns: [
            col('l', 'λ', 'm', 4),
            col('f', 'ν', 'Hz', 4),
            col('e', 'E', 'eV', 4)
          ],
          capture: () => ({ l: lambdaM, f: freq, e: energyEv }),
          comparison: { label: 'Speed of light c = νλ', unit: '×10⁸ m/s', experimental: (freq * lambdaM) / 1e8, theoretical: CONSTANTS.C_LIGHT / 1e8, precision: 4 },
          captureHint: 'Move the wavelength slider, then record the reading.'
        };
      }}
    />
  );
}

export { definition, education };
