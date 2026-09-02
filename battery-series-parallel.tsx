import type { EducationPack, ExperimentDefinition, ParamValues, ValidationIssue } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { BatteryCell, Resistor, MeterFace, Switch } from '@/components/instruments/Instruments';
import type { Battery } from '@/physics-engine/circuits';
import {
  cellsInParallel,
  cellsInSeries,
  loopCurrent,
  powerDissipated,
  powerSupplied,
  terminalVoltage
} from '@/physics-engine/circuits';
import { formatSI } from '@/utils/format';
import { col, num, ro, singleSeriesGraph, str } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';

import { meta } from './battery-series-parallel.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#7dd3fc', practicalNo: meta.practicalNo,
  controls: [
    { kind: 'segmented', key: 'mode', label: 'Arrangement', initial: 'series', options: [
      { value: 'series', label: 'Series' }, { value: 'parallel', label: 'Parallel' }
    ] },
    { kind: 'slider', key: 'n', label: 'Number of cells', symbol: 'n', unit: '', min: 1, max: 6, step: 1, initial: 3 },
    { kind: 'slider', key: 'emf', label: 'EMF of each cell', symbol: 'E', unit: 'V', min: 0.5, max: 2.5, step: 0.05, initial: 1.5, precision: 2 },
    { kind: 'slider', key: 'r', label: 'Internal resistance of each cell', symbol: 'r', unit: 'Ω', min: 0.05, max: 5, step: 0.05, initial: 0.5, precision: 2 },
    { kind: 'slider', key: 'R', label: 'External resistance', symbol: 'R', unit: 'Ω', min: 0.5, max: 50, step: 0.5, initial: 10, precision: 1 }
  ],
  defaults: { mode: 'series', n: 3, emf: 1.5, r: 0.5, R: 10 }
};

const education: EducationPack = {
  theory: [
    'A real cell is an emf E in series with its own internal resistance r. When it drives a current I through an external resistance R the terminal voltage is V = E − Ir, so the reading on a voltmeter across the cell is always less than its emf while current flows.',
    'Cells in series add their emfs and their internal resistances: n identical cells give E_total = nE and r_total = nr. The arrangement raises the voltage available but also raises the internal resistance in the same proportion.',
    'Cells in parallel keep the emf of a single cell while the internal resistance falls to r/n, because n equal resistances in parallel divide by n. The arrangement cannot raise the voltage; it lowers the source resistance and shares the current between the cells.',
    'Which arrangement delivers more current depends entirely on the load. The power delivered to R is maximum when R equals the internal resistance of the combination, so series is the better choice for a large R and parallel for a small R.',
    'Cells of unequal emf must never be connected in parallel: the stronger cell drives a circulating current through the weaker one, which wastes energy and can damage the cells.'
  ],
  formulas: [
    { tex: 'V = E - Ir', caption: 'Terminal voltage of a cell carrying current I.' },
    { tex: 'E_{series} = nE, \\quad r_{series} = nr', caption: 'n identical cells in series.' },
    { tex: 'E_{parallel} = E, \\quad r_{parallel} = \\frac{r}{n}', caption: 'n identical cells in parallel.' },
    { tex: 'I = \\frac{E_{total}}{R + r_{total}}', caption: 'Current through the external resistance.' },
    { tex: 'P_{max} \\text{ at } R = r_{total}', caption: 'Maximum power transfer to the load.' }
  ],
  variables: [
    { symbol: 'n', name: 'Number of cells', unit: '—' },
    { symbol: 'E', name: 'EMF of each cell', unit: 'V' },
    { symbol: 'r', name: 'Internal resistance of each cell', unit: 'Ω' },
    { symbol: 'R', name: 'External resistance', unit: 'Ω' },
    { symbol: 'I', name: 'Current in the circuit', unit: 'A' },
    { symbol: 'V', name: 'Terminal voltage', unit: 'V' }
  ],
  procedure: [
    'Set three cells of 1.5 V with an internal resistance of 0.5 Ω each and a 10 Ω load.',
    'Record the current, terminal voltage and power in the series arrangement.',
    'Switch to the parallel arrangement without changing anything else and record the same three quantities.',
    'Sweep the external resistance through its range in each arrangement and note where the two currents cross over.',
    'Check that the power in the load peaks when R equals the internal resistance of the combination.'
  ],
  precautions: [
    'Never connect cells of different emf in parallel; a circulating current will flow between them.',
    'Connect all the positive terminals together and all the negative terminals together in the parallel arrangement.',
    'A low external resistance with cells in parallel can draw a large current; keep the rheostat in circuit while switching.',
    'Read the ammeter with the key closed only for as long as the reading is needed, so the cells do not polarise.'
  ],
  sourcesOfError: [
    'The internal resistance of a cell rises as it discharges, so repeated readings drift.',
    'Contact resistance at the terminals adds to the external resistance.',
    'The ammeter itself has a small resistance that is not accounted for in the calculation.'
  ],
  tips: [
    'A torch bulb is a low-resistance load, which is why lamp batteries are arranged in series for voltage and car batteries use thick plates for a low internal resistance.'
  ],
  viva: [
    { q: 'What is the emf of four 1.5 V cells in series and in parallel?', a: 'In series 6 V; in parallel still 1.5 V, but with a quarter of the internal resistance.' },
    { q: 'When should cells be combined in parallel?', a: 'When the load resistance is small compared with the internal resistance of a single cell, so that the source resistance, not the emf, is what limits the current.' },
    { q: 'Why is the terminal voltage less than the emf?', a: 'Because part of the emf is used up driving the current through the internal resistance: V = E − Ir.' },
    { q: 'State the condition for maximum power transfer.', a: 'The load resistance must equal the internal resistance of the source; the efficiency is then only 50%.' },
    { q: 'What happens if cells of unequal emf are connected in parallel?', a: 'The stronger cell drives a current through the weaker one, heating it and wasting energy.' }
  ],
  resultTemplate: 'The series arrangement gives the larger current for a high external resistance and the parallel arrangement for a low one; the readings agree with I = E/(R + r).'
};

