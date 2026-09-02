import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentTitle } from '@/app/branding/brand';
import { Icons } from '@/components/common/Icons';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = documentTitle('Page not found');
  }, []);
  return (
    <div className="page">
      <div className="panel" style={{ maxWidth: 620, marginInline: 'auto' }}>
        <div className="panel-body stack" style={{ textAlign: 'center', padding: 'var(--sp-7)' }}>
          <span style={{ color: 'var(--ink-4)', display: 'inline-grid', placeItems: 'center' }}>
            <Icons.Compass width={34} height={34} />
          </span>
          <h1 style={{ fontSize: '1.6rem' }}>No apparatus on this bench</h1>
          <p className="muted">
            That route does not exist. The catalogue has every experiment with a stable URL — try searching from
            there.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/simulators" className="btn btn-primary btn-sm">
              Simulator index
            </Link>
            <Link to="/class-12" className="btn btn-ghost btn-sm">
              Class XII units
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
