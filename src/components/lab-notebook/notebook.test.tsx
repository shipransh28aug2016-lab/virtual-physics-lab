import { describe, expect, it } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NotebookSpec } from '@/types/lab';
import type { NotebookRow } from '@/hooks/useNotebook';
import { notebookCsv } from './csv';
import { LabNotebook } from './LabNotebook';

const spec: NotebookSpec = {
  title: 'Observation table — V–I characteristic',
  columns: [
    { key: 'v', label: 'V', unit: 'V', precision: 3 },
    { key: 'i', label: 'I', unit: 'A', precision: 4 },
    { key: 'r', label: 'R = V/I', unit: 'Ω', precision: 2, derived: true }
  ],
  capture: () => ({ v: 3, i: 0.15, r: 0 }),
  derive: (row) => ({ ...row, r: Number(row.v) / Number(row.i) }),
  comparison: { label: 'resistance', unit: 'Ω', experimental: 19.9, theoretical: 20, precision: 2 }
};

const rows: NotebookRow[] = [
  { __n: 1, __t: Date.UTC(2026, 0, 2, 9, 30), __note: 'rheostat at max', __settings: 'Battery emf 6 V; Load resistance 20 Ω', v: 3, i: 0.15, r: 0 },
  { __n: 2, __t: Date.UTC(2026, 0, 2, 9, 32), __note: '', __settings: 'Battery emf 6 V; Load resistance 20 Ω', v: 4, i: 0.2, r: 0 }
];

describe('CSV export', () => {
  const csv = () =>
    notebookCsv({ title: 'Ohm’s law', spec, rows, conclusion: 'V ∝ I, so the conductor is ohmic.', comparison: spec.comparison });

  it('heads the file with the experiment and the table', () => {
    const lines = csv().split('\r\n');
    expect(lines[0]).toContain('Ohm');
    expect(lines[1]).toContain('Observation table');
  });

  it('names every column with its unit', () => {
    expect(csv()).toContain('Trial,V (V),I (A),R = V/I (Ω),Recorded at,Apparatus settings,Note');
  });

  it('computes the derived column rather than exporting the captured zero', () => {
    const line = csv().split('\r\n').find((l) => l.startsWith('1,'));
    expect(line).toContain('20.00'); // 3 / 0.15
    expect(line).not.toMatch(/^1,3\.000,0\.1500,0\.00/);
  });

  it('carries the timestamp, the apparatus settings and the note', () => {
    const line = csv().split('\r\n').find((l) => l.startsWith('1,')) ?? '';
    expect(line).toContain('2026-01-02T09:30');
    expect(line).toContain('rheostat at max');
    expect(line).toContain('Battery emf 6 V');
  });

  it('quotes a field containing a comma, and doubles an embedded quote', () => {
    const csvText = notebookCsv({
      title: 'x',
      spec,
      rows: [{ ...rows[0], __note: 'heated, then cooled; said "ok"' }],
      conclusion: ''
    });
    expect(csvText).toContain('"heated, then cooled; said ""ok"""');
  });

  it('ends with the comparison and the conclusion', () => {
    const text = csv();
    expect(text).toContain('Percentage error');
    expect(text).toContain('-0.50%');
    expect(text).toContain('V ∝ I, so the conductor is ohmic.');
  });

  it('omits the conclusion block when there is nothing written', () => {
    expect(notebookCsv({ title: 'x', spec, rows, conclusion: '   ' })).not.toContain('Conclusion');
  });
});

describe('the notebook table', () => {
  const mount = (extra: Partial<React.ComponentProps<typeof LabNotebook>> = {}) =>
    render(
      <LabNotebook
        spec={spec}
        rows={rows}
        title="Ohm’s law"
        slug="ohms-law"
        conclusion=""
        onRecord={() => undefined}
        onRemove={() => undefined}
        onAnnotate={() => undefined}
        onConclusion={() => undefined}
        onClear={() => undefined}
        {...extra}
      />
    );

  it('shows a derived column computed from the captured row', () => {
    mount();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row').length).toBe(3); // header + 2 trials
    expect(table.textContent).toContain('20.00');
    cleanup();
  });

  it('gives every note field its own accessible name', () => {
    mount();
    expect(screen.getByRole('textbox', { name: /note against trial 1/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /note against trial 2/i })).toBeInTheDocument();
    cleanup();
  });

  it('reports a typed note back to the owner of the state', async () => {
    const user = userEvent.setup();
    const seen: [number, string][] = [];
    mount({ onAnnotate: (n, note) => seen.push([n, note]) });
    await user.type(screen.getByRole('textbox', { name: /note against trial 2/i }), 'x');
    expect(seen).toEqual([[2, 'x']]);
    cleanup();
  });

  it('offers a conclusion box once there is something to conclude from', () => {
    mount();
    expect(screen.getByLabelText(/conclusion/i)).toBeInTheDocument();
    cleanup();

    mount({ rows: [] });
    expect(screen.queryByLabelText(/conclusion/i)).toBeNull();
    cleanup();
  });

  it('disables export and clear while the table is empty', () => {
    mount({ rows: [] });
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    cleanup();
  });

  it('offers the text to copy when the browser refuses the download', async () => {
    const user = userEvent.setup();
    const original = URL.createObjectURL;
    // Some file:// sandboxes refuse object URLs; the export must not silently
    // do nothing.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = undefined;
    mount();
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    expect(screen.getByLabelText(/would not start the download/i)).toBeInTheDocument();
    URL.createObjectURL = original;
    cleanup();
  });
});
