import { useMemo } from 'react';
import type { EducationPack, ExperimentDefinition, GraphSpec, ParamValues, ValidationIssue } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { ViewPill } from '@/components/shell/Viewport';
import { CircuitBench } from '@/components/bench';
import {
  decodeWires,
  detectFaults,
  hasClosedPath,
  solveCircuit,
  type CircuitGraph,
  type Fault,
  type Part
} from '@/physics-engine/circuit';
import { diodeCurrent, saturationCurrentAtTemperature } from '@/physics-engine/circuits';
import { CONSTANTS } from '@/physics-engine/constants';
import { useConnect } from '@/lab/interaction/useConnect';
import { useSound } from '@/lab/audio';
import { formatSI } from '@/utils/format';
import { num, ro, str } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './iv-characteristic.meta';

export { meta };

/* ── the devices under test ─────────────────────────────────────────────── */

/**
 * Real rectifier-diode parameters, not idealised ones. Silicon leaks about a
 * nanoampere and turns on near 0.7 V; germanium leaks a thousand times more and
 * turns on near 0.3 V. Both use an ideality of 1.8, which is what puts the knee
 * where the NCERT characteristic shows it at milliampere currents.
 */
const DEVICES = {
  silicon: { label: 'Silicon diode', saturationCurrent: 1e-9, ideality: 1.8 },
  germanium: { label: 'Germanium diode', saturationCurrent: 1e-6, ideality: 1.8 }
} as const;

const AMMETER_RANGES = { mA: 0.05, uA: 100e-6 } as const;
const VOLTMETER_RANGE = 10;
/**
 * A digital voltmeter, 10 MΩ. It matters: in reverse bias the voltmeter is the
 * only easy path for current, so the microammeter reads the voltmeter's own
 * current as well as the diode's. With a 100 kΩ moving-coil voltmeter that
 * would swamp a silicon leakage current entirely. The bench reports the
 * voltmeter current as its own reading so a student can subtract it.
 */
const VOLTMETER_RESISTANCE = 10e6;
const MOUNT_SPAN = 46;

const isDiodeMode = (device: string): device is keyof typeof DEVICES => device in DEVICES;

/** The device the student has plugged into the mount, at the bench temperature. */
function deviceUnderTest(params: ParamValues): Part {
  const device = str(params, 'device', 'silicon');
  const layout = { x: 250, y: 180, span: MOUNT_SPAN };
  if (!isDiodeMode(device)) {
    return {
      id: 'dev',
      kind: 'resistor',
      resistance: num(params, 'rDevice', 220),
      label: 'Resistor R_D',
      layout
    };
  }
  const spec = DEVICES[device];
  const temperatureK = num(params, 'temp', 27) + 273.15;
  return {
    id: 'dev',
    kind: 'diode',
    // I_s doubles per 10 K, so the reverse current really does grow with
    // temperature and the forward knee really does move down.
    saturationCurrent: saturationCurrentAtTemperature(spec.saturationCurrent, temperatureK),
    ideality: spec.ideality,
    temperatureK,
    label: spec.label,
    layout
  };
}

function benchParts(params: ParamValues): Part[] {
  return [
    deviceUnderTest(params),
    {
      id: 'am',
      kind: 'ammeter',
      resistance: 1,
      range: AMMETER_RANGES[str(params, 'meterRange', 'mA') === 'uA' ? 'uA' : 'mA'],
      label: str(params, 'meterRange', 'mA') === 'uA' ? 'Microammeter' : 'Milliammeter',
      layout: { x: 450, y: 180 }
    },
    {
      id: 'rh',
      kind: 'rheostat',
      maxResistance: 1000,
      fraction: num(params, 'series', 220) / 1000,
      label: 'Series R_h',
      layout: { x: 645, y: 180 }
    },
    { id: 'k', kind: 'key', closed: true, label: 'Key K', layout: { x: 250, y: 310 } },
    {
      id: 'c',
      kind: 'cell',
      emf: num(params, 'supply', 3),
      internalResistance: 0.5,
      label: 'Supply E',
      layout: { x: 470, y: 310 }
    },
    {
      id: 'vm',
      kind: 'voltmeter',
      resistance: VOLTMETER_RESISTANCE,
      range: VOLTMETER_RANGE,
      label: 'Voltmeter',
      layout: { x: 250, y: 392 }
    }
  ];
}

