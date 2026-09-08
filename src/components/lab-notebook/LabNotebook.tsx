import { useMemo, useState } from 'react';
import type { NotebookSpec } from '@/types/lab';
import type { NotebookRow } from '@/hooks/useNotebook';
import { formatFixed, percentError } from '@/utils/format';
import { Icons } from '@/components/common/Icons';
import { EmptyState } from '@/components/common/UI';
import { downloadCsv, notebookCsv } from './csv';

export interface LabNotebookProps {
  spec: NotebookSpec;
  rows: NotebookRow[];
  /** The experiment's title, used to head the export. */
  title: string;
  /** Filename stem for the export. */
  slug: string;
  conclusion: string;
  onRecord: () => void;
  onRemove: (n: number) => void;
  onAnnotate: (n: number, note: string) => void;
  onConclusion: (text: string) => void;
  onClear: () => void;
}

/** Local time of a recorded trial, or an em dash for a row saved before 2.0. */
const timeOf = (t: number): string =>
  t ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * The observation table. Rows are captured from the live model, derived columns
 * are recomputed on render, and the comparison foot pits the experimental mean
 * against the theoretical value — real error analysis, not a decoration.
 */
export function LabNotebook({
  spec,
  rows,
  title,
  slug,
  conclusion,
  onRecord,
  onRemove,
  onAnnotate,
  onConclusion,
  onClear
}: LabNotebookProps) {
  // Set when a browser refuses the download — some file:// sandboxes do — so
  // the student is offered the text to copy instead of nothing happening.
  const [fallbackCsv, setFallbackCsv] = useState<string | null>(null);
  const derived = useMemo<NotebookRow[]>(
    () => rows.map((r) => ({ ...r, ...(spec.derive ? spec.derive(r) : r) })),
    [rows, spec]
  );

  const comparison = spec.comparison;
  const meanError = comparison ? percentError(comparison.experimental, comparison.theoretical) : Number.NaN;
  const canRecord = spec.captureEnabled ?? true;

  return (
    <section className="panel notebook" aria-labelledby="notebook-title">
      <header className="panel-head">
        <h2 id="notebook-title">
          <Icons.Notebook width={15} height={15} /> Lab notebook
        </h2>
        <div className="row">
          <button type="button" className="btn btn-sm btn-primary" onClick={onRecord} disabled={!canRecord}>
            <Icons.Plus width={13} height={13} /> Record reading
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={rows.length === 0}
            onClick={() => {
              const csv = notebookCsv({ title, spec, rows, conclusion, comparison });
              setFallbackCsv(downloadCsv(`${slug}-observations.csv`, csv) ? null : csv);
            }}
          >
            <Icons.Download width={13} height={13} /> Export CSV
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClear} disabled={rows.length === 0}>
            <Icons.Trash width={13} height={13} /> Clear
          </button>
        </div>
      </header>

      <div className="panel-body">
        <p className="notebook-title">{spec.title}</p>
        {spec.captureHint ? <p className="muted notebook-hint">{spec.captureHint}</p> : null}

        {derived.length === 0 ? (
          <EmptyState title="No trials recorded yet">
            Set the apparatus, then press <b>Record reading</b> to add a row to the observation table.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="notebook-table">
              <caption className="sr-only">{spec.title}</caption>
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  {spec.columns.map((c) => (
                    <th key={c.key} scope="col">
                      {c.label}
                      {c.unit ? <span className="col-unit"> ({c.unit})</span> : null}
                      {c.derived ? <span className="col-derived" title="Derived column"> ƒ</span> : null}
                    </th>
                  ))}
                  <th scope="col">Note</th>
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {derived.map((row) => (
                  <tr key={row.__n}>
                    <td title={`Recorded at ${timeOf(row.__t)}${row.__settings ? ` · ${row.__settings}` : ''}`}>
                      {row.__n}
                    </td>
                    {spec.columns.map((c) => {
                      const v = row[c.key];
                      return (
                        <td key={c.key} className="readout">
                          {typeof v === 'number' ? formatFixed(v, c.precision ?? 3) : (v ?? '—')}
                        </td>
                      );
                    })}
                    <td>
                      <input
                        type="text"
                        className="notebook-note"
                        value={row.__note}
                        onChange={(e) => onAnnotate(row.__n, e.target.value)}
                        aria-label={`Note against trial ${row.__n}`}
                        placeholder="—"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onRemove(row.__n)}
                        aria-label={`Remove trial ${row.__n}`}
                      >
                        <Icons.Trash width={13} height={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {comparison ? (
          <dl className="notebook-compare">
            <div>
              <dt>Experimental {comparison.label}</dt>
              <dd className="readout">
                {formatFixed(comparison.experimental, comparison.precision ?? 3)} {comparison.unit}
              </dd>
            </div>
            <div>
              <dt>Theoretical {comparison.label}</dt>
              <dd className="readout">
                {formatFixed(comparison.theoretical, comparison.precision ?? 3)} {comparison.unit}
              </dd>
            </div>
            <div>
              <dt>Percentage error</dt>
              <dd className={`readout${Math.abs(meanError) > 5 ? ' is-alert' : ''}`}>
                {Number.isFinite(meanError) ? `${meanError > 0 ? '+' : ''}${meanError.toFixed(2)} %` : '—'}
              </dd>
            </div>
          </dl>
        ) : null}

        {fallbackCsv !== null ? (
          <div className="notebook-fallback">
            <label htmlFor="csv-fallback">
              This browser would not start the download. Select the text below and copy it.
            </label>
            <textarea id="csv-fallback" readOnly rows={6} value={fallbackCsv} />
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="notebook-conclusion">
            <label htmlFor={`conclusion-${slug}`}>Conclusion</label>
            <textarea
              id={`conclusion-${slug}`}
              rows={3}
              value={conclusion}
              onChange={(e) => onConclusion(e.target.value)}
              placeholder="What do the readings show? State the result with its unit, and say how it compares with the theoretical value."
            />
          </div>
        ) : null}

        {spec.extraFoot?.length ? (
          <dl className="notebook-foot">
            {spec.extraFoot.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd className="readout">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
