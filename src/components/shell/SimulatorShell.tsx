import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { EducationPack, ExperimentDefinition, NotebookSpec, SliderControl } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import type { LabState } from '@/hooks/useLabState';
import type { NotebookRow } from '@/hooks/useNotebook';
import { Viewport } from '@/components/shell/Viewport';
import { Controls } from '@/components/controls/Controls';
import { LineChart } from '@/components/charts/LineChart';
import { LabNotebook } from '@/components/lab-notebook/LabNotebook';
import { Tex } from '@/components/math/Tex';
import { Icons } from '@/components/common/Icons';
import { Chip } from '@/components/common/UI';
import { formatFixed, formatSI } from '@/utils/format';
import { unitInfo } from '@/data/units';
import { useLocalized } from '@/i18n';

const TABS = ['theory', 'formulae', 'variables', 'procedure', 'precautions', 'viva'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  theory: 'Theory',
  formulae: 'Formulae',
  variables: 'Variables',
  procedure: 'Procedure',
  precautions: 'Precautions',
  viva: 'Viva'
};

export interface SimulatorShellProps {
  definition: ExperimentDefinition;
  education: EducationPack;
  model: ModelOutput;
  lab: LabState;
  stage: ReactNode;
  overlay?: ReactNode;
  notebookSpec?: NotebookSpec;
  notebookRows: NotebookRow[];
  onRecord: () => void;
  onRemoveRow: (n: number) => void;
  onClearNotebook: () => void;
}

/** Chrome around one apparatus: header, viewport, readouts, graph, notebook, tabs. */
export function SimulatorShell({
  definition,
  education,
  model,
  lab,
  stage,
  overlay,
  notebookSpec,
  notebookRows,
  onRecord,
  onRemoveRow,
  onClearNotebook
}: SimulatorShellProps) {
  const [tab, setTab] = useState<Tab>('theory');
  const { unitLabel } = useLocalized();
  const info = unitInfo(definition.unit);

  // Controls not pinned to the apparatus fall back to the dock beneath it.
  const dockControls = useMemo(
    () => definition.controls.filter((c) => !c.onStage && !('stage' in c && c.stage)),
    [definition.controls]
  );

  const issues = model.issues ?? [];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <article className="simulator">
      <header className="sim-head page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/simulators">Simulators</Link>
          <Icons.ChevronRight width={11} height={11} />
          <Link to={info?.href ?? '/class-12'}>{unitLabel(definition.unit, info?.label ?? definition.chapter)}</Link>
        </nav>
        <div className="sim-head-main">
          <div>
            <p className="eyebrow">{definition.chapter}</p>
            <h1>{definition.title}</h1>
            <p className="sim-aim">{definition.aim}</p>
          </div>
          <div className="sim-head-chips">
            <Chip tone={definition.kind === 'practical' ? 'primary' : 'ghost'}>{definition.kind}</Chip>
            <Chip tone="ghost">{definition.difficulty}</Chip>
            <button type="button" className="btn btn-sm btn-ghost" onClick={lab.reset} disabled={!lab.dirty}>
              <Icons.Reset width={13} height={13} /> Reset apparatus
            </button>
          </div>
        </div>
      </header>

      <div className="page sim-grid">
        <div className="sim-main">
          <Viewport overlay={overlay} caption={model.description}>
            {stage}
          </Viewport>

          {errors.length > 0 || warnings.length > 0 ? (
            <ul className="issue-list" aria-live="polite">
              {[...errors, ...warnings].map((i, k) => (
                <li key={`${i.field}-${k}`} className={`callout callout-${i.severity === 'error' ? 'danger' : 'warning'}`}>
                  <Icons.Warning width={14} height={14} />
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {dockControls.length > 0 ? (
            <Controls specs={dockControls} params={lab.params} onChange={lab.set} />
          ) : null}
        </div>

        <aside className="sim-side">
          <section className="panel" aria-labelledby="measurements-title">
            <header className="panel-head">
              <h2 id="measurements-title">
                <Icons.Target width={15} height={15} /> Measurements
              </h2>
            </header>
            <div className="panel-body readout-grid">
              {model.readouts.map((r) => (
                <div key={r.key} className={`readout-cell tone-${r.tone ?? 'normal'}`}>
                  <span className="readout-label">{r.label}</span>
                  <span className="readout">
                    {r.text ?? formatDisplay(r.value, r.precision)}
                    {r.unit ? <i> {r.unit}</i> : null}
                  </span>
                  {r.sub ? <span className="readout-sub">{r.sub}</span> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="graph-title">
            <header className="panel-head">
              <h2 id="graph-title">
                <Icons.Chart width={15} height={15} /> Graph
              </h2>
            </header>
            <div className="panel-body">
              <LineChart spec={model.graph} />
            </div>
          </section>
        </aside>
      </div>

      <div className="page">
        <section className="panel result-panel">
          <header className="panel-head">
            <h2>Result</h2>
          </header>
          <div className="panel-body">
            <p>{model.result}</p>
            <p className="muted">{education.resultTemplate}</p>
          </div>
        </section>

        {notebookSpec ? (
          <LabNotebook
            spec={notebookSpec}
            rows={notebookRows}
            onRecord={onRecord}
            onRemove={onRemoveRow}
            onClear={onClearNotebook}
          />
        ) : null}

        <section className="panel education">
          <div className="tabs" role="tablist" aria-label="Study material">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`panel-${t}`}
                tabIndex={tab === t ? 0 : -1}
                className={`tab${tab === t ? ' is-active' : ''}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="panel-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'theory' ? (
              <div className="prose">
                {education.theory.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {education.tips?.length ? (
                  <>
                    <h3>Try this</h3>
                    <ul>
                      {education.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}

            {tab === 'formulae' ? (
              <ul className="formula-list">
                {education.formulas.map((f, i) => (
                  <li key={i}>
                    <Tex block>{f.tex}</Tex>
                    {f.caption ? <span className="muted">{f.caption}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === 'variables' ? (
              <div className="table-scroll">
                <table className="var-table">
                  <thead>
                    <tr>
                      <th scope="col">Symbol</th>
                      <th scope="col">Quantity</th>
                      <th scope="col">SI unit</th>
                      <th scope="col">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {education.variables.map((v) => (
                      <tr key={v.symbol + v.name}>
                        <td>
                          <Tex>{v.symbol}</Tex>
                        </td>
                        <td>{v.name}</td>
                        <td>{v.unit || '—'}</td>
                        <td className="muted">{v.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {tab === 'procedure' ? (
              <ol className="prose numbered">
                {education.procedure.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            ) : null}

            {tab === 'precautions' ? (
              <div className="prose">
                <ul>
                  {education.precautions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                {education.sourcesOfError?.length ? (
                  <>
                    <h3>Sources of error</h3>
                    <ul>
                      {education.sourcesOfError.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}

            {tab === 'viva' ? (
              <dl className="viva-list">
                {education.viva.map((v, i) => (
                  <div key={i}>
                    <dt>{v.q}</dt>
                    <dd>{v.a}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
      </div>
    </article>
  );
}

/** Small values get an SI prefix; ordinary bench readings stay fixed-point. */
function formatDisplay(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e5)) return formatSI(value, Math.max(precision, 3));
  return formatFixed(value, precision);
}

export type { SliderControl };