const encode = (pairs: string[]): string =>
  pairs.map((p) => p.split('-').sort().join('-')).sort().join(';');

/** The device the right way round: anode towards the positive terminal. */
const FORWARD_WIRING = encode([
  'c.a-k.b',
  'k.a-dev.a',
  'dev.b-am.a',
  'am.b-rh.a',
  'c.b-rh.b',
  'dev.a-vm.a',
  'dev.b-vm.b'
]);

/**
 * The same circuit with the device turned round — and the voltmeter turned
 * round with it, so its pointer stays on the scale. This is the second half of
 * the practical, not a mistake.
 */
const REVERSE_WIRING = encode([
  'c.a-k.b',
  'k.a-dev.b',
  'dev.a-am.a',
  'am.b-rh.a',
  'c.b-rh.b',
  'dev.b-vm.a',
  'dev.a-vm.b'
]);

const graphOf = (params: ParamValues): CircuitGraph => ({
  parts: benchParts(params),
  wires: decodeWires(str(params, 'wiring', FORWARD_WIRING))
});

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ff7a90', practicalNo: meta.practicalNo,
  controls: [
    {
      kind: 'segmented', key: 'device', label: 'Device in the mount', initial: 'silicon',
      options: [
        { value: 'silicon', label: 'Silicon diode' },
        { value: 'germanium', label: 'Germanium diode' },
        { value: 'resistor', label: 'Resistor (ohmic)' }
      ]
    },
    { kind: 'slider', key: 'supply', label: 'Supply voltage', symbol: 'E', unit: 'V', min: 0, max: 6, step: 0.05, initial: 3, precision: 2, onStage: true },
    { kind: 'slider', key: 'series', label: 'Series resistance', symbol: 'R_h', unit: 'Ω', min: 10, max: 1000, step: 5, initial: 220, onStage: true, hint: 'Protects the diode — never run it without one' },
    { kind: 'slider', key: 'rDevice', label: 'Resistor value', symbol: 'R_D', unit: 'Ω', min: 10, max: 1000, step: 5, initial: 220, onStage: true },
    { kind: 'slider', key: 'temp', label: 'Temperature', symbol: 'T', unit: '°C', min: 0, max: 100, step: 1, initial: 27, onStage: true, hint: 'Shifts the diode characteristic' },
    {
      kind: 'segmented', key: 'meterRange', label: 'Ammeter range', initial: 'mA',
      options: [
        { value: 'mA', label: 'Milliammeter (50 mA)' },
        { value: 'uA', label: 'Microammeter (100 µA)' }
      ],
      hint: 'Forward currents are milliamperes; reverse leakage is microamperes or less'
    },
    {
      // The netlist, carried as an ordinary parameter. The two named options are
      // the two halves of the practical; free wiring stores its own encoding.
      kind: 'select', key: 'wiring', label: 'Circuit wiring', initial: FORWARD_WIRING, onStage: true,
      options: [
        { value: FORWARD_WIRING, label: 'Device forward-biased' },
        { value: REVERSE_WIRING, label: 'Device reversed in the mount' },
        { value: '', label: 'Bare bench — wire it yourself' }
      ]
    }
  ],
  defaults: { device: 'silicon', supply: 3, series: 220, rDevice: 220, temp: 27, meterRange: 'mA', wiring: FORWARD_WIRING }
};

