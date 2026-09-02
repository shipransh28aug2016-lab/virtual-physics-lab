import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EXPERIMENTS } from '@/experiments/registry';
import { CatalogueRail, ExperimentCard } from '@/components/common/Catalogue';
import { documentTitle } from '@/app/branding/brand';
import { Icons } from '@/components/common/Icons';

export default function PracticalsPage() {
  useEffect(() => {
    document.title = documentTitle('Practicals');
  }, []);
  const practicals = EXPERIMENTS.filter((e) => e.meta.kind === 'practical');
  const sectionA = practicals.filter((e) => e.meta.unit === 'practical-a');
  const sectionB = practicals.filter((e) => e.meta.unit === 'practical-b');

  return (
    <div className="lab-shell">
      <CatalogueRail />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <p className="eyebrow">CBSE Class XII</p>
            <h1>Practical laboratory</h1>
            <p className="muted" style={{ maxWidth: '72ch' }}>
              The listed practicals, each running on the same engine as the theory simulators. Every one supports
              the full workflow: set the apparatus, take readings, record trials, plot the graph and compare with
              theory.
            </p>
          </div>
          <div className="page-head-actions">
            <Link to="/practicals/section-a" className="btn btn-sm">
              Section A <Icons.ChevronRight width={12} height={12} />
            </Link>
            <Link to="/practicals/section-b" className="btn btn-sm">
              Section B <Icons.ChevronRight width={12} height={12} />
            </Link>
          </div>
        </div>

        {[
          { title: 'Section A — Electricity and Magnetism', list: sectionA, href: '/practicals/section-a' },
          { title: 'Section B — Optics', list: sectionB, href: '/practicals/section-b' }
        ].map((section) => (
          <section key={section.title} style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="section-head">
              <div>
                <h2>{section.title}</h2>
                <p>{section.list.length} listed practicals</p>
              </div>
              <Link to={section.href} className="btn btn-ghost btn-sm">
                Open section
              </Link>
            </div>
            <div className="catalogue-grid">
              {section.list.map((e) => (
                <ExperimentCard key={e.meta.id} meta={e.meta} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
