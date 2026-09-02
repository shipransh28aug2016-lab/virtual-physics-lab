import { Suspense, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BRAND } from '@/app/branding/brand';
import { Icons } from '@/components/common/Icons';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import { useT } from '@/i18n';

/** Shown while a code-split route or experiment module is loading. */
export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Loading apparatus…</span>
    </div>
  );
}

const NAV = [
  { to: '/', label: 'nav.home', end: true },
  { to: '/class-12', label: 'nav.class12', end: false },
  { to: '/simulators', label: 'nav.simulators', end: false },
  { to: '/practicals', label: 'nav.practicals', end: false },
  { to: '/about', label: 'nav.about', end: false }
] as const;

export function AppLayout({ children }: { children?: ReactNode }) {
  const prefs = usePreferences();
  const t = useT();

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="shell-width header-inner">
          <Link to="/" className="brand">
            <Icons.Atom width={20} height={20} />
            <span>
              <b>{BRAND.name}</b>
              <i>
                {BRAND.curriculum} · {BRAND.year}
              </i>
            </span>
          </Link>
          <nav className="app-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
                {t(n.label as Parameters<typeof t>[0])}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => prefs.setLang(prefs.lang === 'en' ? 'hi' : 'en')}
              aria-label={prefs.lang === 'en' ? 'Switch to Hindi' : 'अंग्रेज़ी में देखें'}
            >
              <Icons.Globe width={14} height={14} /> {prefs.lang === 'en' ? 'हिन्दी' : 'EN'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              aria-pressed={!prefs.motion}
              onClick={() => prefs.setMotion(!prefs.motion)}
            >
              {prefs.motion ? 'Motion on' : 'Motion off'}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        <Suspense fallback={<RouteFallback />}>{children ?? <Outlet />}</Suspense>
      </main>

      <footer className="app-footer">
        <div className="shell-width">
          <p className="muted">
            {BRAND.fullName} · aligned to the CBSE {BRAND.year} curriculum. Every apparatus runs a real
            numerical model — readings, graphs and notebook comparisons are computed, never scripted.
          </p>
        </div>
      </footer>
    </div>
  );
}
