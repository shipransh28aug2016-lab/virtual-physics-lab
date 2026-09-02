import { useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { ExperimentMeta } from '@/experiments/registry';
import { EXPERIMENTS, searchExperiments } from '@/experiments/registry';
import { UNITS } from '@/data/units';
import type { UnitSlug } from '@/types/lab';
import { Icons } from '@/components/common/Icons';
import { Chip, EmptyState } from '@/components/common/UI';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import { useLocalized } from '@/i18n';

const KIND_TONE = { practical: 'primary', activity: 'success', theory: 'ghost' } as const;

export function ExperimentCard({ meta }: { meta: ExperimentMeta }) {
  const { metaTitle, metaAim, difficulty, kind } = useLocalized();
  const prefs = usePreferences();
  const fav = prefs.isFavourite(meta.slug);

  return (
    <article className="exp-card">
      <Link to={`/simulators/physics/${meta.slug}`} className="exp-card-link">
        <div className="exp-card-head">
          <span className="exp-card-chapter">{meta.chapter}</span>
          {meta.practicalNo ? <span className="exp-card-no">{meta.practicalNo}</span> : null}
        </div>
        <h3>{metaTitle(meta)}</h3>
        <p className="exp-card-aim">{metaAim(meta)}</p>
        <div className="exp-card-foot">
          <Chip tone={KIND_TONE[meta.kind]}>{kind(meta.kind)}</Chip>
          <Chip tone="ghost">{difficulty(meta.difficulty)}</Chip>
        </div>
      </Link>
      <button
        type="button"
        className={`icon-btn exp-card-fav${fav ? ' is-on' : ''}`}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${meta.shortTitle} from favourites` : `Add ${meta.shortTitle} to favourites`}
        onClick={() => prefs.toggleFavourite(meta.slug)}
      >
        <Icons.Star width={14} height={14} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}

/** The unit navigation rail shared by every catalogue page. */
export function CatalogueRail({ activeUnit }: { activeUnit?: UnitSlug | 'all' }) {
  const { unitLabel } = useLocalized();
  return (
    <nav className="catalogue-rail" aria-label="Units">
      <NavLink
        to="/simulators"
        className={() => `rail-link${activeUnit === 'all' ? ' is-active' : ''}`}
        end
      >
        <Icons.Atom width={14} height={14} /> All experiments
        <b>{EXPERIMENTS.length}</b>
      </NavLink>
      {UNITS.map((u) => (
        <NavLink
          key={u.slug}
          to={u.href}
          className={({ isActive }) => `rail-link${isActive || activeUnit === u.slug ? ' is-active' : ''}`}
        >
          {unitLabel(u.slug, u.label)}
          <b>{EXPERIMENTS.filter((e) => e.meta.unit === u.slug).length}</b>
        </NavLink>
      ))}
    </nav>
  );
}

export interface CatalogueShellProps {
  title: string;
  lede: string;
  unit: UnitSlug | 'all';
  items?: ExperimentMeta[];
  showUnits?: boolean;
  initialFavouritesOnly?: boolean;
  children?: ReactNode;
}

/** Search + filter surface over a list of experiments. */
export function CatalogueShell({
  title,
  lede,
  unit,
  items,
  showUnits = true,
  initialFavouritesOnly = false,
  children
}: CatalogueShellProps) {
  const prefs = usePreferences();
  const [query, setQuery] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(initialFavouritesOnly);
  const [kindFilter, setKindFilter] = useState<'all' | 'practical' | 'theory'>('all');

  const source = useMemo(
    () => items ?? EXPERIMENTS.map((e) => e.meta),
    [items]
  );

  const results = useMemo(() => {
    const searched = query
      ? searchExperiments(query)
          .map((e) => e.meta)
          .filter((m) => source.some((s) => s.slug === m.slug))
      : source;
    return searched
      .filter((m) => (favouritesOnly ? prefs.favourites.includes(m.slug) : true))
      .filter((m) => (kindFilter === 'all' ? true : kindFilter === 'practical' ? m.kind === 'practical' : m.kind !== 'practical'));
  }, [query, source, favouritesOnly, prefs.favourites, kindFilter]);

  return (
    <div className="lab-shell">
      {showUnits ? <CatalogueRail activeUnit={unit} /> : <CatalogueRail activeUnit={unit} />}
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <p className="eyebrow">CBSE · NCERT</p>
            <h1>{title}</h1>
            <p className="muted" style={{ maxWidth: '72ch' }}>
              {lede}
            </p>
          </div>
        </div>

        <div className="catalogue-tools">
          <label className="search-field">
            <Icons.Search width={14} height={14} />
            <input
              type="search"
              value={query}
              placeholder="Search apparatus, chapter, practical number…"
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search experiments"
            />
          </label>
          <div className="row" role="group" aria-label="Filters">
            {(['all', 'practical', 'theory'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn btn-sm${kindFilter === k ? ' btn-primary' : ''}`}
                aria-pressed={kindFilter === k}
                onClick={() => setKindFilter(k)}
              >
                {k === 'all' ? 'All' : k === 'practical' ? 'Practicals' : 'Theory'}
              </button>
            ))}
            <button
              type="button"
              className={`btn btn-sm${favouritesOnly ? ' btn-primary' : ''}`}
              aria-pressed={favouritesOnly}
              onClick={() => setFavouritesOnly((v) => !v)}
            >
              <Icons.Star width={13} height={13} /> Favourites
            </button>
          </div>
        </div>

        {children}

        {results.length === 0 ? (
          <EmptyState title="Nothing matches those filters">
            Clear the search or switch off the favourites filter to see the full list.
          </EmptyState>
        ) : (
          <div className="catalogue-grid">
            {results.map((m) => (
              <ExperimentCard key={m.id} meta={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
