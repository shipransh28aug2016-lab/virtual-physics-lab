import { useCallback } from 'react';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import type { ExperimentMeta } from '@/experiments/registry';
import type { UnitSlug } from '@/types/lab';
import { STRINGS, type StrKey } from './strings';
import { EXPERIMENTS_HI } from './experiments-hi';

export type Lang = 'en' | 'hi';

/** NCERT Devanagari labels for the physics units. */
export const UNIT_LABELS_HI: Record<UnitSlug, string> = {
  electrostatics: 'स्थिरवैद्युतिकी',
  'current-electricity': 'धारा वैद्युतिकी',
  magnetism: 'चल आवेश एवं चुम्बकत्व',
  'emi-ac': 'विद्युत चुम्बकीय प्रेरण एवं प्रत्यावर्ती धारा',
  optics: 'प्रकाशिकी',
  'dual-nature': 'द्वैत प्रकृति एवं आधुनिक भौतिकी',
  'modern-physics': 'आधुनिक भौतिकी',
  chemistry: 'रसायन विज्ञान',
  'practical-a': 'प्रयोग · भाग A',
  'practical-b': 'प्रयोग · भाग B'
};

export function useLang(): { lang: Lang; setLang: (l: Lang) => void } {
  const { lang, setLang } = usePreferences();
  return { lang, setLang };
}

/** Returns a translator for the static UI strings, falling back to English. */
export function useT() {
  const { lang } = useLang();
  return useCallback(
    (key: StrKey): string => {
      // A key added to the UI before it reaches the dictionary must degrade to
      // the key itself, never throw and take the whole page down with it.
      const entry = STRINGS[key];
      if (!entry) return String(key);
      return entry[lang] ?? entry.en;
    },
    [lang]
  );
}

/**
 * Localized accessors for experiment metadata and unit labels. Anything without
 * a Hindi translation transparently falls back to the English source.
 */
export function useLocalized() {
  const { lang } = useLang();
  const t = useT();

  const metaTitle = useCallback(
    (meta: ExperimentMeta): string =>
      lang === 'hi' ? (EXPERIMENTS_HI[meta.slug]?.title ?? meta.title) : meta.title,
    [lang]
  );
  const metaAim = useCallback(
    (meta: ExperimentMeta): string =>
      lang === 'hi' ? (EXPERIMENTS_HI[meta.slug]?.aim ?? meta.aim) : meta.aim,
    [lang]
  );
  const unitLabel = useCallback((slug: UnitSlug, fallback: string): string =>
    lang === 'hi' ? (UNIT_LABELS_HI[slug] ?? fallback) : fallback, [lang]);

  const difficulty = useCallback(
    (d: 'easy' | 'moderate' | 'advanced'): string => t((`diff.${d}`) as StrKey),
    [t]
  );
  const kind = useCallback(
    (k: 'practical' | 'activity' | 'theory'): string => t((`kind.${k}`) as StrKey),
    [t]
  );

  return { lang, t, metaTitle, metaAim, unitLabel, difficulty, kind };
}
