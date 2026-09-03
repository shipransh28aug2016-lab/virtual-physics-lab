# Virtual Physics Lab

An interactive physics laboratory for **CBSE / NCERT Class XII**, aligned to the
**2026-27** curriculum. Every apparatus is a live simulator: move a control and
the numerical model recomputes, the instrument responds, the reading updates,
the graph re-plots, and the lab notebook can record the trial and compare it
against theory. Nothing on screen is a static diagram or a scripted animation.

- **46 experiment modules** across the six units the lab currently covers
- **15 listed practicals** — Section A 1–6 and Section B 1–9 of the board list
- **Bilingual** English ⇄ NCERT-style Devanagari, fallback-safe
- **Offline** — the whole lab ships as one self-contained HTML file that runs
  from `file://` with no server and no network

## Getting started

```sh
npm install
npm run dev              # dev server
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run build:portable` | one self-contained file → `portable/virtual-physics-lab.html` |
| `npm run serve` | serves `dist/` on `:4173` |
| `npm test` | Vitest — physics anchors, catalogue alignment, every simulator mounted |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint --max-warnings=0` |
| `npm run catalogue` | regenerate `*.meta.ts` (`-- --check` in CI) |
| `npm run audit` | real-Chromium placement/FPS audit of every route over http |
| `npm run audit:portable` | the same audit against the single file over `file://` |

## How it is put together

```
src/
  physics-engine/   pure model, SI units, no React
  simulations/
    experiments/    one file per experiment = the whole simulator
    optics/ magnetism/   shared view factories
  components/
    shell/          PhysicsExperiment (wiring) · SimulatorShell (chrome) · Viewport
    controls/       StageKit (on-apparatus handles) · Controls (dock)
    instruments/    CircuitBoard · OpticsBench · Instruments · BenchBoard
    charts/ lab-notebook/ math/ common/
  experiments/      registry (glob loader) + catalogue test
  app/ pages/ i18n/ hooks/ utils/ data/ types/ styles/
```

Adding an experiment means adding **one file** plus its generated meta: the
registry glob, the routes, the search, the catalogue and the unit pages all pick
it up automatically.

Each `src/simulations/experiments/<slug>.tsx` exports:

- `meta` — from `<slug>.meta.ts`, tiny and eagerly loaded
- `definition` — control specs, defaults, identity (taken from the meta)
- `education` — theory, formulae, variables, procedure, precautions, viva
- `compute(params) → ModelOutput` — **pure physics**
- `renderStage(api)` — the SVG apparatus, given `{ params, set, control }`
- default export — `<PhysicsExperiment …/>` with all of the above

## Invariants the audits rely on

Do not rename: `svg.svg-lab`, `.stage-ctl[role="slider"]`, `.readout`,
`path.chart-series`, `.stage-bench`, `.stage-pin`, `.viewport-stage`.

See `HANDOVER.md` for the full picture, the techniques used, and the roadmap.
