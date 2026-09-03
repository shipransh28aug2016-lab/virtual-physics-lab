import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill, SvgDefs } from '@/components/shell/Viewport';
import { BenchBoard } from '@/components/instruments/BenchBoard';
import { BatteryCell, MeterFace, Resistor } from '@/components/instruments/Instruments';
import { loopCurrent, resistanceAtTemperature } from '@/physics-engine/circuits';
import { CONSTANTS } from '@/physics-engine/constants';
import { celsiusToKelvin } from '@/physics-engine/units';
import { mergeIssues, validateRange } from '@/physics-engine/validation';
import { formatSI } from '@/utils/format';
import { col, num, ro, str, singleSeriesGraph } from './_shared';
import { Knob, StageSegmented, type StageApi } from '@/components/controls/StageKit';

import { meta } from './resistivity-temperature.meta';

export { meta };

/**
 * Two very different conductors: a metal, whose resistance rises almost linearly
 * with temperature, and a semiconductor thermistor, whose resistance falls
 * exponentially as carriers are thermally excited across the gap.
 */
const SAMPLES = [
  { value: 'copper', label: 'Copper wire', kind: 'metal', r0: 10, alpha: 0.00393 },
  { value: 'tungsten', label: 'Tungsten filament', kind: 'metal', r0: 10, alpha: 0.0045 },
  { value: 'manganin', label: 'Manganin coil', kind: 'metal', r0: 10, alpha: 0.00002 },
  { value: 'thermistor', label: 'Thermistor (NTC)', kind: 'semiconductor', r0: 10, alpha: 0 }
] as const;

const sampleOf = (key: string) => SAMPLES.find((s) => s.value === key) ?? SAMPLES[0];

/** Band gap of a typical NTC thermistor, in eV. */
const BAND_GAP_EV = 0.42;
const REF_C = 20;

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ffb454',
  controls: [
    { kind: 'segmented', key: 'sample', label: 'Sample in the bath', initial: 'copper', options: SAMPLES.map((s) => ({ value: s.value, label: s.label })) },
    { kind: 'slider', key: 'temp', label: 'Temperature of the bath', symbol: 'T', unit: '°C', min: 0, max: 200, step: 1, initial: 20, precision: 0, onStage: true },
    { kind: 'slider', key: 'r0', label: 'Resistance at 20 °C', symbol: 'R_0', unit: 'Ω', min: 1, max: 100, step: 0.5, initial: 10, precision: 1, onStage: true },
    { kind: 'slider', key: 'emf', label: 'Supply voltage', symbol: 'V', unit: 'V', min: 0.5, max: 6, step: 0.1, initial: 2, precision: 1, onStage: true }
  ],
  defaults: { sample: 'copper', temp: 20, r0: 10, emf: 2 }
};