const education: EducationPack = {
  theory: [
    'An ohmic conductor obeys Ohm’s law, so its current is directly proportional to the applied voltage and its I–V graph is a straight line through the origin. The slope of that line is the conductance and its reciprocal is the resistance.',
    'A PN junction diode is non-ohmic. In forward bias almost no current flows until the applied voltage reaches the knee voltage — about 0.7 volt for silicon and about 0.3 volt for germanium — after which the current rises very steeply, following I = I₀(e^{qV/ηkT} − 1).',
    'In reverse bias only the reverse saturation current flows. For silicon that is of the order of a nanoampere and a microammeter will read essentially zero; for germanium it is a thousand times larger and is genuinely measurable in microamperes. That difference is why the two materials are examined side by side.',
    'The operating point is not chosen by the diode alone. The supply and the series resistance draw a load line I = (E − V)/R across the characteristic, and the circuit settles where the two curves cross. Turning the series resistance down moves the load line and slides the operating point up the curve — which is exactly what the rheostat is for, and why a diode must never be run without one.',
    'The bench solves the whole circuit, so the series resistance really does limit the current, the meters really do load the circuit, and the reverse characteristic comes from turning the device round in its mount rather than from a sign in a formula. One consequence is worth knowing before you meet it: once the diode blocks, the voltmeter becomes the easiest path for current in that branch, so the microammeter reads the voltmeter’s current as well as the diode’s. The bench reports the voltmeter current separately so it can be subtracted.'
  ],
  formulas: [
    { tex: 'V = IR', caption: 'Ohm’s law for the resistor.' },
    { tex: 'I = I_0 \\left(e^{qV/\\eta kT} - 1\\right)', caption: 'Shockley diode equation; η ≈ 1.8 for a rectifier diode.' },
    { tex: 'I = \\frac{E - V}{R_h + R_A + r}', caption: 'Load line of the supply and the series resistance.' },
    { tex: 'r_d = \\frac{dV}{dI} = \\frac{\\eta kT}{qI}', caption: 'Dynamic resistance of a conducting diode.' },
    { tex: 'kT/q \\approx 26 \\text{ mV at } 300\\text{ K}', caption: 'Thermal voltage.' }
  ],
  variables: [
    { symbol: 'I', name: 'Current', unit: 'A' },
    { symbol: 'V', name: 'Voltage across the device', unit: 'V' },
    { symbol: 'E', name: 'Supply voltage', unit: 'V' },
    { symbol: 'R_D', name: 'Device resistance', unit: 'Ω' },
    { symbol: 'I_0', name: 'Reverse saturation current', unit: 'A', note: 'Doubles for every 10 K rise' },
    { symbol: 'T', name: 'Temperature', unit: 'K' }
  ],
  procedure: [
    'Plug the device into the mount and wire it in series with the rheostat, the milliammeter and the key, with the voltmeter across the device alone.',
    'Keep the series resistance high before switching on, so the first current is small.',
    'Raise the supply in small steps and record the voltmeter and ammeter readings at each step.',
    'Take smaller steps near the knee, where the current changes fastest.',
    'Turn the device round in its mount, switch the ammeter to its microampere range and repeat for the reverse characteristic.',
    'In reverse bias, subtract the voltmeter’s own current from the ammeter reading — the bench reports it — because the voltmeter is the easiest path for current once the diode has blocked.',
    'Plot I against V for both cases; read the knee voltage from the forward curve and the reverse saturation current from the reverse one.'
  ],
  precautions: [
    'Never run the diode without a series resistance; the current is limited by the circuit, not by the junction.',
    'Do not exceed the current rating of the diode — this bench reports it when the meter goes past full scale.',
    'Take smaller voltage steps near the knee where the current changes rapidly.',
    'Allow the device to cool between readings, as heating changes the characteristic.',
    'Note the polarity of both meters before switching on.'
  ],
  sourcesOfError: [
    'Self-heating of the junction at high forward current, which raises the saturation current.',
    'The voltmeter draws a current of its own. In forward bias that is negligible; in reverse bias it can be larger than the diode current itself, and must be subtracted.',
    'Contact resistance at the mount and the terminals.'
  ],
  tips: [
    'Watch the load line move as you turn the series resistance down — the operating point slides up the characteristic.',
    'Compare silicon and germanium at the same supply: the knee moves from about 0.7 V to about 0.3 V.',
    'Raise the temperature and watch the reverse current grow while the forward knee moves down.',
    'In reverse bias compare the ammeter reading with the voltmeter’s own current: for silicon they are almost the same number, because the diode is leaking far less than the meter.'
  ],
  viva: [
    { q: 'What is the knee voltage of a silicon diode?', a: 'About 0.7 volt, the voltage at which the forward current starts to rise steeply. For germanium it is about 0.3 volt.' },
    { q: 'What happens to the characteristic when the temperature rises?', a: 'The forward curve shifts to lower voltage and the reverse saturation current increases, roughly doubling for every 10 K.' },
    { q: 'Why is the resistor a straight line but the diode is not?', a: 'Because the resistor has a constant resistance while the diode resistance falls as the forward voltage rises.' },
    { q: 'What is dynamic resistance?', a: 'The ratio dV/dI at a particular operating point, not the ratio V/I. For a conducting diode it is ηkT/qI.' },
    { q: 'Why must a series resistance always be used with a diode?', a: 'Beyond the knee the diode voltage barely changes, so nothing inside the diode limits the current; only the external resistance does.' },
    { q: 'Why does a microammeter read almost nothing of the diode in reverse for silicon?', a: 'Because the silicon reverse saturation current is of the order of a nanoampere, far below the least count of a microammeter. Germanium leaks about a thousand times more and is readable.' },
    { q: 'In reverse bias, what else is the ammeter measuring besides the diode?', a: 'The voltmeter’s own current. Once the diode blocks, the voltmeter is the easiest path in the branch, so its current appears in the ammeter reading and must be subtracted.' }
  ],
  resultTemplate:
    'The resistor gives a straight-line I–V graph confirming Ohm’s law; the diode gives an exponential forward characteristic with a knee near 0.7 V for silicon and 0.3 V for germanium, and a very small reverse current.'
};

