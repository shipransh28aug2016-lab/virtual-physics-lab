import type { ComponentType } from 'react';
import type { Difficulty, ExperimentKind, UnitSlug } from '@/types/lab';

/**
 * The eagerly-loaded half of an experiment: enough to list, search, sort and
 * route it without pulling in the simulator itself.
 */
export interface ExperimentMeta {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  aim: string;
  unit: UnitSlug;
  chapter: string;
  kind: ExperimentKind;
  difficulty: Difficulty;
  /** CBSE practical number, e.g. "A1" or "B6". Absent for theory simulators. */
  practicalNo?: string;
  tags: string[];
}

export interface ExperimentModule {
  meta: ExperimentMeta;
  /** Code-split loader for the simulator component. */
  load: () => Promise<{ default: ComponentType }>;
}

// Metadata is eager (tiny, generated); the simulators themselves are lazy.
const metaModules = import.meta.glob<{ meta: ExperimentMeta }>(
  '../simulations/experiments/*.meta.ts',
  { eager: true }
);
const simulatorModules = import.meta.glob<{ default: ComponentType }>(
  '../simulations/experiments/*.tsx'
);

const slugOf = (path: string): string =>
  path.replace(/^.*\//, '').replace(/\.meta\.ts$/, '').replace(/\.tsx$/, '');

function build(): ExperimentModule[] {
  const out: ExperimentModule[] = [];
  for (const [path, mod] of Object.entries(metaModules)) {
    const slug = slugOf(path);
    const loaderKey = Object.keys(simulatorModules).find((p) => slugOf(p) === slug);
    if (!loaderKey || !mod?.meta) continue;
    out.push({ meta: mod.meta, load: simulatorModules[loaderKey] });
  }
  return out.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
}

export const EXPERIMENTS: ExperimentModule[] = build();
export const EXPERIMENT_COUNT = EXPERIMENTS.length;

const bySlug = new Map(EXPERIMENTS.map((e) => [e.meta.slug, e]));

export const findExperiment = (slug: string): ExperimentModule | undefined => bySlug.get(slug);

/** Experiments in one unit, practicals first and then in catalogue order. */
export function byUnit(unit: UnitSlug): ExperimentModule[] {
  return EXPERIMENTS.filter((e) => e.meta.unit === unit).sort((a, b) => {
    const pa = a.meta.practicalNo ?? '';
    const pb = b.meta.practicalNo ?? '';
    if (pa && pb) return pa.localeCompare(pb, undefined, { numeric: true });
    if (pa) return -1;
    if (pb) return 1;
    return a.meta.title.localeCompare(b.meta.title);
  });
}

/** Free-text search across title, aim, chapter, tags and practical number. */
export function searchExperiments(query: string): ExperimentModule[] {
  const q = query.trim().toLowerCase();
  if (!q) return EXPERIMENTS;
  return EXPERIMENTS.filter((e) => {
    const m = e.meta;
    return (
      m.title.toLowerCase().includes(q) ||
      m.shortTitle.toLowerCase().includes(q) ||
      m.aim.toLowerCase().includes(q) ||
      m.chapter.toLowerCase().includes(q) ||
      (m.practicalNo?.toLowerCase().includes(q) ?? false) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}
