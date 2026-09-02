import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BatteryCell, MeterFace, Resistor, Rheostat, Switch } from '@/components/instruments/Instruments';
import { DiodeSvg } from '@/components/instruments/DiodeSvg';
import { diodeCurrent, loopCurrent } from '@/physics-engine/circuits';
import { CONSTANTS } from '@/physics-engine/constants';
import { formatSI } from '@/utils/format';
import { num, ro } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './iv-characteristic.meta';
import { BenchBoard } from '@/components/instruments/BenchBoard';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ff7a90', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'segmented', key: 'device', label: 'Device', initial: 'resistor', options: [{ value: 'resistor', label: 'Resistor (ohmic)' }, { value: 'diode', label: 'PN junction diode' }] },
    { kind: 'slider', key: 'v', label: 'Applied voltage', symbol: 'V', unit: 'V', min: -6, max: 6, step: 0.02, initial: 0.6, precision: 2 },
    { kind: 'slider', key: 'r', label: 'Series resistance', symbol: 'R', unit: '\u03a9', min: 10, max: 1000, step: 5, initial: 100 },
    { kind: 'slider', key: 'rDevice', label: 'Resistor value', symbol: 'R_D', unit: '\u03a9', min: 10, max: 1000, step: 5, initial: 220 },
    { kind: 'slider', key: 'temp', label: 'Temperature', symbol: 'T', unit: '°C', min: 0, max: 100, step: 1, initial: 27, hint: 'Shifts the diode characteristic' }
  ],
  defaults: { device: 'resistor', v: 0.6, r: 100, rDevice: 220, temp: 27 }
};

const education: EducationPack = {
  theory: [
    'An ohmic conductor obeys Ohm\u2019s law, so its current is directly proportional to the applied voltage and its I\u2013V graph is a straight line through the origin. The slope of that line is the conductance and its reciprocal is the resistance.',
    'A PN junction diode is non-ohmic. In forward bias almost no current flows until the applied voltage reaches the knee voltage, about 0.7 volt for silicon, after which the current rises very steeply.',
    'In reverse bias only a very small leakage current flows, of the order of microamperes, and it stays nearly constant until breakdown. The diode therefore conducts easily in one direction only and acts as a rectifier.'
  ],
  formulas: [
    { tex: 'V = IR', caption: 'Ohm\u2019s law for the resistor.' },
    { tex: 'I = I_0 (e^{qV/kT} - 1)', caption: 'Diode equation.' },
    { tex: 'R_d = \\frac{dV}{dI}', caption: 'Dynamic resistance of the diode.' },
    { tex: 'kT/q \\approx 26 \\text{ mV at } 300\\text{ K}', caption: 'Thermal voltage.' }
  ],
  variables: [
    { symbol: 'I', name: 'Current', unit: 'A' },
    { symbol: 'V', name: 'Applied voltage', unit: 'V' },
    { symbol: 'R_D', name: 'Device resistance', unit: '\u03a9' },
    { symbol: 'I_0', name: 'Reverse saturation current', unit: 'A' },
    { symbol: 'T', name: 'Temperature', unit: 'K' }
  ],
  procedure: [
    'Connect the device in series with a rheostat, an ammeter and a key, with a voltmeter across the device.',
    'Increase the voltage in small steps and record the current at each step.',
    'For the diode, repeat with the connections reversed to obtain the reverse characteristic.',
    'Plot I against V for both cases and find the knee voltage and the dynamic resistance.'
  ],
  precautions: ['Do not exceed the current rating of the diode; keep a series resistance in the circuit.', 'Take smaller voltage steps near the knee where the current changes rapidly.', 'Allow the device to cool between readings, as heating changes the characteristic.', 'Note the polarity of both meters before switching on.'],
  tips: ['The dynamic resistance is the reciprocal of the slope of the I–V curve at the operating point.'],
  viva: [
    { q: 'What is the knee voltage of a silicon diode?', a: 'About 0.7 volt, the voltage at which the forward current starts to rise steeply.' },
    { q: 'Why is the reverse current so small?', a: 'Because only the minority carriers cross the junction, and their number is very small.' },
    { q: 'What happens to the characteristic when the temperature rises?', a: 'The forward curve shifts to lower voltage and the reverse saturation current increases.' },
    { q: 'Why is the resistor a straight line but the diode is not?', a: 'Because the resistor has a constant resistance while the diode resistance falls as the forward voltage rises.' },
    { q: 'What is dynamic resistance?', a: 'The ratio dV/dI at a particular operating point, not the ratio V/I.' }
  ],
  resultTemplate: 'The resistor gives a straight-line I–V graph confirming Ohm\u2019s law; the diode gives an exponential forward characteristic with a knee voltage of about 0.7 V and a very small reverse current.'
};