/* ── model ──────────────────────────────────────────────────────────────── */

const safe = (v: number, digits: number): string => (Number.isFinite(v) ? v.toFixed(digits) : '—');

export interface DiodeReading {
  /** Current through the device, positive when forward-biased. */
  deviceCurrent: number;
  /** Voltage across the device, positive when forward-biased. */
  deviceVoltage: number;
  /** What the ammeter's pointer is showing, signed. */
  ammeter: number;
  /** What the voltmeter is showing, signed. */
  voltmeter: number;
  /** The voltmeter's own current — part of what the ammeter reads. */
  voltmeterCurrent: number;
  /** Resistance the supply drives the device through. */
  loopResistance: number;
  faults: Fault[];
  closedPath: boolean;
  isDiode: boolean;
}

export function readBench(params: ParamValues): DiodeReading {
  const graph = graphOf(params);
  const solution = solveCircuit(graph);
  const faults = detectFaults(graph, solution);
  return {
    deviceCurrent: solution.current.get('dev') ?? 0,
    deviceVoltage: solution.voltage.get('dev') ?? 0,
    ammeter: solution.current.get('am') ?? 0,
    voltmeter: solution.voltage.get('vm') ?? 0,
    voltmeterCurrent: solution.current.get('vm') ?? 0,
    loopResistance: num(params, 'series', 220) + 1 + 0.5,
    faults,
    closedPath: hasClosedPath(graph, solution.nodes, 'c'),
    isDiode: isDiodeMode(str(params, 'device', 'silicon'))
  };
}

/** The device's own characteristic, swept until it reaches its current rating. */
function characteristic(params: ParamValues): { x: number; y: number }[] {
  const device = str(params, 'device', 'silicon');
  const points: { x: number; y: number }[] = [];
  if (!isDiodeMode(device)) {
    const r = Math.max(num(params, 'rDevice', 220), 1e-6);
    for (let v = -6; v <= 6.0001; v += 0.1) points.push({ x: v, y: (v / r) * 1000 });
    return points;
  }
  const spec = DEVICES[device];
  const temperatureK = num(params, 'temp', 27) + 273.15;
  const is = saturationCurrentAtTemperature(spec.saturationCurrent, temperatureK);
  for (let v = -6; v <= 1.2001; v += 0.01) {
    const i = diodeCurrent(is, v, temperatureK, spec.ideality);
    // The sweep ends at the rating, exactly as a real one does. The data is
    // never clipped to fit the axis — the experiment simply stops there.
    if (i > 0.06) break;
    points.push({ x: v, y: i * 1000 });
  }
  return points;
}

/**
 * The load line the supply and the series resistance impose, taken through the
 * solved operating point so it is the circuit's own line, not a redrawn one.
 */
function loadLine(reading: DiodeReading): { x: number; y: number }[] {
  if (!reading.closedPath) return [];
  const r = Math.max(reading.loopResistance, 1e-6);
  const applied = reading.deviceVoltage + reading.deviceCurrent * r;
  const at = (v: number) => ({ x: v, y: ((applied - v) / r) * 1000 });
  return [at(-6), at(1.2)];
}