const education: EducationPack = {
  theory: [
    'In a metal the charge carriers are free electrons and their number hardly changes with temperature. What does change is how often they are scattered: the lattice ions vibrate more violently as the metal is heated, the mean free time between collisions falls, and the resistivity rises. Over a modest range the rise is very close to linear, ρ = ρ₀[1 + α(T − T₀)].',
    'The constant α is the temperature coefficient of resistance. It is around 0.004 per degree for pure metals, which means a copper coil warmed by 100 °C gains about 40% in resistance. Alloys such as manganin and constantan are made deliberately with a coefficient near zero so that standard resistors keep their value.',
    'A semiconductor behaves in the opposite way. Raising the temperature excites many more electrons across the energy gap into the conduction band, and this increase in carrier number swamps the increase in scattering. The resistance therefore falls, and it falls exponentially rather than linearly.',
    'The two curves crossing on the same axes is the clearest single demonstration that conduction in a metal and in a semiconductor are different mechanisms rather than different degrees of the same thing.'
  ],
  formulas: [
    { tex: 'R_T = R_0\\left[1 + \\alpha(T - T_0)\\right]', caption: 'Linear model for a metal.' },
    { tex: '\\alpha = \\frac{R_T - R_0}{R_0(T - T_0)}', caption: 'Temperature coefficient from two measurements.' },
    { tex: 'R_T = R_0\\,e^{\\frac{E_g}{2k}\\left(\\frac{1}{T} - \\frac{1}{T_0}\\right)}', caption: 'Semiconductor: resistance falls with temperature.' },
    { tex: '\\rho = \\frac{m}{n e^2 \\tau}', caption: 'Drude picture: τ falls in a metal, n rises in a semiconductor.' }
  ],
  variables: [
    { symbol: 'R_T', name: 'Resistance at temperature T', unit: 'Ω' },
    { symbol: 'R_0', name: 'Resistance at the reference temperature', unit: 'Ω' },
    { symbol: '\\alpha', name: 'Temperature coefficient of resistance', unit: '°C⁻¹' },
    { symbol: 'T', name: 'Temperature', unit: '°C' },
    { symbol: 'E_g', name: 'Energy gap of the semiconductor', unit: 'eV' },
    { symbol: 'n', name: 'Number density of carriers', unit: 'm⁻³' }
  ],
  procedure: [
    'Wind the sample into a coil and immerse it in the oil bath along with a thermometer.',
    'Connect the coil into the circuit with an ammeter and a voltmeter, and note R at room temperature.',
    'Heat the bath slowly, stirring so the temperature is uniform.',
    'Note the resistance at every 10 °C rise, taking each reading only after the temperature has steadied.',
    'Plot R against T for the metal; the graph is a straight line and its slope gives αR₀.',
    'Replace the metal with the thermistor and repeat; the graph now falls steeply.',
    'Compute α for the metal from the slope and the intercept.'
  ],
  precautions: [
    'Stir the bath and wait for the reading to steady before noting the resistance.',
    'Keep the measuring current small — the current itself heats the sample.',
    'The thermometer bulb must be at the same depth as the coil.',
    'Use oil rather than water above 100 °C.'
  ],
  sourcesOfError: [
    'The sample lags behind the bath temperature if the heating is too fast.',
    'Self-heating of the coil by the measuring current.',
    'Resistance of the connecting leads, which do not share the bath temperature.',
    'Non-linearity of the metal at the top of the range.'
  ],
  tips: [
    'Switch between copper and manganin at the same temperature: manganin barely moves, which is why standard resistors are made of it.',
    'Put the thermistor in and watch the resistance fall as the bath heats — the opposite of every metal.'
  ],
  viva: [
    { q: 'Why does the resistance of a metal increase with temperature?', a: 'The lattice ions vibrate more, electrons are scattered more often, the relaxation time falls and the resistivity rises.' },
    { q: 'Why does a semiconductor behave oppositely?', a: 'Heating excites many more carriers across the energy gap, and that increase outweighs the extra scattering.' },
    { q: 'What is the temperature coefficient of resistance?', a: 'The fractional change in resistance per degree rise in temperature, α = ΔR/(R₀ΔT).' },
    { q: 'Why is manganin used for standard resistances?', a: 'Its temperature coefficient is nearly zero, so its resistance is stable against temperature changes.' },
    { q: 'What is an NTC thermistor?', a: 'A semiconductor device with a negative temperature coefficient — its resistance falls as it is heated.' }
  ],
  resultTemplate:
    'The resistance of the metal rises linearly with temperature while that of the semiconductor falls exponentially, and the coefficient computed from the metal graph matches the accepted value.'
};

/** Resistance of the chosen sample at a given bath temperature. */
function sampleResistance(key: string, r0: number, tempC: number): number {
  const s = sampleOf(key);
  if (s.kind === 'metal') return resistanceAtTemperature(r0, s.alpha, tempC, REF_C);
  const eg = BAND_GAP_EV * CONSTANTS.EV;
  const k = CONSTANTS.K_B;
  return r0 * Math.exp((eg / (2 * k)) * (1 / celsiusToKelvin(tempC) - 1 / celsiusToKelvin(REF_C)));
}

function model(params: ParamValues) {
  const key = str(params, 'sample', 'copper');
  const sample = sampleOf(key);
  const tempC = num(params, 'temp', 20);
  const r0 = num(params, 'r0', 10);
  const emf = num(params, 'emf', 2);

  const resistance = sampleResistance(key, r0, tempC);
  const current = loopCurrent({ emf, internalResistance: 0.2 }, resistance);
  const voltage = current * resistance;
  // α recovered exactly as a student would, from the two-point definition.
  const alphaMeasured = tempC === REF_C ? Number.NaN : (resistance - r0) / (r0 * (tempC - REF_C));

  return { key, sample, tempC, r0, emf, resistance, current, voltage, alphaMeasured };
}

