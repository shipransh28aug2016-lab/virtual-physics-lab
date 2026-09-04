import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { DiodeSvg, Resistor } from '@/components/instruments/Instruments';
import { col, num, ro, singleSeriesGraph, str } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './pn-junction-rectifier.meta';

export { meta };

/** Forward voltage drop of a conducting silicon PN junction, in volts — the standard NCERT approximation. */
const DIODE_DROP = 0.7;

const MODES = [
  { value: 'half', label: 'Half-wave (single diode)' },
  { value: 'full', label: 'Full-wave (centre-tap, two diodes)' }
];

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#5aa9ff',
  controls: [
    { kind: 'slider', key: 'v0', label: 'Input amplitude', symbol: 'V_0', unit: 'V', min: 1, max: 20, step: 0.5, initial: 10, hint: 'Peak of the AC input from the transformer secondary', stage: { x: 8, y: 8, length: 24 } },
    { kind: 'select', key: 'mode', label: 'Rectifier', initial: 'half', options: MODES }
  ],
  defaults: { v0: 10, mode: 'half' }
};

const education: EducationPack = {
  theory: [
    'A PN junction conducts current in one direction only: forward bias (p-side positive) lets current flow once the junction voltage exceeds about 0.7 V for silicon, while reverse bias blocks it almost completely. This asymmetry is the basis of rectification — converting an alternating current into a direct one.',
    'In a half-wave rectifier a single diode is placed in series with the load. It conducts during the positive half-cycle of the input and blocks during the negative half-cycle, so the load sees only the positive lobes of the wave with gaps between them.',
    'A full-wave centre-tap rectifier uses two diodes fed from opposite ends of a centre-tapped secondary. One diode conducts on each half-cycle, so the load receives a positive pulse on every half-cycle of the input — twice the pulses of the half-wave circuit, and a much smoother output.',
    'Neither output is pure DC — both are a series of pulses with an AC component riding on a DC average. A capacitor filter (not modelled here) smooths this further by charging on each pulse and discharging slowly between them.'
  ],
  formulas: [
    { tex: 'V_{out} = V_{in} - V_{diode}\\ \\text{when conducting, else } 0', caption: 'Diode drop model used here (0.7 V, silicon).' },
    { tex: 'V_{dc} = \\frac{V_m}{\\pi}\\ (\\text{half}),\\ \\ \\frac{2V_m}{\\pi}\\ (\\text{full})', caption: 'DC (average) output voltage.' },
    { tex: 'V_{rms} = \\frac{V_m}{2}\\ (\\text{half}),\\ \\ \\frac{V_m}{\\sqrt{2}}\\ (\\text{full})', caption: 'RMS output voltage.' },
    { tex: '\\gamma = \\sqrt{\\left(\\frac{V_{rms}}{V_{dc}}\\right)^2 - 1}', caption: 'Ripple factor — how far the output is from pure DC.' }
  ],
  variables: [
    { symbol: 'V_0', name: 'Input peak amplitude', unit: 'V' },
    { symbol: 'V_m', name: 'Peak output after the diode drop', unit: 'V' },
    { symbol: 'V_{dc}', name: 'DC (average) output', unit: 'V' },
    { symbol: 'V_{rms}', name: 'RMS output', unit: 'V' },
    { symbol: '\\gamma', name: 'Ripple factor', unit: '—' },
    { symbol: 'PIV', name: 'Peak inverse voltage on the blocking diode', unit: 'V' }
  ],
  procedure: [
    'Set the rectifier to half-wave and note how the output waveform only fills every other half-cycle.',
    'Switch to full-wave and see the gaps close up — a pulse now appears on every half-cycle.',
    'Increase the input amplitude and confirm the DC output rises in proportion, offset by the fixed 0.7 V diode drop.',
    'Compare the ripple factor of the two modes — full-wave is always smoother.',
    'Read off the peak inverse voltage the blocking diode must withstand in each mode.'
  ],
  precautions: [
    'A real diode also has a small reverse leakage current and a maximum PIV rating it must not exceed — exceeding it destroys the diode.',
    'This model omits a smoothing capacitor; a practical DC supply always filters the rectifier output further.',
    'The 0.7 V drop assumes a silicon diode at typical operating current; germanium diodes drop closer to 0.3 V.'
  ],
  tips: ['A full-wave rectifier’s ripple factor (≈0.48) is roughly half that of a half-wave rectifier (≈1.21) — this is why almost every practical DC supply uses full-wave or bridge rectification.'],
  viva: [
    { q: 'Why does a PN junction rectify an alternating current?', a: 'Because it conducts current in one direction (forward bias) and blocks it in the other (reverse bias), so only one polarity of the input reaches the load.' },
    { q: 'What is the ripple factor and why does full-wave rectification give a smaller one?', a: 'It measures the AC content remaining in the output relative to its DC average; full-wave rectification fills in the gaps left by half-wave rectification, so its output is closer to steady DC.' },
    { q: 'What is peak inverse voltage?', a: 'The maximum reverse voltage that appears across a non-conducting diode in the circuit — the diode must be rated to withstand at least this much.' },
    { q: 'Why does a centre-tap full-wave rectifier need two diodes?', a: 'Each diode handles one half-cycle, conducting current from its half of the centre-tapped secondary to the same load in the same direction.' },
    { q: 'What removes the remaining ripple in a practical DC power supply?', a: 'A filter, typically a capacitor across the load, which charges on each pulse and discharges slowly between pulses.' }
  ],
  resultTemplate: 'The diode passes only the half-cycles for which it is forward biased, giving a pulsed unidirectional output; full-wave rectification halves the ripple factor of half-wave rectification for the same input.'
};