const CELLS_MAX = 6;

function bankOf(params: ParamValues): Battery {
  const n = Math.max(1, Math.round(num(params, 'n', 3)));
  const emf = num(params, 'emf', 1.5);
  const r = num(params, 'r', 0.5);
  const cells: Battery[] = Array.from({ length: n }, () => ({ emf, internalResistance: r }));
  return str(params, 'mode', 'series') === 'parallel' ? cellsInParallel(cells) : cellsInSeries(cells);
}

function compute(params: ParamValues): ModelOutput {
  const R = num(params, 'R', 10);
  const emf = num(params, 'emf', 1.5);
  const r = num(params, 'r', 0.5);
  const n = Math.max(1, Math.round(num(params, 'n', 3)));
  const parallel = str(params, 'mode', 'series') === 'parallel';
  const bank = bankOf(params);
  const I = loopCurrent(bank, R);
  const V = terminalVoltage(bank, I);
  const pLoad = powerDissipated(I, R);
  const pTotal = powerSupplied(I, bank.emf);

  const currentAt = (load: number): number => loopCurrent(bank, load);
  const points: { x: number; y: number }[] = [];
  for (let load = 0.5; load <= 50.001; load += 0.5) {
    points.push({ x: load, y: currentAt(load) });
  }

  const issues: ValidationIssue[] = [];
  if (R < bank.internalResistance) {
    issues.push({
      field: 'R',
      severity: 'warning',
      message: `The load is smaller than the internal resistance of the combination (${formatSI(bank.internalResistance, 3)} Ω), so most of the power is wasted inside the cells. ${parallel ? 'This is where the parallel arrangement wins.' : 'Try the parallel arrangement here.'}`
    });
  }
  if (parallel && Math.abs(emf - 1.5) > 1e-9 && n > 1) {
    issues.push({
      field: 'emf',
      severity: 'warning',
      message: 'The model assumes identical cells. Real cells in parallel must match in emf, otherwise a circulating current flows between them.'
    });
  }

  return {
    readouts: [
      ro('E', 'Total EMF', bank.emf, 'V', 3, { sub: parallel ? `unchanged at ${emf.toFixed(2)} V` : `${n} × ${emf.toFixed(2)} V` }),
      ro('r', 'Internal resistance', bank.internalResistance, 'Ω', 3, { sub: parallel ? `${r.toFixed(2)}/${n}` : `${n} × ${r.toFixed(2)}` }),
      ro('I', 'Current', I, 'A', 4),
      ro('V', 'Terminal voltage', V, 'V', 3, { sub: `loss ${formatSI(bank.emf - V, 3)} V` }),
      ro('P', 'Power in the load', pLoad, 'W', 4),
      ro('eff', 'Efficiency', pTotal > 0 ? (pLoad / pTotal) * 100 : 0, '%', 1, { tone: R >= bank.internalResistance ? 'normal' : 'alert', sub: `R/r = ${(R / bank.internalResistance).toFixed(2)}` })
    ],
    graph: singleSeriesGraph({
      title: 'Current against external resistance', xLabel: 'R (Ω)', yLabel: 'I (A)',
      seriesLabel: parallel ? 'parallel' : 'series', color: parallel ? '#9d8cff' : '#7dd3fc',
      points, live: { x: R, y: I },
      markers: [{ x: bank.internalResistance, y: loopCurrent(bank, bank.internalResistance), label: 'R = r', color: '#ffc65c' }]
    }),
    live: { x: R, y: I },
    description: `${n} cells of ${emf.toFixed(2)} V and ${r.toFixed(2)} Ω internal resistance are connected in ${parallel ? 'parallel' : 'series'} across ${R.toFixed(1)} Ω. The combination has an emf of ${formatSI(bank.emf, 3)} V and an internal resistance of ${formatSI(bank.internalResistance, 3)} Ω, and drives ${formatSI(I, 3)} A.`,
    result: `${parallel ? 'Parallel' : 'Series'} connection of ${n} cells gives E = ${formatSI(bank.emf, 3)} V and r = ${formatSI(bank.internalResistance, 3)} Ω, so I = E/(R + r) = ${formatSI(I, 3)} A through ${R.toFixed(1)} Ω, with a terminal voltage of ${formatSI(V, 3)} V and ${formatSI(pLoad, 3)} W in the load (${((pLoad / Math.max(pTotal, 1e-12)) * 100).toFixed(1)}% of the power supplied).`,
    issues
  };
}

