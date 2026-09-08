import { useCallback, useEffect, useState } from 'react';
import type { ObservationRow } from '@/types/lab';
import { readJSON, removeKey, writeJSON } from '@/utils/storage';

export interface NotebookRow extends ObservationRow {
  /** Monotonic trial number, stable across deletions. */
  __n: number;
  /** When the trial was recorded, epoch milliseconds. Zero for a legacy row. */
  __t: number;
  /** The student's own note against this trial. */
  __note: string;
  /** What the apparatus was set to when the reading was taken. */
  __settings: string;
}

export interface Notebook {
  rows: NotebookRow[];
  /** The student's conclusion for this experiment, persisted with the table. */
  conclusion: string;
  record: (row: ObservationRow, settings?: string) => void;
  removeRow: (n: number) => void;
  annotate: (n: number, note: string) => void;
  setConclusion: (text: string) => void;
  clear: () => void;
}

/** Fills in the fields a table saved before 2.0 does not carry. */
const hydrate = (rows: NotebookRow[]): NotebookRow[] =>
  rows.map((r) => ({
    ...r,
    __t: r.__t ?? 0,
    __note: r.__note ?? '',
    __settings: r.__settings ?? ''
  }));

const key = (slug: string) => `notebook:${slug}`;
const conclusionKey = (slug: string) => `notebook-conclusion:${slug}`;
const MAX_ROWS = 60;

/**
 * Per-experiment observation table, persisted so a session survives a reload.
 *
 * A trial carries more than its numbers: when it was taken, what the apparatus
 * was set to, and whatever the student wrote against it. Those travel with the
 * row into the CSV export, which is what makes the table a record of an
 * experiment rather than a scratchpad.
 */
export function useNotebook(slug: string): Notebook {
  const [rows, setRows] = useState<NotebookRow[]>(() => hydrate(readJSON<NotebookRow[]>(key(slug), [])));
  const [conclusion, setConclusionState] = useState<string>(() =>
    readJSON<string>(conclusionKey(slug), '')
  );

  // Switching experiments swaps the table rather than merging the two.
  useEffect(() => {
    setRows(hydrate(readJSON<NotebookRow[]>(key(slug), [])));
    setConclusionState(readJSON<string>(conclusionKey(slug), ''));
  }, [slug]);

  useEffect(() => {
    if (rows.length === 0) removeKey(key(slug));
    else writeJSON(key(slug), rows);
  }, [rows, slug]);

  useEffect(() => {
    if (conclusion) writeJSON(conclusionKey(slug), conclusion);
    else removeKey(conclusionKey(slug));
  }, [conclusion, slug]);

  const record = useCallback((row: ObservationRow, settings?: string) => {
    setRows((r) => {
      const next = r.length >= MAX_ROWS ? r.slice(1) : r;
      const n = next.reduce((m, x) => Math.max(m, x.__n), 0) + 1;
      return [...next, { ...row, __n: n, __t: Date.now(), __note: '', __settings: settings ?? '' }];
    });
  }, []);

  const removeRow = useCallback((n: number) => {
    setRows((r) => r.filter((x) => x.__n !== n));
  }, []);

  const annotate = useCallback((n: number, note: string) => {
    setRows((r) => r.map((x) => (x.__n === n ? { ...x, __note: note } : x)));
  }, []);

  const setConclusion = useCallback((text: string) => setConclusionState(text), []);

  const clear = useCallback(() => {
    setRows([]);
    setConclusionState('');
  }, []);

  return { rows, conclusion, record, removeRow, annotate, setConclusion, clear };
}
