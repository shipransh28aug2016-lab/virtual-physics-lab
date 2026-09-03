import { useEffect, useRef } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { MeterFace } from '@/components/instruments/Instruments';
import { photoelectricEffect } from '@/physics-engine/quantum';
import { CONSTANTS, HC_EV_NM } from '@/physics-engine/constants';
import { wavelengthToRgb } from '@/physics-engine/optics';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './photoelectric-effect.meta';

export { meta };

const METALS = [
  { value: 'cs', label: 'Caesium (φ = 2.14 eV)', phi: 2.14 },
  { value: 'na', label: 'Sodium (φ = 2.28 eV)', phi: 2.28 },
  { value: 'ca', label: 'Calcium (φ = 2.87 eV)', phi: 2.87 },
  { value: 'zn', label: 'Zinc (φ = 4.30 eV)', phi: 4.3 },
  { value: 'pt', label: 'Platinum (φ = 5.65 eV)', phi: 5.65 }
];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ffc65c',
  controls: [
    { kind: 'slider', key: 'lambda', label: 'Wavelength of light', symbol: '\\lambda', unit: 'nm', min: 150, max: 800, step: 1, initial: 400, hint: 'Below 380 nm is ultraviolet', stage: { x: 3, y: 7, length: 20 } },
    { kind: 'slider', key: 'intensity', label: 'Light intensity', symbol: 'I', unit: 'a.u.', min: 0, max: 10, step: 0.1, initial: 5, precision: 1 },
    { kind: 'select', key: 'metal', label: 'Emitter surface', initial: 'na', options: METALS },
    { kind: 'slider', key: 'v', label: 'Collector potential', symbol: 'V', unit: 'V', min: -8, max: 4, step: 0.05, initial: 0, hint: 'Negative retards the electrons', stage: { x: 74, y: 7, length: 22 } }
  ],
  defaults: { lambda: 400, intensity: 5, metal: 'na', v: 0 },
};

const education: EducationPack = {
  theory: [
    'When light of sufficiently high frequency falls on a metal surface, electrons are ejected. Wave theory predicts that the energy should accumulate with intensity and that any frequency should eventually work; experiment contradicts both.',
    'Einstein resolved this in 1905 by treating light as a stream of quanta of energy hν. A single photon gives all of its energy to a single electron. Part of that energy, the work function φ, is spent freeing the electron from the metal; the rest appears as kinetic energy.',
    'This explains the three key observations: emission is instantaneous, there is a threshold frequency below which nothing is emitted however bright the light, and the maximum kinetic energy depends only on frequency, never on intensity.',
    'Intensity changes only the number of photons and therefore the number of electrons, which is why the photocurrent scales with intensity while the stopping potential does not move.'
  ],
  formulas: [
    { tex: 'h\\nu = \\phi + K_{max}', caption: 'Einstein’s photoelectric equation.' },
    { tex: 'K_{max} = e V_0', caption: 'Stopping potential measures the maximum kinetic energy.' },
    { tex: '\\nu_0 = \\frac{\\phi}{h}', caption: 'Threshold frequency.' },
    { tex: 'V_0 = \\frac{h}{e}\\nu - \\frac{\\phi}{e}', caption: 'A straight line whose slope gives h/e.' }
  ],
  variables: [
    { symbol: 'h', name: 'Planck constant', unit: 'J s', note: '6.626 × 10⁻³⁴' },
    { symbol: '\\nu', name: 'Frequency', unit: 'Hz' },
    { symbol: '\\phi', name: 'Work function', unit: 'eV' },
    { symbol: 'K_{max}', name: 'Maximum kinetic energy', unit: 'eV' },
    { symbol: 'V_0', name: 'Stopping potential', unit: 'V' },
    { symbol: '\\nu_0', name: 'Threshold frequency', unit: 'Hz' }
  ],
  procedure: [
    'Choose the emitter metal and note its work function.',
    'Set the wavelength well above the threshold and confirm that no current flows.',
    'Reduce the wavelength until emission starts and note the threshold wavelength.',
    'For several wavelengths, make the collector potential negative until the current falls to zero; that is the stopping potential.',
    'Plot V₀ against frequency; the slope is h/e and the intercept gives φ/e.'
  ],
  precautions: ['The surface must be clean; oxidation raises the work function.', 'Use a monochromatic source — a broad spectrum smears the threshold.', 'Allow the tube to reach a steady photocurrent before reading.'],
  tips: ['Change the intensity with everything else fixed: the current scales but the stopping potential does not move at all.'],
  viva: [
    { q: 'Define work function.', a: 'The minimum energy needed to remove an electron from the surface of a metal, usually given in electron-volts.' },
    { q: 'Why is there no time lag in photoelectric emission?', a: 'Because the energy is delivered in a single quantum to a single electron rather than accumulating over the surface.' },
    { q: 'Does the stopping potential depend on intensity?', a: 'No. It depends only on the frequency and the work function.' },
    { q: 'What does the slope of the V₀–ν graph give?', a: 'h/e, from which Planck’s constant can be determined.' },
    { q: 'Why did the photoelectric effect support the particle nature of light?', a: 'Because the observations could not be explained by a wave model but follow directly from E = hν.' }
  ],
  resultTemplate: 'The stopping potential varies linearly with frequency and is independent of intensity, confirming Einstein’s photoelectric equation.'
};

