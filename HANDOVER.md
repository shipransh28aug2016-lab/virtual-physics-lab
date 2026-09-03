# Virtual Physics Lab — Handover, Techniques & Goals

> Read this before touching anything. It explains **what this codebase is**, the
> **methods used to build it**, the **goal it is chasing**, and how to take it
> further without breaking what already works.

---

## 0 · The goal

A production-grade virtual physics laboratory for **CBSE/NCERT Class XII** in
which **every apparatus is a real, live simulator — never a static diagram,
mockup, hard-coded graph or decorative animation.** Move any control and:

1. the **numerical physics model** recomputes,
2. the **instrument** (needle, ray, wave, trace) responds,
3. the **reading** updates,
4. the **graph** re-plots, and
5. the **lab notebook** can record the trial and compare it against theory.

Non-negotiables:

- **Physics is the single source of truth.** The view (2D SVG today, 3D later)
  is a *projection* of the model — never the other way round.
- **Real measurement, not fakery.** Readings come from the model; graphs from
  computed point series; notebook comparisons from real theory values.
- **Accessibility & responsiveness** are features (keyboard, ARIA, contrast,
  360→1920 px, reduced motion).
- **Offline & portable.** The whole lab ships as one self-contained HTML file
  that runs from `file://` with no server and no network.

---

## 1 · Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (**strict**) | catches whole classes of bugs; no `any` |
| UI | React 18 + Vite | fast HMR, per-experiment code-splitting |
| Rendering | **SVG / Canvas 2D** (Three.js reserved for genuine 3D) | crisp instruments, cheap, testable |
| Router | react-router (browser in prod, **hash** on `file://`) | one route table works offline |
| Styling | hand-rolled **design tokens** CSS (no Tailwind) | full control of the card system |
| Tests | Vitest + Testing Library; **Playwright** for real-browser audits | physics + DOM + layout verified |

Commands are listed in `README.md`.

---

## 2 · Architecture

```
index.html          the shipped laboratory: one self-contained file, committed
app/index.html      the Vite template it is built from (never overwritten)
app/entry.ts        the in-root entry that imports src/main
src/
  physics-engine/   PURE model. No React. SI units internally.
    constants units vectors numerical validation
    circuits electrostatics magnetism optics quantum waves-acoustics
    physics.test.ts  ← NCERT anchor values
  experiments/      registry.ts (glob loader) + catalogue.test.ts
  simulations/
    experiments/    ONE file per experiment = the whole simulator
    optics/ magnetism/   shared view factories
    simulators.test.tsx  ← mounts every simulator
  components/
    shell/          PhysicsExperiment (wiring) + SimulatorShell (chrome) + Viewport
    controls/       StageKit (on-apparatus handles) + Controls (bench dock)
    instruments/    CircuitBoard · OpticsBench · Instruments · BenchBoard
    charts/ lab-notebook/ math/ common/
  app/              routing, layout, branding, providers
  pages/            Home, Simulators, Class12, Unit, Practicals, Section, Experiment
  i18n/             en/hi dictionary + hooks (fallback-safe)
  hooks/ utils/     useLabState, useNotebook, useAnimation, storage, format
  data/ types/ styles/
scripts/            gen-catalogue.mjs · portable.mjs · check-placement.mjs
```

### The experiment-module contract

Every `src/simulations/experiments/<slug>.tsx` is self-contained and exports
`meta`, `definition`, `education`, `compute`, `renderStage` and a default
component. See `ohms-law.tsx` — it is the reference implementation — and
`resistivity-vi-graph.tsx` for the same pattern applied to a board practical.

**The meta is the single source of truth for the listing.** `definition` takes
`id`, `slug`, `title`, `unit`, `chapter`, `kind`, `difficulty` and `practicalNo`
from it. The factories (`_coilFactory`, `lensFactory`, `mirrorFactory`,
`defectVisionFactory`) take the whole `meta` for the same reason: hand-copying
those fields is how a simulator drifts away from the catalogue that lists it,
and the test suite now fails when it does.

### On-apparatus controls (StageKit)

`Knob`, `StageSwitch`, `StageSegmented`, `DragX`, `DragY`. They are real
controls: correct ARIA role, `aria-valuenow`, keyboard (arrows/Home/End/PageUp),
pointer drag, roving tabindex for the radio group. A control spec with
`onStage: true` is rendered **on the apparatus**; anything else falls to the
bench dock. This is what makes the lab feel like a real bench.

---

## 3 · Techniques worth keeping

1. **Model/view split.** `compute` is pure; the SVG draws only what the model
   returns. This is what makes a 3D view a drop-in later.
2. **rAF animation without re-render.** Animated instruments keep mutable refs
   and call `setAttribute` inside `requestAnimationFrame`; React state is not
   updated per frame → 60 fps. See `speed-of-light.tsx` and `wave-optics.tsx`.