function compute(params: ParamValues): ModelOutput {
  const m = model(params);

  const issues = mergeIssues(
    validateRange('temp', 'Temperature of the bath', m.tempC, 0, 200),
    validateRange('emf', 'Supply voltage', m.emf, 0.5, 6)
  );
  if (m.current > 0.35) {
    issues.push({
      field: 'emf',
      severity: 'warning',
      message: 'The measuring current is large enough to heat the sample itself, so the bath thermometer no longer gives its true temperature.'
    });
  }

  const points: { x: number; y: number }[] = [];
  for (let t = 0; t <= 200; t += 2) points.push({ x: t, y: sampleResistance(m.key, m.r0, t) });

  return {
    readouts: [
      ro('sample', 'Sample', 0, '', 0, { text: m.sample.label, sub: m.sample.kind }),
      ro('t', 'Temperature T', m.tempC, '°C', 0, { sub: `${celsiusToKelvin(m.tempC).toFixed(1)} K` }),
      ro('r', 'Resistance R_T', m.resistance, 'Ω', 3, { tone: m.resistance > m.r0 ? 'alert' : m.resistance < m.r0 ? 'neg' : 'normal' }),
      ro('r0', 'Reference R₀ at 20 °C', m.r0, 'Ω', 2),
      ro('alpha', 'Coefficient α', m.alphaMeasured, '°C⁻¹', 5, {
        text: Number.isFinite(m.alphaMeasured) ? undefined : 'heat the bath',
        sub: m.sample.kind === 'metal' ? `accepted ${m.sample.alpha}` : 'negative — semiconductor'
      }),
      ro('i', 'Measuring current', m.current, 'A', 4),
      ro('v', 'Voltage across the sample', m.voltage, 'V', 3)
    ],
    graph: singleSeriesGraph({
      title: `Resistance against temperature — ${m.sample.label.toLowerCase()}`,
      xLabel: 'T (°C)',
      yLabel: 'R (Ω)',
      seriesLabel: m.sample.kind === 'metal' ? 'R = R₀[1 + α(T − T₀)]' : 'thermally activated conduction',
      color: m.sample.kind === 'metal' ? '#ffb454' : '#9d8cff',
      points,
      live: { x: m.tempC, y: m.resistance },
      guides: [{ axis: 'y', value: m.r0, label: 'R₀', color: '#5e7189' }],
      markers: [{ x: REF_C, y: m.r0, label: '20 °C', color: '#45d68b' }]
    }),
    issues,
    description: `A ${m.sample.label.toLowerCase()} of resistance ${m.r0.toFixed(1)} ohm at 20 degrees Celsius sits in a bath at ${m.tempC.toFixed(0)} degrees. Its resistance is now ${m.resistance.toFixed(3)} ohm and it carries ${formatSI(m.current, 3)} ampere.`,
    result: m.tempC === REF_C
      ? `At the reference temperature of ${REF_C} °C the sample is at its quoted resistance of ${m.r0.toFixed(2)} Ω. The temperature coefficient needs two different temperatures, so heat the bath to measure it.`
      : m.sample.kind === 'metal'
      ? `Heating from 20 °C to ${m.tempC.toFixed(0)} °C raises the resistance from ${m.r0.toFixed(2)} Ω to ${m.resistance.toFixed(3)} Ω, so α = (R_T − R₀)/[R₀(T − T₀)] = ${Number.isFinite(m.alphaMeasured) ? `${m.alphaMeasured.toFixed(5)}` : '—'} per °C against the accepted ${m.sample.alpha} per °C.`
      : `Heating from 20 °C to ${m.tempC.toFixed(0)} °C lowers the resistance from ${m.r0.toFixed(2)} Ω to ${m.resistance.toFixed(3)} Ω. The coefficient is negative (${Number.isFinite(m.alphaMeasured) ? `${m.alphaMeasured.toFixed(5)}` : '—'} per °C) because more carriers are excited across the ${BAND_GAP_EV} eV gap as the sample is heated.`
  };
}