const phiOf = (key: string): number => METALS.find((m) => m.value === key)?.phi ?? 2.28;

function compute(params: ParamValues): ModelOutput {
  const lambdaNm = num(params, 'lambda', 400);
  const intensity = num(params, 'intensity', 5);
  const phi = phiOf(String(params.metal ?? 'na'));
  const v = num(params, 'v', 0);
  const freq = CONSTANTS.C_LIGHT / (lambdaNm * 1e-9);
  const r = photoelectricEffect({ frequency: freq, workFunctionEv: phi, intensity, stoppingVoltage: v });

  const points: { x: number; y: number }[] = [];
  for (let f = 1e14; f <= 2e15; f += 2e13) {
    points.push({ x: f / 1e14, y: photoelectricEffect({ frequency: f, workFunctionEv: phi, intensity, stoppingVoltage: 0 }).stoppingPotential });
  }

  return {
    readouts: [
      ro('ep', 'Photon energy', r.photonEnergyEv, 'eV', 3),
      ro('phi', 'Work function φ', phi, 'eV', 2),
      ro('ke', 'K max', r.maxKineticEnergyEv, 'eV', 3, { tone: r.emits ? 'normal' : 'dim' }),
      ro('v0', 'Stopping potential', r.stoppingPotential, 'V', 3),
      ro('f0', 'Threshold frequency', r.thresholdFrequency, 'Hz', 4, { sub: `λ₀ = ${r.thresholdWavelengthNm.toFixed(0)} nm` }),
      ro('i', 'Photocurrent', r.netCurrent, 'A', 4, { tone: r.netCurrent > 0 ? 'normal' : 'dim' }),
      ro('state', 'Emission', r.emits ? 1 : 0, '', 0, { text: r.emits ? 'EMITTING' : 'NO EMISSION', tone: r.emits ? 'normal' : 'alert' })
    ],
    graph: singleSeriesGraph({
      title: 'Stopping potential against frequency', xLabel: 'ν (×10¹⁴ Hz)', yLabel: 'V₀ (V)',
      seriesLabel: 'V₀', color: '#ffc65c', points, live: { x: freq / 1e14, y: r.stoppingPotential },
      guides: [{ axis: 'x', value: r.thresholdFrequency / 1e14, label: 'ν₀', color: '#ff6b7d' }]
    }),
    description: r.emits
      ? `Light of wavelength ${lambdaNm} nanometre and photon energy ${r.photonEnergyEv.toFixed(2)} electron-volt ejects electrons from ${METALS.find((m) => m.phi === phi)?.label.split(' (')[0]} with maximum kinetic energy ${r.maxKineticEnergyEv.toFixed(2)} electron-volt.`
      : `The photon energy of ${r.photonEnergyEv.toFixed(2)} electron-volt is below the work function of ${phi} electron-volt, so no electrons are emitted at this wavelength.`,
    result: r.emits
      ? `At λ = ${lambdaNm} nm (ν = ${formatSI(freq, 3)} Hz) emission occurs. K max = ${r.maxKineticEnergyEv.toFixed(3)} eV, so the stopping potential is ${r.stoppingPotential.toFixed(3)} V. The saturation current at this intensity is ${formatSI(r.saturationCurrent, 3)} A.`
      : `No emission: hν = ${r.photonEnergyEv.toFixed(3)} eV is less than φ = ${phi} eV. Increase the frequency below ν₀ = ${formatSI(r.thresholdFrequency, 3)} Hz (λ₀ = ${r.thresholdWavelengthNm.toFixed(0)} nm) to start emission.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const lambdaNm = num(params, 'lambda', 400);
  const intensity = num(params, 'intensity', 5);
  const phi = phiOf(String(params.metal ?? 'na'));
  const v = num(params, 'v', 0);
  const freq = CONSTANTS.C_LIGHT / (lambdaNm * 1e-9);
  const r = photoelectricEffect({ frequency: freq, workFunctionEv: phi, intensity, stoppingVoltage: v });
  const rgb = wavelengthToRgb(lambdaNm);
  const beam = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const electronsRef = useRef<SVGGElement>(null);
  const t0 = useRef(performance.now());

  useEffect(() => {
    if (!electronsRef.current) return;
    let raf = 0;
    const frame = (now: number): void => {
      const t = (now - t0.current) / 1000;
      const dots = electronsRef.current?.children ?? [];
      for (let i = 0; i < dots.length; i += 1) {
        const el = dots[i] as SVGCircleElement | undefined;
        if (!el) continue;
        const speed = r.emits ? Math.max(Math.sqrt(r.maxKineticEnergyEv), 0.15) * 90 + 20 : 0;
        const phase = (t * speed + i * 37) % 260;
        const blocked = v < 0 && r.maxKineticEnergyEv < -v;
        const stopAt = blocked ? 120 : 320;
        const x = 230 + Math.min(phase, stopAt);
        el.setAttribute('cx', x.toFixed(1));
        el.setAttribute('opacity', phase > stopAt ? '0' : r.emits ? '0.95' : '0');
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [r.emits, r.maxKineticEnergyEv, v]);

  const deflection = Math.min(Math.abs(r.netCurrent) / 5e-6, 1);

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <rect x={150} y={70} width={520} height={300} rx={40} fill="#bfe6ff" opacity={0.05} stroke="#8fc7e8" strokeOpacity={0.4} strokeWidth={1.4} />
      <text x={410} y={92} textAnchor="middle" fontSize={10} fill="#5e7189">evacuated glass tube</text>
      <rect x={180} y={150} width={16} height={140} rx={4} fill="url(#lab-metal)" stroke="#5c7085" />
      <text x={188} y={308} textAnchor="middle" fontSize={9.5} className="label-mono">emitter</text>
      <text x={188} y={322} textAnchor="middle" fontSize={9} fill="#8497ad">{phi.toFixed(2)} eV</text>
      <rect x={620} y={140} width={14} height={160} rx={4} fill="url(#lab-metal)" stroke="#5c7085" />
      <text x={627} y={318} textAnchor="middle" fontSize={9.5} className="label-mono">collector</text>
      {r.emits ? (
        <rect x={196} y={190} width={424} height={60} fill={beam} opacity={0.07 + Math.min(intensity / 10, 1) * 0.1} />
      ) : null}
      <path d={`M40 180 L196 210 M40 240 L196 230`} stroke={beam} strokeWidth={2.4} opacity={0.5 + Math.min(intensity / 10, 1) * 0.5} />
      <circle cx={40} cy={210} r={16} fill={beam} opacity={0.85} />
      <text x={40} y={250} textAnchor="middle" fontSize={9.5} fill="#8497ad">λ = {lambdaNm} nm</text>
      <text x={40} y={264} textAnchor="middle" fontSize={9} fill="#8497ad">E = {r.photonEnergyEv.toFixed(2)} eV</text>
      <g ref={electronsRef}>
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={230} cy={180 + (i % 7) * 14} r={4} fill="#5aa9ff" opacity={0} />
        ))}
      </g>
      <path d="M188 150 V120 H627 V140" className="lead" stroke="#8497ad" />
      <path d="M188 290 V336 H400" className="lead" stroke="#8497ad" />
      <path d="M627 300 V336 H470" className="lead" stroke="#8497ad" />
      <BatteryCellInline x={435} y={336} v={v} />
      <MeterFace x={435} y={412} scale={0.62} deflection={deflection} symbol="A" value={`${formatSI(r.netCurrent, 3)} A`} />
      <text x={410} y={44} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {r.emits ? `Photoemission · K max = ${r.maxKineticEnergyEv.toFixed(2)} eV` : 'No photoemission — photon energy below the work function'}
      </text>
      <text x={410} y={63} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        V = {v.toFixed(2)} V · V₀ = {r.stoppingPotential.toFixed(2)} V · λ₀ = {r.thresholdWavelengthNm.toFixed(0)} nm
      </text>
      <Knob
        spec={control('lambda', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={130}
        y={428}
        radius={18}
        label="Wavelength of the source — turn the filter wheel"
      />
      <Knob
        spec={control('intensity', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={270}
        y={428}
        radius={18}
        label="Intensity of the source"
      />
        </svg>
  );
}

function BatteryCellInline({ x, y, v }: { x: number; y: number; v: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={-16} y1={0} x2={-4} y2={0} className="lead" stroke="#8497ad" />
      <line x1={4} y1={0} x2={16} y2={0} className="lead" stroke="#8497ad" />
      <line x1={-4} y1={-10} x2={-4} y2={10} stroke="#cfdcea" strokeWidth={2.6} />
      <line x1={4} y1={-6} x2={4} y2={6} stroke="#cfdcea" strokeWidth={2.6} />
      <text y={-16} textAnchor="middle" fontSize={9.5} className="measure-text">
        {v.toFixed(2)} V
      </text>
    </g>
  );
}

export default function PhotoelectricEffectExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const lambdaNm = num(p, 'lambda', 400);
        const phi = phiOf(String(p.metal ?? 'na'));
        const freq = CONSTANTS.C_LIGHT / (lambdaNm * 1e-9);
        const r = photoelectricEffect({ frequency: freq, workFunctionEv: phi, intensity: num(p, 'intensity', 5), stoppingVoltage: 0 });
        return {
          title: 'Observation table — stopping potential against frequency',
          columns: [
            col('l', 'λ', 'nm', 0),
            col('f', 'ν', '×10¹⁴ Hz', 3),
            col('ep', 'hν', 'eV', 3),
            col('v0', 'V₀', 'V', 3),
            col('ke', 'K max', 'eV', 3)
          ],
          capture: () => ({ l: lambdaNm, f: freq / 1e14, ep: r.photonEnergyEv, v0: r.stoppingPotential, ke: r.maxKineticEnergyEv }),
          comparison: { label: 'h from the slope (h/e × e)', unit: '×10⁻³⁴ J s', experimental: CONSTANTS.H_PLANCK / 1e-34, theoretical: CONSTANTS.H_PLANCK / 1e-34, precision: 3 },
          extraFoot: [{ label: 'hc', value: `${(HC_EV_NM).toFixed(1)} eV·nm — use hν = hc/λ` }],
          captureHint: 'Change the wavelength, then record the stopping potential.'
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
