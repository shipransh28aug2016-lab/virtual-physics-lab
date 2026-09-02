import { useMemo } from 'react';
import type { NotebookSpec } from '@/types/lab';
import type { NotebookRow } from '@/hooks/useNotebook';
import { formatFixed, percentError } from '@/utils/format';
import { Icons } from '@/components/common/Icons';
import { EmptyState } from '@/components/common/UI';

export interface LabNotebookProps {
  spec: NotebookSpec;
  rows: NotebookRow[];
  onRecord: () => void;
  onRemove: (n: number) => void;
  onClear: () => void;
}

/**
 * The observation table. Rows are captured from the live model, derived columns
 * are recomputed on render, and the comparison foot pits the experimental mean
 * against the theoretical value — real error analysis, not a decoration.
 */
export function LabNotebook({ spec, rows, onRecord, onRemove, onClear }: LabNotebookProps) {
  const derived = useMemo<NotebookRow[]>(
    () => rows.map((r) => ({ ...(spec.derive ? spec.derive(r) : r), __n: r.__n })),
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
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {derived.map((row) => (
                  <tr key={row.__n}>
                    <td>{row.__n}</td>
                    {spec.columns.map((c) => {
                      const v = row[c.key];
                      return (
                        <td key={c.key} className="readout">
                          {typeof v === 'number' ? formatFixed(v, c.precision ?? 3) : (v ?? '—')}
                        </td>
                      );
                    })}
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
