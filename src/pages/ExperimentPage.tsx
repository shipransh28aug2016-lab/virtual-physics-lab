import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ExperimentModule } from '@/experiments/registry';
import { byUnit } from '@/experiments/registry';
import { RouteFallback } from '@/app/layout/AppLayout';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import { documentTitle } from '@/app/branding/brand';
import { Icons } from '@/components/common/Icons';

/**
 * Route shell for a single experiment. The heavy module (physics model + view +
 * education) is code-split per experiment and mounted behind a Suspense
 * boundary, so the catalogue never pays for apparatus it is not showing.
 */
export default function ExperimentPage({ module: mod }: { module: ExperimentModule }) {
  const prefs = usePreferences();
  const Component = useMemo(() => lazy(mod.load), [mod]);
  const slug = mod.meta.slug;
  const touchRecent = prefs.touchRecent;

  useEffect(() => {
    document.title = documentTitle(mod.meta.title);
    touchRecent(slug);
  }, [slug, mod.meta.title, touchRecent]);

  useEffect(
    () => () => {
      document.title = documentTitle();
    },
    []
  );

  const neighbours = useMemo(() => findNeighbours(mod.meta.unit, slug), [mod.meta.unit, slug]);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Component />
      </Suspense>
      <nav className="page" style={{ paddingTop: 0 }} aria-label="More experiments in this unit">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <Link to="/class-12" className="btn btn-ghost btn-sm">
            <Icons.ArrowLeft width={13} height={13} /> All units
          </Link>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {neighbours.map((n) => (
              <Link key={n.slug} to={`/simulators/physics/${n.slug}`} className="btn btn-ghost btn-sm">
                {n.label} <Icons.ChevronRight width={12} height={12} />
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

function findNeighbours(unit: ExperimentModule['meta']['unit'], slug: string) {
  const list = byUnit(unit).map((e) => ({ slug: e.meta.slug, label: e.meta.shortTitle }));
  const i = list.findIndex((e) => e.slug === slug);
  const out: { slug: string; label: string }[] = [];
  const prev = i > 0 ? list[i - 1] : undefined;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;
  if (prev) out.push({ slug: prev.slug, label: `Previous: ${prev.label}` });
  if (next) out.push({ slug: next.slug, label: `Next: ${next.label}` });
  return out;
}
