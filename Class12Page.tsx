import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UNITS } from '@/data/units';
import { byUnit } from '@/experiments/registry';
import { CatalogueRail } from '@/components/common/Catalogue';
import { documentTitle } from '@/app/branding/brand';
import { BRAND } from '@/app/branding/brand';
import { Icons } from '@/components/common/Icons';

export default function Class12Page() {
  useEffect(() => {
    document.title = documentTitle('Class XII');
  }, []);
  return (
    <div className="lab-shell">
      <CatalogueRail activeUnit="all" />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <p className="eyebrow">CBSE · NCERT</p>
            <h1>Class XII physics</h1>
            <p className="muted" style={{ maxWidth: '72ch' }}>
              Eight units, {UNITS.reduce((a, u) => a + byUnit(u.slug).length, 0)} interactive experiments. Open a
              unit to see its apparatus list, or jump straight to the practicals from the CBSE list.
            </p>
          </div>
          <div className="page-head-actions">
            <Link to="/practicals" className="btn btn-sm">
              <Icons.Flask width={13} height={13} /> Practicals
            </Link>
            <Link to="/simulators" className="btn btn-sm btn-primary">
              All simulators
            </Link>
          </div>
        </div>

        <div className="unit-grid">
          {UNITS.map((u) => {
            const list = byUnit(u.slug);
            return (
              <Link key={u.slug} to={u.href} className="unit-card">
                <em>{u.ncert}</em>
                <b>{u.label}</b>
                <span>{u.description}</span>
                <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                  {list.length} experiments →
                </span>
              </Link>
            );
          })}
        </div>

        <section style={{ marginTop: 'var(--sp-6)' }} aria-labelledby="about-lab">
          <h2 id="about-lab" style={{ marginBottom: 10 }}>
            About this lab
          </h2>
          <p className="muted" style={{ maxWidth: '80ch' }}>
            {BRAND.fullName} is an independent implementation of an interactive physics laboratory. Simulations
            compute from first-principles equations in SI units; instruments, ray diagrams and graphs are drawn
            from that computed state. Observations you record are stored in this browser and can be exported as
            CSV for your practical file.
          </p>
        </section>
      </div>
    </div>
  );
}
