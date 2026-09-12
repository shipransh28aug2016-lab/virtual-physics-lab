import type { NotebookComparison, NotebookSpec } from '@/types/lab';
import type { NotebookRow } from '@/hooks/useNotebook';
import { formatFixed, percentError } from '@/utils/format';

/** Quotes a field for CSV. Anything with a comma, quote or newline is wrapped. */
const cell = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface CsvOptions {
  title: string;
  spec: NotebookSpec;
  rows: NotebookRow[];
  conclusion: string;
  comparison?: NotebookComparison;
}

/**
 * The observation table as CSV: a header naming the experiment, one line per
 * trial with its timestamp, apparatus settings and note, then the
 * theory-against-experiment comparison and the student's conclusion.
 *
 * Pure — the caller decides how to hand it to the student, so this is testable
 * without a DOM.
 */
export function notebookCsv({ title, spec, rows, conclusion, comparison }: CsvOptions): string {
  const lines: string[] = [];
  lines.push([cell(title)].join(','));
  lines.push([cell(spec.title)].join(','));
  lines.push('');

  const head = [
    'Trial',
    ...spec.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)),
    'Recorded at',
    'Apparatus settings',
    'Note'
  ];
  lines.push(head.map(cell).join(','));

  for (const row of rows) {
    const derived = spec.derive ? spec.derive(row) : row;
    lines.push(
      [
        row.__n,
        ...spec.columns.map((c) => {
          const v = derived[c.key];
          return typeof v === 'number' ? formatFixed(v, c.precision ?? 3) : (v ?? '');
        }),
        row.__t ? new Date(row.__t).toISOString() : '',
        row.__settings,
        row.__note
      ]
        .map(cell)
        .join(',')
    );
  }

  if (comparison) {
    const err = percentError(comparison.experimental, comparison.theoretical);
    lines.push('');
    lines.push([cell(`Experimental ${comparison.label} (${comparison.unit})`), cell(formatFixed(comparison.experimental, comparison.precision ?? 3))].join(','));
    lines.push([cell(`Theoretical ${comparison.label} (${comparison.unit})`), cell(formatFixed(comparison.theoretical, comparison.precision ?? 3))].join(','));
    lines.push([cell('Percentage error'), cell(Number.isFinite(err) ? `${err.toFixed(2)}%` : '')].join(','));
  }

  if (conclusion.trim()) {
    lines.push('');
    lines.push([cell('Conclusion'), cell(conclusion.trim())].join(','));
  }

  return lines.join('\r\n');
}

/**
 * Hands the CSV to the student as a download. Returns false when the browser
 * refuses — some `file://` sandboxes do — so the caller can fall back to
 * showing the text for manual copying rather than failing silently.
 */
export function downloadCsv(filename: string, csv: string): boolean {
  try {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
    // A BOM so a spreadsheet opens the file as UTF-8 and keeps the Ω and the µ.
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