function compute(params: ParamValues): ModelOutput {
  const device = String(params.device ?? 'resistor');
  const v = num(params, 'v', 0.6);
  const rSeries = num(params, 'r', 100);
  const rDevice = num(params, 'rDevice', 220);
  const tempC = num(params, 'temp', 27);
  const tempK = tempC + 273.15;

  const isDiode = device === 'diode';
  const current = isDiode
    ? diodeCurrent(1e-9, v, tempK)
    : loopCurrent({ emf: v, internalResistance: rSeries }, rDevice);
  const power = Math.abs(v * current);
  const dynamicR = isDiode
    ? 0.01 / Math.max(Math.abs(diodeCurrent(1e-9, v + 0.01, tempK) - diodeCurrent(1e-9, v - 0.01, tempK)), 1e-15)
    : rDevice;

  const points: { x: number; y: number }[] = [];
  for (let k = -60; k <= 60; k += 1) {
    const vv = k / 10;
    const ii = isDiode ? diodeCurrent(1e-9, vv, tempK) : loopCurrent({ emf: vv, internalResistance: rSeries }, rDevice);
    points.push({ x: vv, y: (isDiode ? Math.max(Math.min(ii * 1000, 20), -1) : ii * 1000) });
  }

  return {
    readouts: [
      ro('i', 'Current', current, 'A', 6, { sub: isDiode ? `${(current * 1000).toFixed(3)} mA` : `${(current * 1000).toFixed(2)} mA` }),
      ro('v', 'Applied voltage', v, 'V', 3),
      ro('rd', isDiode ? 'Dynamic resistance' : 'Device resistance', dynamicR, '\u03a9', isDiode ? 1 : 0, { sub: isDiode ? 'dV/dI at this point' : 'constant' }),
      ro('p', 'Power dissipated', power, 'W', 5, { sub: formatSI(power, 3) }),
      isDiode
        ? ro('knee', 'Knee voltage', 0.7 - (tempC - 27) * 0.002, 'V', 3, { sub: 'silicon, at this temperature' })
        : ro('r2', 'Total circuit resistance', v === 0 ? rSeries + rDevice : Math.abs(v / current), '\u03a9', 1, { sub: `R + R_D = ${(rSeries + rDevice).toFixed(0)} \u03a9` }),
      ro('bias', 'Bias condition', 0, '\u2014', 0, { text: isDiode ? (v > 0 ? 'forward bias' : v < 0 ? 'reverse bias' : 'zero bias') : v > 0 ? 'forward' : 'reverse' }),
      ro('t', 'Temperature', tempC, '°C', 0, { sub: `${tempK.toFixed(1)} K` })
    ],
    graph: {
      title: isDiode ? 'Diode I–V characteristic' : 'Ohmic I–V characteristic',
      xLabel: 'V (V)', yLabel: isDiode ? 'I (mA, clipped)' : 'I (mA)',
      series: [{ key: 'iv', label: 'I', color: isDiode ? '#ff7a90' : '#25d0ee', points }]
    },
    live: { x: v, y: isDiode ? Math.max(Math.min(current * 1000, 20), -1) : current * 1000 },
    description: isDiode
      ? `At ${v.toFixed(2)} volt and ${tempC.toFixed(0)} °C the silicon diode carries ${formatSI(current, 3)} ampere, and its dynamic resistance at this point is ${formatSI(dynamicR, 3)} ohm.`
      : `A ${rDevice.toFixed(0)} ohm resistor across ${v.toFixed(2)} volt carries ${formatSI(current, 3)} ampere; the current is exactly proportional to the voltage.`,
    result: isDiode
      ? `The diode current at ${v.toFixed(2)} V is ${formatSI(current, 4)} A (knee voltage about 0.7 V). Dynamic resistance dV/dI = ${formatSI(dynamicR, 4)} \u03a9. In reverse bias the current saturates near \u22121 \u00b5A.`
      : `I = V/R = ${v.toFixed(2)}/${rDevice.toFixed(0)} = ${formatSI(current, 4)} A, so V/I = ${Math.abs(v / (current || 1e-12)).toFixed(1)} \u03a9 is constant, confirming Ohm\u2019s law.`,
    issues: isDiode && current > 0.05
      ? [{ field: 'v', severity: 'warning', message: `The forward current ${formatSI(current, 3)} A exceeds a typical 50 mA rating; increase the series resistance.` }]
      : []
  };
}