function compute(params: ParamValues): ModelOutput {
  const reading = readBench(params);
  const tempC = num(params, 'temp', 27);
  const tempK = tempC + 273.15;
  const i = reading.deviceCurrent;
  const v = reading.deviceVoltage;
  const thermal = (CONSTANTS.K_B * tempK) / CONSTANTS.E_CHARGE;

  // Dynamic resistance from the model, never from a table: ηkT/qI for a
  // conducting diode, and simply R for the ohmic device.
  const dynamicR = reading.isDiode
    ? Math.abs(i) > 1e-9
      ? (1.8 * thermal) / Math.abs(i)
      : Number.POSITIVE_INFINITY
    : num(params, 'rDevice', 220);

  const issues: ValidationIssue[] = reading.faults.map((f) => ({
    field: 'wiring',
    severity: f.severity,
    message: f.message
  }));
  if (reading.isDiode && i > 0.05) {
    issues.push({
      field: 'series',
      severity: 'warning',
      message: `The forward current ${formatSI(i, 3)} A exceeds a typical 50 mA rating. Raise the series resistance — nothing inside the diode limits it.`
    });
  }

  const bias = reading.isDiode ? (v > 0.02 ? 'forward bias' : v < -0.02 ? 'reverse bias' : 'zero bias') : v >= 0 ? 'forward' : 'reverse';

  const graph: GraphSpec = {
    title: reading.isDiode ? 'Diode characteristic with the circuit’s load line' : 'Ohmic I–V characteristic',
    xLabel: 'V across the device (V)',
    yLabel: 'I (mA)',
    series: [
      {
        key: 'iv',
        label: reading.isDiode ? 'device characteristic' : 'I = V/R',
        color: reading.isDiode ? '#ff7a90' : '#25d0ee',
        points: characteristic(params)
      },
      ...(reading.isDiode
        ? [
            {
              key: 'load',
              label: 'load line E, R_h',
              color: '#ffc65c',
              points: loadLine(reading),
              dashed: true
            }
          ]
        : [])
    ],
    markers: reading.closedPath ? [{ x: v, y: i * 1000, label: 'operating point', color: '#45d68b' }] : [],
    live: { x: v, y: i * 1000 }
  };

  return {
    readouts: [
      ro('i', 'Ammeter reads I', reading.ammeter, 'A', 6, { sub: formatSI(reading.ammeter, 3) + 'A' }),
      ro('v', 'Voltmeter reads V', reading.voltmeter, 'V', 3),
      ro('vd', 'Across the device', v, 'V', 3, { sub: bias }),
      ro('rd', reading.isDiode ? 'Dynamic resistance' : 'Device resistance', Number.isFinite(dynamicR) ? dynamicR : 0, 'Ω', 1, {
        sub: reading.isDiode ? (Number.isFinite(dynamicR) ? 'ηkT/qI at this point' : 'not conducting') : 'constant',
        tone: Number.isFinite(dynamicR) ? 'normal' : 'dim'
      }),
      ro('p', 'Power in the device', Math.abs(i * v), 'W', 6, { sub: formatSI(Math.abs(i * v), 3) + 'W' }),
      ro('vt', 'Thermal voltage kT/q', thermal * 1000, 'mV', 2, { sub: `${tempC.toFixed(0)} °C` }),
      ro('r', 'Series resistance', reading.loopResistance, 'Ω', 1, { sub: 'rheostat + meter + cell' }),
      ro('iv', 'Voltmeter’s own current', Math.abs(reading.voltmeterCurrent), 'A', 9, {
        sub: `${formatSI(Math.abs(reading.voltmeterCurrent), 3)}A — subtract it in reverse bias`,
        tone: 'dim'
      })
    ],
    graph,
    issues,
    description: reading.isDiode
      ? `A ${DEVICES[str(params, 'device', 'silicon') as keyof typeof DEVICES].label.toLowerCase()} in the mount at ${tempC.toFixed(0)} °C, driven by a ${num(params, 'supply', 3).toFixed(2)} volt supply through ${safe(reading.loopResistance, 0)} ohm. The device carries ${formatSI(i, 3)} ampere with ${safe(v, 3)} volt across it — ${bias}.`
      : `A ${num(params, 'rDevice', 220).toFixed(0)} ohm resistor driven by a ${num(params, 'supply', 3).toFixed(2)} volt supply carries ${formatSI(i, 3)} ampere with ${safe(v, 3)} volt across it; the current is exactly proportional to the voltage.`,
    result: reading.faults.some((f) => f.severity === 'error')
      ? `No valid reading can be taken while the circuit is mis-wired: ${reading.faults[0].message}`
      : reading.isDiode
        ? `At a supply of ${num(params, 'supply', 3).toFixed(2)} V the operating point is V = ${safe(v, 3)} V, I = ${formatSI(i, 4)} A, where the load line crosses the characteristic. The dynamic resistance there is ${formatSI(dynamicR, 4)} Ω.`
        : `I = V/R = ${safe(v, 3)}/${num(params, 'rDevice', 220).toFixed(0)} = ${formatSI(i, 4)} A, so V/I = ${safe(Math.abs(i) > 1e-12 ? v / i : Number.NaN, 1)} Ω is constant, confirming Ohm’s law.`
  };
}

