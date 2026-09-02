import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, byUnit, findExperiment, searchExperiments } from './registry';
import { UNITS } from '@/data/units';

/**
 * The CBSE Class XII physics practical list for the 2026-27 curriculum.
 * Section A carries six experiments and Section B nine; this table is the
 * contract the catalogue is checked against.
 */
const CBSE_PRACTICALS: { no: string; slug: string; unit: string }[] = [
  { no: 'A1', slug: 'resistivity-vi-graph', unit: 'practical-a' },
  { no: 'A2', slug: 'meter-bridge-resistivity', unit: 'practical-a' },
  { no: 'A3', slug: 'resistance-series-parallel', unit: 'practical-a' },
  { no: 'A4', slug: 'galvanometer-half-deflection', unit: 'practical-a' },
  { no: 'A5', slug: 'galvanometer-conversion', unit: 'practical-a' },
  { no: 'A6', slug: 'sonometer', unit: 'practical-a' },
  { no: 'B1', slug: 'concave-mirror', unit: 'practical-b' },
  { no: 'B2', slug: 'convex-mirror', unit: 'practical-b' },
  { no: 'B3', slug: 'convex-lens', unit: 'practical-b' },
  { no: 'B4', slug: 'concave-lens', unit: 'practical-b' },
  { no: 'B5', slug: 'prism-dispersion', unit: 'practical-b' },
  { no: 'B6', slug: 'refractive-index-glass-slab', unit: 'practical-b' },
  { no: 'B7', slug: 'refractive-index-liquid-lens', unit: 'practical-b' },
  { no: 'B8', slug: 'refractive-index-water', unit: 'practical-b' },
  { no: 'B9', slug: 'iv-characteristic', unit: 'practical-b' }
];

describe('experiment registry', () => {
  it('loads every simulator that has a meta file', () => {
    expect(EXPERIMENTS.length).toBeGreaterThanOrEqual(46);
    for (const e of EXPERIMENTS) expect(typeof e.load).toBe('function');
  });

  it('gives every experiment a unique slug and id', () => {
    const slugs = EXPERIMENTS.map((e) => e.meta.slug);
    const ids = EXPERIMENTS.map((e) => e.meta.id);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('files every experiment under a unit the site actually lists', () => {
    const known = new Set(UNITS.map((u) => u.slug));
    for (const e of EXPERIMENTS) {
      expect(known.has(e.meta.unit), `${e.meta.slug} is in unknown unit ${e.meta.unit}`).toBe(true);
    }
  });

  it('gives every experiment a title, an aim and searchable tags', () => {
    for (const { meta } of EXPERIMENTS) {
      expect(meta.title.length, meta.slug).toBeGreaterThan(8);
      expect(meta.shortTitle.length, meta.slug).toBeGreaterThan(2);
      expect(meta.aim.length, meta.slug).toBeGreaterThan(20);
      expect(meta.chapter.length, meta.slug).toBeGreaterThan(4);
      expect(meta.tags.length, meta.slug).toBeGreaterThan(1);
    }
  });

  it('finds an experiment by slug and by free text', () => {
    expect(findExperiment('ohms-law')?.meta.id).toBe('ohms-law');
    expect(findExperiment('not-a-real-slug')).toBeUndefined();
    expect(searchExperiments('sonometer').map((e) => e.meta.slug)).toContain('sonometer');
    expect(searchExperiments('B6').map((e) => e.meta.slug)).toContain('refractive-index-glass-slab');
    expect(searchExperiments('').length).toBe(EXPERIMENTS.length);
  });

  it('orders a unit with its practicals first, in board order', () => {
    const a = byUnit('practical-a').map((e) => e.meta.practicalNo ?? '');
    const numbered = a.filter(Boolean);
    expect(numbered).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  });
});

describe('CBSE 2026-27 practical alignment', () => {
  const practicals = EXPERIMENTS.filter((e) => e.meta.kind === 'practical');

  it('lists exactly the fifteen board practicals', () => {
    expect(practicals).toHaveLength(CBSE_PRACTICALS.length);
  });

  it('carries six experiments in Section A and nine in Section B', () => {
    expect(practicals.filter((e) => e.meta.unit === 'practical-a')).toHaveLength(6);
    expect(practicals.filter((e) => e.meta.unit === 'practical-b')).toHaveLength(9);
  });

  it.each(CBSE_PRACTICALS)('$no is $slug, filed under $unit', ({ no, slug, unit }) => {
    const found = practicals.find((e) => e.meta.practicalNo === no);
    expect(found, `no simulator numbered ${no}`).toBeDefined();
    expect(found?.meta.slug).toBe(slug);
    // A practical numbered A-something must live in Section A, and likewise B.
    expect(found?.meta.unit).toBe(unit);
    expect(found?.meta.unit).toBe(no.startsWith('A') ? 'practical-a' : 'practical-b');
  });

  it('numbers each practical exactly once', () => {
    const numbers = practicals.map((e) => e.meta.practicalNo);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('never gives a practical number to a theory simulator', () => {
    for (const e of EXPERIMENTS) {
      if (e.meta.kind !== 'practical') {
        expect(e.meta.practicalNo, `${e.meta.slug} is ${e.meta.kind} but numbered`).toBeUndefined();
      }
    }
  });
});
