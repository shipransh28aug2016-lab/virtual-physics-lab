import { describe, expect, it } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType } from 'react';
import { EXPERIMENTS } from '@/experiments/registry';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { initialParams } from '@/hooks/useLabState';

interface SimulatorModule {
  default: ComponentType;
  definition: ExperimentDefinition;
  education: EducationPack;
  compute?: (params: ParamValues) => ModelOutput;
}

// Every simulator is loaded once and reused across the checks below.
const modules = await Promise.all(
  EXPERIMENTS.map(async (e) => ({
    meta: e.meta,
    mod: (await e.load()) as unknown as SimulatorModule
  }))
);

const cases = modules.map((m) => [m.meta.slug, m] as const);

function mount(Component: ComponentType) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreferencesProvider>
        <Component />
      </PreferencesProvider>
    </MemoryRouter>
  );
}

/** Every finite number the model produced, flattened for a NaN sweep. */
function numbersOf(out: ModelOutput): number[] {
  const nums: number[] = out.readouts.map((r) => r.value);
  for (const s of out.graph.series) for (const p of s.points) nums.push(p.x, p.y);
  for (const m of out.graph.markers ?? []) nums.push(m.x, m.y);
  for (const g of out.graph.guides ?? []) nums.push(g.value);
  if (out.live) nums.push(out.live.x, out.live.y);
  return nums;
}