/* ── the apparatus ──────────────────────────────────────────────────────── */

function Stage({ params, set, control }: StageApi) {
  const wiring = str(params, 'wiring', FORWARD_WIRING);
  const { play } = useSound();
  const connect = useConnect({ wiring, onChange: (next) => set('wiring', next), onCue: play });

  const graph = useMemo(() => graphOf(params), [params]);
  const solution = useMemo(() => solveCircuit(graph), [graph]);
  const faults = useMemo(() => detectFaults(graph, solution), [graph, solution]);

  const i = solution.current.get('dev') ?? 0;
  const v = solution.voltage.get('dev') ?? 0;
  const live = Math.abs(solution.current.get('c') ?? 0) > 1e-9;
  const worst = faults[0];
  const device = str(params, 'device', 'silicon');

  return (
    <CircuitBench
      parts={graph.parts}
      wiring={wiring}
      solution={solution}
      connect={connect}
      live={live}
      title={`${isDiodeMode(device) ? DEVICES[device].label : 'Ohmic resistor'} · ${v > 0.02 ? 'forward' : v < -0.02 ? 'reverse' : 'zero'} bias`}
      subtitle={
        worst
          ? worst.message.slice(0, 96)
          : `V = ${safe(v, 3)} V · I = ${formatSI(i, 3)} A · through ${safe(num(params, 'series', 220), 0)} Ω`
      }
    >
      <Knob spec={control('supply', 'slider')} params={params} onChange={set} x={120} y={62} radius={20} label="Supply voltage E — turn the dial" />
      <Knob spec={control('series', 'slider')} params={params} onChange={set} x={255} y={62} radius={20} label="Series resistance — turn the dial" />
      <Knob spec={control('rDevice', 'slider')} params={params} onChange={set} x={390} y={62} radius={20} label="Resistor value — turn the dial" />
      <Knob spec={control('temp', 'slider')} params={params} onChange={set} x={525} y={62} radius={20} label="Bench temperature — turn the dial" />
    </CircuitBench>
  );
}

export default function IvCharacteristicExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={compute}
      renderStage={(api) => <Stage {...api} />}
      viewportOverlay={(params) => {
        const r = readBench(params);
        return (
          <>
            <ViewPill label="V" value={safe(r.deviceVoltage, 3)} unit="V" />
            <ViewPill label="I" value={formatSI(r.deviceCurrent, 3)} unit="A" />
          </>
        );
      }}
      notebook={({ params: p }) => {
        const r = readBench(p);
        return {
          title: `Observation table — I–V characteristic (${str(p, 'device', 'silicon')})`,
          columns: [
            { key: 'v', label: 'V', unit: 'V', precision: 3 },
            { key: 'i', label: 'I', unit: 'mA', precision: 4 },
            { key: 'r', label: 'V/I', unit: 'Ω', precision: 1, derived: true }
          ],
          capture: () => ({ v: r.voltmeter, i: r.ammeter * 1000, r: 0 }),
          derive: (row) => {
            const ii = Number(row.i) / 1000;
            return { ...row, r: Math.abs(ii) < 1e-15 ? Number.NaN : Number(row.v) / ii };
          },
          captureEnabled: !r.faults.some((f) => f.severity === 'error'),
          captureHint: r.faults.some((f) => f.severity === 'error')
            ? 'Fix the wiring before recording — a mis-wired circuit gives no valid reading.'
            : 'Raise the supply in small steps near the knee, then record each pair of readings.'
        };
      }}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education, FORWARD_WIRING, REVERSE_WIRING };