3. **Code-splitting per experiment.** `import.meta.glob` lazy-loads each
   simulator; the catalogue imports only the tiny meta files.
4. **Generated meta.** `scripts/gen-catalogue.mjs` keeps the eager path cheap;
   it is idempotent and has a `--check` mode for CI.
5. **Real-browser verification.** `scripts/check-placement.mjs` mounts every
   route in Chromium and asserts: the stage fills its panel, **no handle covers
   a label**, no handle leaves the drawing, no horizontal scroll at 360 px,
   every handle is keyboard-reachable and announces a value, and frames stay
   smooth while a control is swept. It runs against `dist/` over http **and**
   against the single file over `file://`. This is how "looks right" became a
   test instead of a hope — it has already caught a fatal i18n crash, a routing
   bug that kept the previous apparatus mounted, and a metre/centimetre unit
   error in the optics factories.
6. **Functional audit.** `scripts/check-functions.mjs` drives the shipped
   `index.html` from `file://` the way a student would: it opens the file,
   searches the catalogue, moves a control and checks the readings change, checks
   the operating point and the axis track the model, records a trial, reloads to
   prove the notebook persisted, clears it, switches language, stars a favourite
   and reloads again. Nineteen checks; run it with `npm run audit:functions`.
   Note that a straight line through the origin keeps the same SVG path under
   auto-scaling, so "the graph responded" is asserted on the operating point,
   the axis ticks and the marker — not on the path data.
7. **Physics anchors + alignment tests.** `physics.test.ts` pins the model to
   NCERT/CODATA values (e/m = 1.7588e11, hc = 1240 eV·nm, TIR at 41.81°, prism
   δm, cyclotron f, RC and RL time constants). `catalogue.test.ts` asserts the
   CBSE practical table row by row and that every chapter string names a real
   chapter of the unit it claims. `simulators.test.tsx` mounts all 46.
8. **Design tokens + Clean Modern Card UI.** Solid surfaces, soft layered
   shadows, crisp 1px borders, 16 px radii — no glassmorphism.
9. **i18n with graceful fallback.** A missing key degrades to the key, never
   throws. All 46 experiments carry Devanagari titles and aims.
10. **Storage abstraction.** `utils/storage` wraps localStorage behind a
   read/write API that degrades to memory in private mode.
11. **Portable single-file build.** `VPL_PORTABLE=1` builds with dynamic
    imports inlined, so `scripts/portable.mjs` can embed one bundle — a
    `file://` page cannot fetch a lazy chunk, which is why the portable target
    does not code-split. The result is written to **`index.html` at the repo
    root** and to `portable/virtual-physics-lab.html`, byte for byte the same.

### Why the entry point is arranged the way it is

`index.html` at the root has to be the *finished* laboratory, because that is
the file people open off disk. But Vite also needs an HTML template, and if the
two are the same file every build destroys its own source. So:

- `app/index.html` is the template. Vite's `root` is `app/`.
- `app/entry.ts` is a one-line module inside that root which imports
  `../src/main`. Referencing `../src/main.tsx` from the template directly does
  work for a build but breaks the dev server's module resolution, which is why
  the indirection exists — do not "simplify" it away.
- `scripts/portable.mjs` writes the inlined result to the repo root and to
  `portable/`.

`src/test/shipped-entry.test.ts` asserts the shipped file is a whole
application: big enough to contain the bundle, with no external `script src` or
non-`data:` `href`, carrying the mount point, the design tokens and the
load-bearing class names. It exists because `index.html` once regressed into a
bare template whose only script pointed at `/src/main.tsx` — which resolves to
nothing on a filesystem, so the file opened to a blank screen.

---

## 4 · File map

| Want to… | Edit |
|---|---|
| Add an experiment | new `src/simulations/experiments/<slug>.tsx` + `.meta.ts`, then `npm run catalogue` |
| Change physics | `src/physics-engine/<domain>.ts` + an anchor in `physics.test.ts` |
| Add an instrument drawing | `src/components/instruments/*` |
| Change shell/panels/tabs | `src/components/shell/SimulatorShell.tsx` |
| Change on-apparatus handles | `src/components/controls/StageKit.tsx` |
| Change look/theme | `src/styles/lab.css` (tokens) + `lab-scene.css` (scene) |
| Translate a string | `src/i18n/strings.ts` or `experiments-hi.ts` |
| Change routes | `src/app/routes/AppRoutes.tsx` |
| Change the syllabus map | the `unit`/`chapter` in the meta + `src/data/units.ts` |

**Invariants the audits rely on (do not rename):** `svg.svg-lab`,
`.stage-ctl[role="slider"]`, `.readout`, `path.chart-series`, `.stage-bench`,
`.stage-pin`, `.viewport-stage`.