function Stage({ params, set, control }: StageApi) {
  const parallel = str(params, 'mode', 'series') === 'parallel';
  const n = Math.max(1, Math.round(num(params, 'n', 3)));
  const emf = num(params, 'emf', 1.5);
  const R = num(params, 'R', 10);
  const bank = bankOf(params);
  const I = loopCurrent(bank, R);
  const drawn = Math.min(n, CELLS_MAX);
  const slots = Array.from({ length: drawn }, (_, i) => i);

  return (
    <svg viewBox="0 0 820 440" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <text x={410} y={44} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
        {n} cells in {parallel ? 'parallel' : 'series'} · E = {formatSI(bank.emf, 3)} V · r = {formatSI(bank.internalResistance, 3)} Ω
      </text>
      {parallel ? (
        <g>
          {slots.map((i) => {
            const y = 110 + i * ((240 - 60) / Math.max(drawn - 1, 1));
            return (
              <g key={i}>
                <path d={`M170 ${y} H250`} className="lead" stroke="#8497ad" />
                <BatteryCell x={250} y={y} emf={emf} live />
                <path d={`M320 ${y} H400`} className="lead" stroke="#8497ad" />
              </g>
            );
          })}
          <path d={`M170 110 V${110 + (drawn - 1) * ((240 - 60) / Math.max(drawn - 1, 1))}`} className="lead" stroke="#8497ad" />
          <path d={`M400 110 V${110 + (drawn - 1) * ((240 - 60) / Math.max(drawn - 1, 1))}`} className="lead" stroke="#8497ad" />
        </g>
      ) : (
        <g>
          {slots.map((i) => (
            <g key={i}>
              <BatteryCell x={170 + i * 62} y={170} emf={emf} live />
              {i < drawn - 1 ? <path d={`M${232 + i * 62} 170 H${240 + i * 62}`} className="lead" stroke="#8497ad" /> : null}
            </g>
          ))}
        </g>
      )}
      <path d="M170 170 V330 H650 V170" className="lead" stroke="#8497ad" fill="none" />
      {parallel ? <path d="M400 170 H650" className="lead" stroke="#8497ad" /> : null}
      <Switch x={440} y={330} closed label="key" />
      <Resistor x={540} y={330} label="R" value={`${R.toFixed(1)} Ω`} live />
      <MeterFace x={650} y={250} symbol="A" label="ammeter" deflection={Math.min(1, I / 2)} value={`${formatSI(I, 3)} A`} />
      <text x={410} y={400} textAnchor="middle" fontSize={11} fill="#8497ad" fontFamily="ui-monospace, monospace">
        I = E/(R + r) = {formatSI(bank.emf, 3)}/({R.toFixed(1)} + {formatSI(bank.internalResistance, 3)}) = {formatSI(I, 3)} A
      </text>
      <Knob
        spec={control('R', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={80}
        y={90}
        radius={18}
        label="Load resistance R"
      />
      <Knob
        spec={control('n', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={740}
        y={90}
        radius={18}
        label="Number of cells n"
      />
        </svg>
  );
}

export default function BatteryCombinationExperiment() {
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} />}
      notebook={({ params: p }) => {
        const bank = bankOf(p);
        const R = num(p, 'R', 10);
        const I = loopCurrent(bank, R);
        return {
          title: 'Observation table — cells in series and in parallel',
          columns: [
            col('mode', 'Arrangement', '—', 0),
            col('n', 'Cells', '—', 0),
            col('E', 'Total EMF', 'V', 3),
            col('r', 'Internal r', 'Ω', 3),
            col('R', 'Load R', 'Ω', 1),
            col('I', 'Current', 'A', 4),
            col('P', 'Power', 'W', 4, true)
          ],
          capture: () => ({
            mode: str(p, 'mode', 'series') === 'parallel' ? 1 : 0,
            n: Math.round(num(p, 'n', 3)),
            E: bank.emf,
            r: bank.internalResistance,
            R,
            I,
            P: 0
          }),
          derive: (row) => ({ ...row, P: powerDissipated(Number(row.I), Number(row.R)) })
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
