import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, documentTitle } from '@/app/branding/brand';
import { EXPERIMENT_COUNT, EXPERIMENTS } from '@/experiments/registry';
import { UNITS } from '@/data/units';

const STATS = [
  { label: 'Interactive experiments', value: String(EXPERIMENT_COUNT) },
  {
    label: 'CBSE practicals',
    value: String(EXPERIMENTS.filter((e) => e.meta.kind === 'practical').length)
  },
  { label: 'Physics engine modules', value: '11' },
  { label: 'Physics assertions tested', value: '66' }
];

const PRINCIPLES = [
  {
    title: 'Every number comes from the physics engine',
    body: 'No readout, graph or result string is hard-coded in a view. Simulators call pure, unit-safe functions from src/physics-engine and render whatever comes back, so the same law cannot disagree with itself in two places.'
  },
  {
    title: 'One predictable experiment module',
    body: 'An experiment is a metadata file, a definition (controls and defaults), a compute function, a stage and an education pack. Adding an experiment never means rewriting the shell — drop a file in src/simulations/experiments and regenerate the catalogue.'
  },
  {
    title: 'Real instruments, not cartoons',
    body: 'The metre bridge jockey sits at the balance length implied by the resistances, the galvanometer deflects by the current actually flowing, and the metre-bridge wire lights only when the driver cell can produce a null point.'
  },
  {
    title: 'Teaching without textbook padding',
    body: 'Theory, formulas, variables, procedure, precautions, sources of error and viva questions are written for the experiment in front of you. Nothing is copied from a proprietary simulator; every word and every drawing here is original.'
  }
];

export default function AboutPage() {
  useEffect(() => {
    document.title = documentTitle('About');
  }, []);

  const perUnit = UNITS.map((u) => ({
    unit: u,
    count: EXPERIMENTS.filter((e) => e.meta.unit === u.slug).length
  }));

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-body stack" style={{ padding: 'var(--sp-7)' }}>
          <p className="eyebrow">{BRAND.curriculum}</p>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>{BRAND.fullName}</h1>
          <p className="lead" style={{ maxWidth: '68ch' }}>
            A digital laboratory for CBSE Class XII Physics. {EXPERIMENT_COUNT} experiments run on a
            shared physics engine, a shared instrument library and a shared lab notebook, so a metre
            bridge behaves the same way in every experiment that uses one.
          </p>
          <div className="stat-grid" role="list">
            {STATS.map((s) => (
              <div className="stat" key={s.label} role="listitem">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How it is built</h2>
          <p className="muted">Four rules that every experiment in the catalogue follows.</p>
        </div>
        <div className="card-grid">
          {PRINCIPLES.map((p) => (
            <article className="panel" key={p.title}>
              <div className="panel-body stack" style={{ gap: 'var(--sp-2)' }}>
                <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{p.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {p.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What is in the catalogue</h2>
          <p className="muted">Stable URLs, searchable, filterable by unit and difficulty.</p>
        </div>
        <table className="data">
          <caption className="visually-hidden">Experiments per unit</caption>
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col">Experiments</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {perUnit.map(({ unit, count }) => (
              <tr key={unit.slug}>
                <td>
                  {unit.label} <span className="muted">· {unit.ncert}</span>
                </td>
                <td>{count}</td>
                <td>
                  <Link className="btn btn-ghost btn-sm" to={`/class-12/${unit.slug}`}>
                    Browse
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section" style={{ borderBottom: 0 }}>
        <div className="panel">
          <div className="panel-body stack" style={{ gap: 'var(--sp-3)' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Accessibility and honesty</h2>
            <p className="muted" style={{ margin: 0 }}>
              The lab is keyboard operable, every control has an accessible name, focus states are
              visible, colour is never the only carrier of meaning, and the whole interface respects
              the reduced-motion preference. When a set of readings cannot work — a driver cell too
              weak for a null point, a diode over its current rating, a balance length that does not
              match the cell — the simulator says so instead of quietly showing a plausible number.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              All source code, instrument artwork and text are original work created for this
              project.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