**Never point the shipped `index.html` at `/src/main.tsx`.** That is a
build-time path; on a filesystem it resolves to nothing and the page opens
blank. The template lives in `app/`.

**Routes must stay keyed.** `AppRoutes` gives each experiment route
`key={mod.meta.slug}`. Without it React reconciles one experiment page into the
next and the previous apparatus stays mounted while the URL changes.

---

## 5 · CBSE 2026-27 alignment

The board examines 70 marks of theory across nine units plus 30 marks of
practical. `src/data/units.ts` carries all nine with their weighting; the three
the lab does not yet simulate (Electromagnetic Waves, Atoms and Nuclei,
Electronic Devices) are listed and labelled "no simulators yet" rather than
omitted, so the curriculum map a student sees is the real one.

The practical list is exactly:

| No. | Experiment |
|---|---|
| A1 | Resistivity of wires by plotting V against I |
| A2 | Resistance of a wire by metre bridge |
| A3 | Laws of combination of resistances |
| A4 | Galvanometer resistance by half deflection |
| A5 | Conversion of a galvanometer into an ammeter and a voltmeter |
| A6 | Frequency of a.c. mains with a sonometer |
| B1 | Concave mirror — v against u |
| B2 | Convex mirror — focal length using a convex lens |
| B3 | Convex lens — focal length by the u–v method |
| B4 | Concave lens — focal length using a convex lens |
| B5 | Prism — angle of minimum deviation |
| B6 | Refractive index of a glass slab (travelling microscope) |
| B7 | Refractive index of a liquid (convex lens + plane mirror) |
| B8 | Refractive index of a liquid (concave mirror) |
| B9 | I–V characteristic of a p–n junction diode |

`catalogue.test.ts` asserts this table row by row, including that an
A-numbered practical is filed in Section A. **Change the table there when the
board changes the list** — the test is the specification.

---

## 6 · Roadmap

### 6.1 Keep the model, swap the view
Because `compute` is pure and the SVG is a projection, a 3D layer is additive.
Add `three` / `@react-three/fiber` for the experiments where 3D genuinely helps
(optics ray paths, field lines, cyclotron, diffraction wavefronts, telescope
benches); keep 2D SVG for circuits, which read better flat. Reuse `definition`,
`education`, the notebook, the readouts and the graph unchanged — only
`renderStage` gains a 3D variant, gated per experiment so weak hardware can
fall back.

### 6.2 Realism
Physically-based materials and soft shadows on the 3D bench; knob inertia,
detents and needle easing (respecting reduced motion).

### 6.3 The AI layer
- a **tutor copilot** that reads the live `ModelOutput` and the notebook rows
  and produces hints, viva follow-ups and "why is my graph bent?" diagnostics
  (rule-based first, LLM optional);
- **adaptive difficulty** and a guided procedure mode that highlights the next
  real control;
- **automatic error analysis** from recorded trials — the theory-vs-experiment
  comparison already in the notebook is the foundation.

### 6.4 Gaps worth closing first
- Unit V (Electromagnetic Waves), Unit VIII (Atoms and Nuclei) and Unit IX
  (Electronic Devices) have no simulators yet.
- Section B activities beyond the lateral-shift one.

### 6.5 Guardrails
- Keep `physics.test.ts` anchors green after any model change.
- Keep `check-placement.mjs` green on **both** targets; extend it to 3D canvas
  hit-tests when a 3D view lands.
- Never introduce a network dependency in the portable build; inline or
  generate any asset a 3D view needs.
- Every 3D gizmo needs a keyboard/ARIA equivalent.

---

## 7 · Current state

- **46 experiment modules**; **15 listed practicals** (A1–A6, B1–B9) aligned to
  CBSE 2026-27, plus one Section B activity.
- Controls live **on the apparatus**; the dock carries only what is left over.
- Clean Modern Card UI (solid surfaces, soft shadows, no glassmorphism).
- Bilingual EN ⇄ NCERT Devanagari, 46/46 translated, persisted, fallback-safe.
- **491 tests pass**; `tsc` and `eslint --max-warnings=0` are clean.
- Placement audit: **46/46 · 0 defects · 0 overlaps**, over http and `file://`.
- **`index.html` at the repo root is the laboratory** — ≈ 793 kB, self-contained,
  verified to open from `file://` and run all 46 routes with no console errors.

### A note on how this repo arrived

The upload that produced this repository was truncated: every file landed flat
at the root with no directories, no build configuration, and none of the shared
infrastructure the simulators import — 30 of the 46 experiment modules and the
whole engine, component and app layer were missing. Only the portable build was
complete. The structure, the engine, the component layer and the missing
simulators in the history from `eb766a6` onwards were rebuilt against the
contract the surviving modules implied. If something looks like it was written
twice, that is why.

*Start by reading `src/simulations/experiments/ohms-law.tsx` end to end — it is
the reference implementation of the whole pattern.*