function computeMetrics(v0: number, mode: string) {
  const vm = Math.max(0, v0 - DIODE_DROP);
  const half = mode === 'half';
  const vdc = half ? vm / Math.PI : (2 * vm) / Math.PI;
  const vrms = half ? vm / 2 : vm / Math.SQRT2;
  const rippleFactor = vdc > 0 ? Math.sqrt(Math.max((vrms / vdc) ** 2 - 1, 0)) : 0;
  const piv = half ? v0 : 2 * v0;
  return { vm, vdc, vrms, rippleFactor, piv };
}

/** Instantaneous rectified output for a sinusoidal input of amplitude v0, at phase (radians). */
function outputAt(v0: number, mode: string, phaseRad: number): number {
  const vin = v0 * Math.sin(phaseRad);
  const half = mode === 'half';
  const rectified = half ? vin : Math.abs(vin);
  return rectified > DIODE_DROP ? rectified - DIODE_DROP : 0;
}

function compute(params: ParamValues): ModelOutput {
  const v0 = num(params, 'v0', 10);
  const mode = str(params, 'mode', 'half');
  const half = mode === 'half';
  const m = computeMetrics(v0, mode);

  const points: { x: number; y: number }[] = [];
  for (let deg = 0; deg <= 720; deg += 6) {
    points.push({ x: deg, y: outputAt(v0, mode, (deg * Math.PI) / 180) });
  }
  const livePhaseDeg = 90;
  const liveOutput = outputAt(v0, mode, (livePhaseDeg * Math.PI) / 180);

  return {
    readouts: [
      ro('v0', 'Input peak V₀', v0, 'V', 2),
      ro('vm', 'Output peak Vₘ', m.vm, 'V', 2, { sub: `after ${DIODE_DROP} V diode drop` }),
      ro('vdc', 'DC output V_dc', m.vdc, 'V', 3),
      ro('vrms', 'RMS output V_rms', m.vrms, 'V', 3),
      ro('gamma', 'Ripple factor γ', m.rippleFactor, '', 3, { tone: m.rippleFactor < 1 ? 'normal' : 'alert' }),
      ro('piv', 'Peak inverse voltage', m.piv, 'V', 2),
      ro('mode', 'Circuit', 0, '', 0, { text: half ? 'HALF-WAVE' : 'FULL-WAVE', tone: 'normal' })
    ],
    graph: singleSeriesGraph({
      title: 'Rectified output against input phase', xLabel: 'ωt (degrees)', yLabel: 'V_out (V)',
      seriesLabel: 'V_out', color: '#5aa9ff', points, live: { x: livePhaseDeg, y: liveOutput },
      guides: [{ axis: 'y', value: m.vdc, label: 'V_dc', color: '#ffc65c' }]
    }),
    description: `A ${v0.toFixed(1)} V peak sine input through a ${half ? 'single diode' : 'centre-tap pair of diodes'} gives a DC output of ${m.vdc.toFixed(2)} V with a ripple factor of ${m.rippleFactor.toFixed(2)}.`,
    result: `${half ? 'Half-wave' : 'Full-wave'} rectification of a ${v0.toFixed(1)} V peak input: V_dc = ${m.vdc.toFixed(3)} V, V_rms = ${m.vrms.toFixed(3)} V, ripple factor γ = ${m.rippleFactor.toFixed(3)}, PIV = ${m.piv.toFixed(2)} V.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const v0 = num(params, 'v0', 10);
  const mode = str(params, 'mode', 'half');
  const half = mode === 'half';
  const m = computeMetrics(v0, mode);

  const inputPath = Array.from({ length: 121 }, (_, i) => {
    const deg = i * 3;
    const x = 40 + (deg / 360) * 260;
    const y = 60 - (v0 / 20) * 34 * Math.sin((deg * Math.PI) / 180);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const outputPath = Array.from({ length: 121 }, (_, i) => {
    const deg = i * 3;
    const x = 40 + (deg / 360) * 260;
    const out = outputAt(v0, mode, (deg * Math.PI) / 180);
    const y = 190 - (out / 20) * 34;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 640 320" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={320} y={26} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {half ? 'Half-wave rectifier' : 'Full-wave (centre-tap) rectifier'} — V_dc = {m.vdc.toFixed(2)} V
      </text>

      {/* Input trace. */}
      <rect x={30} y={20} width={280} height={90} fill="#0d1621" stroke="#26374a" rx={6} />
      <line x1={40} y1={60} x2={300} y2={60} stroke="#293a4e" strokeWidth={1} />
      <path d={inputPath} fill="none" stroke="#ffc65c" strokeWidth={2} />
      <text x={40} y={106} fontSize={9} fill="#5e7189">
        input V_in, peak {v0.toFixed(1)} V
      </text>

      {/* Circuit: source, diode(s), load. */}
      <line x1={40} y1={150} x2={140} y2={150} className="lead" stroke="#8497ad" />
      <circle cx={40} cy={150} r={16} fill="none" stroke="#8497ad" strokeWidth={1.4} />
      <path d="M 33 150 q 3.5 -8 7 0 q 3.5 8 7 0" fill="none" stroke="#8497ad" strokeWidth={1.4} />
      <g transform="translate(160 150)">
        <DiodeSvg forward live={outputAt(v0, mode, Math.PI / 2) > 0} />
      </g>
      {half ? null : (
        <g transform="translate(160 190)">
          <DiodeSvg forward live={outputAt(v0, mode, (3 * Math.PI) / 2) > 0} />
        </g>
      )}
      <line x1={190} y1={150} x2={280} y2={150} className="lead" stroke="#8497ad" />
      {half ? null : <line x1={190} y1={190} x2={280} y2={190} className="lead" stroke="#8497ad" />}
      <Resistor x={330} y={half ? 150 : 170} value={1000} label="load R" live />
      <line x1={380} y1={half ? 150 : 170} x2={420} y2={half ? 150 : 170} className="lead" stroke="#8497ad" />

      {/* Output trace. */}
      <rect x={30} y={145} width={280} height={95} fill="none" opacity={0} />
      <rect x={30} y={150} width={280} height={90} fill="#0d1621" stroke="#26374a" rx={6} transform="translate(340 -10)" />
      <g transform="translate(340 -10)">
        <line x1={40} y1={190} x2={300} y2={190} stroke="#293a4e" strokeWidth={1} />
        <path d={outputPath} fill="none" stroke="#5aa9ff" strokeWidth={2} />
        <text x={40} y={244} fontSize={9} fill="#5e7189">
          rectified output V_out
        </text>
      </g>

      <Knob
        spec={control('v0', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={80}
        y={280}
        radius={20}
        label="Input peak amplitude"
      />
    </svg>
  );
}

export default function PnJunctionRectifierExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const v0 = num(p, 'v0', 10);
        const mode = str(p, 'mode', 'half');
        const m = computeMetrics(v0, mode);
        return {
          title: 'Observation table — half-wave vs full-wave rectification',
          columns: [
            col('v0', 'V₀', 'V', 2),
            col('vdc', 'V_dc', 'V', 3),
            col('vrms', 'V_rms', 'V', 3),
            col('gamma', 'γ', '', 3),
            col('piv', 'PIV', 'V', 2)
          ],
          capture: () => ({ v0, vdc: m.vdc, vrms: m.vrms, gamma: m.rippleFactor, piv: m.piv }),
          comparison: {
            label: `Textbook ripple factor (${mode === 'half' ? 'half-wave' : 'full-wave'})`,
            unit: '',
            experimental: m.rippleFactor,
            theoretical: mode === 'half' ? 1.21 : 0.48,
            precision: 2
          },
          captureHint: 'Change the amplitude or the mode, then record the reading.'
        };
      }}
    />
  );
}

export { definition, education };
