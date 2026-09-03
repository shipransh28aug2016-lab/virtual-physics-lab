import { useCallback, useEffect, useState } from 'react';
import type { ObservationRow } from '@/types/lab';
import { readJSON, removeKey, writeJSON } from '@/utils/storage';

export interface NotebookRow extends ObservationRow {
  /** Monotonic trial number, stable across deletions. */
  __n: number;
}

export interface Notebook {
  rows: NotebookRow[];
  record: (row: ObservationRow) => void;
  removeRow: (n: number) => void;
  clear: () => void;
}

const key = (slug: string) => `notebook:${slug}`;
const MAX_ROWS = 60;

/** Per-experiment observation table, persisted so a session survives a reload. */
export function useNotebook(slug: string): Notebook {
  const [rows, setRows] = useState<NotebookRow[]>(() => readJSON<NotebookRow[]>(key(slug), []));

  // Switching experiments swaps the table rather than merging the two.
  useEffect(() => {
    setRows(readJSON<NotebookRow[]>(key(slug), []));
  }, [slug]);

  useEffect(() => {
    if (rows.length === 0) removeKey(key(slug));
    else writeJSON(key(slug), rows);
  }, [rows, slug]);

  const record = useCallback((row: ObservationRow) => {
    setRows((r) => {
      const next = r.length >= MAX_ROWS ? r.slice(1) : r;
      const n = next.reduce((m, x) => Math.max(m, x.__n), 0) + 1;
      return [...next, { ...row, __n: n }];
    });
  }, []);

  const removeRow = useCallback((n: number) => {
    setRows((r) => r.filter((x) => x.__n !== n));
  }, []);

  const clear = useCallback(() => setRows([]), []);

  return { rows, record, removeRow, clear };
}
