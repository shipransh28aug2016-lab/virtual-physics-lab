# Baseline report — before Physics Lab 2.0

Recorded on the untouched tree at `a781844`, Node 22, after `npm install`.
Every command below was run exactly as the repository ships it.

```yaml
baseline:
  build:      PASS  · tsc -b + vite build · 2.57 s · largest chunk index 233 kB
  typecheck:  PASS  · tsc --noEmit · clean
  lint:       PASS  · eslint --max-warnings=0 · clean
  tests:      PASS  · 518 / 518 in 4 files · 10.2 s
  placement:  PASS  · 49/49 audited · 0 defects · 0 overlaps · http
  portable:   PASS  · 49/49 audited · 0 defects · 0 overlaps · file://
              portable/virtual-physics-lab.html · 829 kB · fully inlined
  known_failures: none
```

## Test breakdown

| File | Tests | What it pins |
|---|---:|---|
| `src/physics-engine/physics.test.ts` | 49 | NCERT/CODATA anchors — e/m, hc, TIR, prism δm, cyclotron f, RC/RL |
| `src/experiments/catalogue.test.ts` | 76 | CBSE practical table row by row; chapter belongs to its unit |
| `src/simulations/simulators.test.tsx` | 392 | every simulator mounts; definition matches meta; no NaN |
| `src/i18n/i18n.test.tsx` | 1 | missing key degrades, never throws |

## Counts as found (documentation drift)

`README.md` and `HANDOVER.md` both say **46 experiment modules**. The tree
actually carries **49** `.tsx` simulators with 49 matching `.meta.ts` files, and
the audit reports `49/49`. The catalogue test asserts `>= 46`, so the drift is
invisible to CI. The three added since the documents were written are the
Thomson e/m, EM-spectrum and Bohr-spectrum modules from the most recent
branches.

| Unit | Modules |
|---|---:|
| practical-b | 10 |
| optics | 9 |
| magnetism | 7 |
| practical-a | 6 |
| current-electricity | 6 |
| electrostatics | 5 |
| emi-ac | 2 |
| electromagnetic-waves | 1 |
| dual-nature | 1 |
| atoms-nuclei | 1 |
| electronic-devices | 1 |

All 15 board practicals (A1–A6, B1–B9) are present and filed in the right
section. Class XI coverage is **zero** — the type `UnitSlug` admits only the
nine Class XII units plus the two practical sections.

## Build artefacts

- web build: per-experiment code splitting, ~50 lazy chunks, `index` 233 kB
- portable build: `VPL_PORTABLE=1` inlines dynamic imports → one 768 kB module,
  embedded by `scripts/portable.mjs` into an 829 kB single file
- the portable script fails loudly if more than one bundle is emitted or if any
  external reference survives — that guard is what keeps `file://` working

## Reproducing

```sh
npm install
npm run typecheck && npm run lint && npm test
npm run build && npm run build:portable
npm run audit && npm run audit:portable
```