function Stage({ params, set, control }: StageApi) {
  const device = String(params.device ?? 'resistor');
  const v = num(params, 'v', 0.6);
  const rSeries = num(params, 'r', 100);
  const rDevice = num(params, 'rDevice', 220);
  const tempC = num(params, 'temp', 27);
  const isDiode = device === 'diode';
  const current = isDiode ? diodeCurrent(1e-9, v, tempC + 273.15) : loopCurrent({ emf: v, internalResistance: rSeries }, rDevice);
  const live = Math.abs(current) > 1e-9;
  const loop = 'M170 180 H650 V340 H170 Z';

  return (
    <svg viewBox="0 0 820 440" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <BenchBoard x={20} y={80} width={780} height={300} rx={14} />
      <path d={loop} fill="none" className={live ? 'lead lead-live' : 'lead lead-dead'} strokeWidth={2.4} />
      <BatteryCell x={170} y={260} emf={Math.abs(v)} live={live} label="E" />
      <Rheostat x={300} y={180} fraction={rSeries / 1000} label="Rh" live={live} />
      <Switch x={430} y={180} closed live={live} label="K" />
      {isDiode ? (
        <g transform="translate(560 180)">
          <DiodeSvg forward={v >= 0} live={live && current > 1e-6} />
        </g>
      ) : (
        <Resistor x={560} y={180} value={`${rDevice.toFixed(0)} Ω`} label="R_D" live={live} />
      )}
      <g transform="translate(410 262)">
        <MeterFace scale={0.5} deflection={Math.max(Math.min(current / 0.02, 1), -1)} symbol="A" zeroCentre value={formatSI(current, 3)} />
      </g>
      <g transform="translate(560 262)">
        <MeterFace scale={0.5} deflection={Math.max(Math.min(v / 6, 1), -1)} symbol="V" zeroCentre value={`${v.toFixed(2)} V`} />
      </g>
      <text x={410} y={108} textAnchor="middle" fontSize={12.5} fill="#eaf1f8" fontWeight={600}>
        {isDiode ? `PN junction diode · ${v >= 0 ? 'forward' : 'reverse'} bias` : `Ohmic resistor · ${rDevice.toFixed(0)} Ω`}
      </text>
      <text x={410} y={404} textAnchor="middle" fontSize={10.5} fill="#5e7189">
        I = {formatSI(current, 3)} A at V = {v.toFixed(2)} V · series {rSeries.toFixed(0)} Ω · T = {tempC.toFixed(0)} °C
      </text>
      <text x={410} y={424} textAnchor="middle" fontSize={10} fill="#455f78">
        {isDiode ? `thermal voltage kT/q = ${((CONSTANTS.K_B * (tempC + 273.15)) / CONSTANTS.E_CHARGE * 1000).toFixed(2)} mV` : 'I ∝ V — straight line through the origin'}
      </text>
      {/* The supply voltage and the series resistance are set at the bench. */}
      <Knob
        spec={control('v', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={130}
        y={400}
        radius={19}
        label="Applied voltage V — turn the supply"
      />
      <Knob
        spec={control('r', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={680}
        y={400}
        radius={19}
        label="Series resistance R"
      />
        </svg>
  );
}

export default function IvCharacteristicExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const device = String(p.device ?? 'resistor');
        const v = num(p, 'v', 0.6);
        const rSeries = num(p, 'r', 100);
        const rDevice = num(p, 'rDevice', 220);
        const tempC = num(p, 'temp', 27);
        const isDiode = device === 'diode';
        const current = isDiode ? diodeCurrent(1e-9, v, tempC + 273.15) : loopCurrent({ emf: v, internalResistance: rSeries }, rDevice);
        return {
          title: `Observation table — I\u2013V characteristic (${device})`,
          columns: [
            { key: 'v', label: 'V', unit: 'V', precision: 3 },
            { key: 'i', label: 'I', unit: 'mA', precision: 4, derived: true },
            { key: 'r', label: 'V/I', unit: 'Ω', precision: 1, derived: true }
          ],
          capture: () => ({ v, i: current * 1000, r: 0 }),
          derive: (row) => ({ ...row, r: Number(row.v) / (Number(row.i) / 1000 || 1e-12) })
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