function Stage({ params, set, control }: StageApi) {
  const m = model(params);
  const hot = Math.max(0, Math.min(1, (m.tempC - 20) / 180));
  const bathColour = `rgb(${Math.round(40 + hot * 190)}, ${Math.round(70 - hot * 20)}, ${Math.round(120 - hot * 70)})`;

  return (
    <svg viewBox="0 0 820 470" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={110} width={780} height={310} rx={14} />
      <text x={410} y={140} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
        {m.sample.label} in an oil bath at {m.tempC.toFixed(0)} °C
      </text>

      {/* Bath, with its colour driven by the temperature. */}
      <rect x={300} y={250} width={220} height={130} rx={6} fill="#0b1119" stroke="#3a5069" strokeWidth={1.4} />
      <rect x={306} y={262} width={208} height={112} rx={4} fill={bathColour} opacity={0.45} />
      <g transform="translate(410 316)">
        <Resistor value={`${m.resistance.toFixed(2)} Ω`} label={m.sample.label} live={m.current > 1e-4} />
      </g>

      {/* Thermometer standing in the bath. */}
      <g transform="translate(492 236)">
        <rect x={-5} y={0} width={10} height={122} rx={5} fill="#0b1119" stroke="#8497ad" strokeWidth={1} />
        <rect x={-3} y={122 - 118 * (m.tempC / 200)} width={6} height={118 * (m.tempC / 200)} fill="#ff6b7d" />
        <circle cx={0} cy={128} r={8} fill="#ff6b7d" />
        <text x={14} y={12} fontSize={10} fill="#8497ad">{m.tempC.toFixed(0)} °C</text>
      </g>

      {/* Measuring circuit. */}
      <path d="M 180 200 L 640 200" className="lead lead-live" fill="none" />
      <path d="M 180 200 L 180 316 L 300 316 M 520 316 L 640 316 L 640 200" className="lead lead-live" fill="none" />
      <BatteryCell x={280} y={200} emf={m.emf} live label="V" />
      <g transform="translate(560 200)">
        <MeterFace deflection={Math.min(m.current / 0.5, 1)} symbol="A" scale={0.58} value={`${m.current.toFixed(3)} A`} />
      </g>

      <text x={410} y={444} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        R₀ = {m.r0.toFixed(2)} Ω at 20 °C → R = {m.resistance.toFixed(3)} Ω at {m.tempC.toFixed(0)} °C · α = {Number.isFinite(m.alphaMeasured) ? `${m.alphaMeasured.toFixed(5)} °C⁻¹` : 'undefined at the reference temperature'}
      </text>

      <Knob spec={control('temp', 'slider')} params={params} onChange={set} x={130} y={68} radius={20} label="Temperature of the bath — turn the dial" />
      <Knob spec={control('r0', 'slider')} params={params} onChange={set} x={270} y={68} radius={19} label="Resistance at 20 °C — turn the dial" />
      <Knob spec={control('emf', 'slider')} params={params} onChange={set} x={400} y={68} radius={19} label="Supply voltage — turn the dial" />
      <StageSegmented spec={control('sample', 'segmented')} params={params} onChange={set} x={620} y={68} segmentWidth={78} label="Sample" />
    </svg>
  );
}

export default function ResistivityTemperatureExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      viewportOverlay={(params) => {
        const m = model(params);
        return (
          <>
            <ViewPill label="T" value={m.tempC.toFixed(0)} unit="°C" />
            <ViewPill label="R" value={m.resistance.toFixed(2)} unit="Ω" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const m = model(p);
        return {
          title: 'Observation table — resistance against temperature',
          columns: [
            col('sample', 'Sample', '', 0),
            col('t', 'T', '°C', 0),
            col('v', 'V', 'V', 3),
            col('i', 'I', 'A', 4),
            col('r', 'R = V/I', 'Ω', 3, true),
            col('alpha', 'α', '°C⁻¹', 5, true)
          ],
          capture: () => ({ sample: m.sample.label, t: m.tempC, v: m.voltage, i: m.current, r: 0, alpha: 0 }),
          derive: (row) => {
            const r = Number(row.v) / Number(row.i);
            const t = Number(row.t);
            return { ...row, r, alpha: t === REF_C ? Number.NaN : (r - m.r0) / (m.r0 * (t - REF_C)) };
          },
          comparison: m.sample.kind === 'metal'
            ? { label: 'temperature coefficient', unit: '×10⁻³ °C⁻¹', experimental: m.alphaMeasured * 1000, theoretical: m.sample.alpha * 1000, precision: 3 }
            : undefined,
          captureHint: 'Let the bath steady at each temperature before recording.'
        };
      }}
    />
  );
}

export { definition, education };