describe.each(cases)('%s', (slug, entry) => {
  const { definition, education, compute } = entry.mod;

  it('exports a definition that matches the catalogue listing it claims', () => {
    expect(definition.slug).toBe(entry.meta.slug);
    expect(definition.id).toBe(entry.meta.id);
    expect(definition.title).toBe(entry.meta.title);
    expect(definition.unit).toBe(entry.meta.unit);
    expect(definition.kind).toBe(entry.meta.kind);
    if (entry.meta.practicalNo) expect(definition.practicalNo).toBe(entry.meta.practicalNo);
  });

  it('declares controls that are consistent with its defaults', () => {
    expect(definition.controls.length).toBeGreaterThan(0);
    const keys = definition.controls.map((c) => c.key);
    expect(new Set(keys).size, `${slug} has duplicate control keys`).toBe(keys.length);

    for (const c of definition.controls) {
      expect(c.label.length, `${slug}.${c.key} needs a label`).toBeGreaterThan(2);
      if (c.kind === 'slider') {
        expect(c.min, `${slug}.${c.key}`).toBeLessThan(c.max);
        expect(c.step, `${slug}.${c.key}`).toBeGreaterThan(0);
        expect(c.initial).toBeGreaterThanOrEqual(c.min);
        expect(c.initial).toBeLessThanOrEqual(c.max);
      }
      if (c.kind === 'select' || c.kind === 'segmented') {
        expect(c.options.length).toBeGreaterThan(1);
        expect(c.options.map((o) => o.value)).toContain(c.initial);
      }
    }

    // Anything named in `defaults` must be a control the simulator declares.
    for (const key of Object.keys(definition.defaults)) {
      expect(keys, `${slug}: default "${key}" has no control`).toContain(key);
    }
  });

  it('ships a complete education pack', () => {
    expect(education.theory.length).toBeGreaterThanOrEqual(2);
    expect(education.formulas.length).toBeGreaterThanOrEqual(2);
    expect(education.variables.length).toBeGreaterThanOrEqual(3);
    expect(education.procedure.length).toBeGreaterThanOrEqual(4);
    expect(education.precautions.length).toBeGreaterThanOrEqual(3);
    expect(education.viva.length).toBeGreaterThanOrEqual(4);
    expect(education.resultTemplate.length).toBeGreaterThan(20);
    for (const f of education.formulas) expect(f.tex.length).toBeGreaterThan(1);
    for (const v of education.viva) {
      expect(v.q.length).toBeGreaterThan(8);
      expect(v.a.length).toBeGreaterThan(15);
    }
  });

  it('computes a finite model at its defaults and across the control range', () => {
    if (!compute) return;
    const base = initialParams(definition);

    const check = (params: ParamValues, where: string) => {
      const out = compute(params);
      for (const n of numbersOf(out)) {
        expect(Number.isNaN(n), `${slug}: NaN in the model at ${where}`).toBe(false);
      }
      expect(out.description.length).toBeGreaterThan(20);
      expect(out.result.length).toBeGreaterThan(20);
      expect(out.readouts.length).toBeGreaterThan(0);
      expect(out.graph.series.length).toBeGreaterThan(0);
      return out;
    };

    check(base, 'defaults');

    // Sweep each slider to both ends and each discrete control to every option.
    for (const c of definition.controls) {
      if (c.kind === 'slider') {
        check({ ...base, [c.key]: c.min }, `${c.key} = min`);
        check({ ...base, [c.key]: c.max }, `${c.key} = max`);
        check({ ...base, [c.key]: (c.min + c.max) / 2 }, `${c.key} = mid`);
      } else if (c.kind === 'toggle') {
        check({ ...base, [c.key]: true }, `${c.key} = on`);
        check({ ...base, [c.key]: false }, `${c.key} = off`);
      } else {
        for (const o of c.options) check({ ...base, [c.key]: o.value }, `${c.key} = ${o.value}`);
      }
    }
  });

  it('responds to a control: moving a slider changes what the model reports', () => {
    if (!compute) return;
    const base = initialParams(definition);
    const slider = definition.controls.find((c) => c.kind === 'slider');
    if (!slider || slider.kind !== 'slider') return;

    const low = compute({ ...base, [slider.key]: slider.min });
    const high = compute({ ...base, [slider.key]: slider.max });
    const changed =
      low.description !== high.description ||
      low.readouts.some((r, i) => r.value !== high.readouts[i]?.value);
    expect(changed, `${slug}: sweeping "${slider.key}" changed no reading`).toBe(true);
  });

  it('mounts, draws its apparatus and shows its measurements', async () => {
    const { container } = mount(entry.mod.default);

    // The apparatus is a real drawing, not a placeholder image.
    const stage = container.querySelector('svg.svg-lab');
    expect(stage, `${slug} drew no apparatus`).not.toBeNull();
    expect(stage!.querySelectorAll('path, line, circle, rect, polygon, ellipse').length).toBeGreaterThan(4);

    // The measurements panel and the graph both come from the model.
    expect(screen.getByRole('heading', { name: /measurements/i })).toBeInTheDocument();
    expect(container.querySelector('path.chart-series')).not.toBeNull();

    // Nothing rendered may leak a NaN into the page.
    expect(container.textContent).not.toMatch(/NaN/);

    cleanup();
  });

  it('gives every on-apparatus handle an accessible name and a value', () => {
    const { container } = mount(entry.mod.default);
    const handles = container.querySelectorAll('.stage-ctl[role="slider"]');

    handles.forEach((h) => {
      const name = h.getAttribute('aria-label');
      expect(name, `${slug}: an on-apparatus handle has no accessible name`).toBeTruthy();
      expect(h.getAttribute('aria-valuenow'), `${slug}: ${name} has no value`).not.toBeNull();
      expect(h.getAttribute('aria-valuemin')).not.toBeNull();
      expect(h.getAttribute('aria-valuemax')).not.toBeNull();
      expect(h.getAttribute('tabindex')).toBe('0');
    });

    container.querySelectorAll('[role="switch"]').forEach((s) => {
      expect(s.getAttribute('aria-checked')).toMatch(/true|false/);
    });

    cleanup();
  });

  it('records a trial in the notebook and clears it again', async () => {
    const user = userEvent.setup();
    mount(entry.mod.default);

    const record = screen.queryByRole('button', { name: /record reading/i });
    if (!record) {
      cleanup();
      return;
    }
    if (record.hasAttribute('disabled')) {
      // Some practicals only allow a reading once the apparatus is balanced.
      cleanup();
      return;
    }

    await user.click(record);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    expect(table.textContent).not.toMatch(/NaN/);

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByRole('table')).toBeNull();

    cleanup();
  });
});
