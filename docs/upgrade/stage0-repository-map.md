# Stage 0 — Repository map, strengths, risks

## 1 · What this repository is

A single-page React 18 + TypeScript (strict) + Vite application. 49 experiment
modules, one file each, driven by a pure physics engine and drawn as SVG. No
runtime dependency beyond `react`, `react-dom`, `react-router-dom` — the whole
lab ships as one 829 kB HTML file that runs from `file://`.

### Flows

```
routing      AppRoutes reads EXPERIMENTS (registry) → one keyed route per slug
catalogue    *.meta.ts (eager, generated) → registry → pages/search/units
data         meta → definition (identity) ; controls[] → useLabState → params
physics      params → compute(params) → ModelOutput {readouts, graph, result}
render       ModelOutput + params → renderStage(StageApi) → SVG instruments
interaction  StageKit handle → set(key, value) → params → recompute → redraw
notebook     capture() reads the model → rows (localStorage) → derive() → table
test         physics anchors · catalogue alignment · mount-every-simulator
             + Chromium placement/FPS audit over http AND file://
portable     VPL_PORTABLE=1 → inlineDynamicImports → scripts/portable.mjs
```

### Layer inventory

| Layer | Files | Notes |
|---|---|---|
| `physics-engine/` | 11 modules + tests | pure, SI, no React, 49 anchors |
| `simulations/experiments/` | 49 `.tsx` + 49 `.meta.ts` + `_shared.ts` | the contract |
| `simulations/optics\|magnetism/` | 4 factories | lens, mirror, defect-vision, coil |
| `components/shell/` | PhysicsExperiment · SimulatorShell · Viewport | wiring + chrome |
| `components/controls/` | StageKit (517 L) · Controls | Knob/Switch/Segmented/DragX/DragY |
| `components/instruments/` | Instruments (537 L) · CircuitBoard · OpticsBench · BenchBoard | SVG apparatus |
| `components/` | charts · lab-notebook · math · common | LineChart, notebook, Tex |
| `app/ pages/ i18n/ hooks/ utils/ data/ types/ styles/` | — | routing, EN/HI, tokens |
| `scripts/` | gen-catalogue · portable · check-placement (279 L) | generation + real-browser audit |

## 2 · What is already good — keep

1. **`compute(params)` is genuinely pure.** No React, no DOM, no time, no
   randomness. This is the single most valuable asset in the repository: it is
   what makes a 3D view, a tutor layer and property-based tests all additive.
2. **Model → view is one-directional and enforced by tests.** `simulators.test`
   mounts all 49 and sweeps every readout for NaN.
3. **The placement audit is a real product.** It asserts in Chromium what a
   screenshot would need eyeballing: stage fills panel, no handle covers a
   label, no handle escapes the drawing, no horizontal scroll at 360 px, every
   handle keyboard-reachable and announcing a value, ≥30 fps while sweeping,
   and that clicking through a route actually swaps the apparatus. It runs on
   `dist/` over http and on the single file over `file://`.
4. **On-apparatus controls with correct ARIA.** `role="slider"` with
   `aria-valuenow`/`aria-valuetext`, arrows/Home/End/PageUp, roving tabindex on
   the radio group, pointer drag mapped through the SVG CTM.
5. **Generated meta as the single source of truth for identity.** Catalogue
   drift is a test failure, not a bug report.
6. **rAF without re-render.** Nine modules animate by mutating `setAttribute`
   inside `requestAnimationFrame`, honouring `prefers-reduced-motion`.
7. **Design tokens already exist** (`lab.css`: colour, spacing, radius, shadow,
   easing, typography). There is no ad-hoc styling free-for-all to clean up.
8. **Portable build is guarded**, not hoped for: the script exits non-zero if a
   second chunk or any external reference appears.

## 3 · What must not be broken

Contract | Why
---|---
`svg.svg-lab`, `.stage-ctl[role="slider"]`, `.readout`, `path.chart-series`, `.stage-bench`, `.stage-pin`, `.viewport-stage` | the audit selects on them
`compute` purity | every test, every future renderer, the tutor layer
the module contract (`meta`/`definition`/`education`/`compute`/`renderStage`/default) | registry, catalogue test, simulators test
`key={mod.meta.slug}` on the experiment route | without it the previous apparatus stays mounted
meta-as-identity in `definition` and the factories | catalogue alignment test
one bundle in the portable build | `file://` cannot fetch a lazy chunk
`CBSE_PRACTICALS` table in `catalogue.test.ts` | it *is* the specification
49 existing modules, 15 practicals, EN/HI parity | scope of the product

## 4 · What is missing for Physics Lab 2.0

| # | Gap | Evidence |
|---|---|---|
| G1 | **No circuit topology model.** A circuit is a hand-drawn SVG path plus a `closed` boolean. `grep CircuitGraph\|netlist\|node` in the engine returns nothing. Connection is implied by geometry, exactly what §26 forbids. | `CircuitBoard.tsx` `SeriesLoop` draws a fixed `M 120 350 …` loop |
| G2 | **No connect/disconnect interaction.** The student can turn knobs and throw one key; they cannot pick up a wire, plug it into a terminal, or wire it wrongly. | `StageKit` exposes Knob/Switch/Segmented/DragX/DragY only |
| G3 | **No mistakes are possible.** Every state reachable by the controls is a valid, correct state. Validation only guards numeric ranges (9 `severity:'error'` sites, all range checks). | `validation.ts` |
| G4 | **No audio system.** One `speechSynthesis` call in `charge-to-mass.tsx`; no Web Audio, no click, no mute, no volume. | grep `AudioContext` → 0 hits |
| G5 | **No motion language.** Two hard-coded transitions (needle 260 ms, `lead-flow` dash) and per-file rAF loops. No shared tokens, no snap/settle/error vocabulary. | `lab-scene.css` lines 380–390 |
| G6 | **No apparatus state machine.** Component state is a boolean per experiment. | — |
| G7 | **No student modes.** No guided procedure, no exploration/assessment/demo split; `education.procedure` is prose in a tab. | `SimulatorShell` tabs |
| G8 | **Notebook 1.0.** Trial no. + columns + one comparison. No settings snapshot, no per-row theoretical value, no timestamp, no conclusion, no export. | `LabNotebook.tsx`, `useNotebook.ts` |
| G9 | **No uncertainty vocabulary.** No least count, zero error, or repeated-reading model anywhere. | — |
| G10 | **No 3D.** `three` is not a dependency. (Correct for today; a deliberate pilot is the 2.0 ask.) | `package.json` |
| G11 | **Class XI: zero coverage.** `UnitSlug` admits only Class XII units. | `types/lab.ts` |
| G12 | **Three Class XII units are thin**: EM waves 1, atoms-nuclei 1, electronic devices 1 module. | meta census |
| G13 | **No representation-honesty labelling.** Charge dots animate along leads with no caption saying the animation is conceptual, not drift velocity — §37 requires the label. | `Instruments.tsx` `Lead` |
| G14 | **Docs drift**: README/HANDOVER say 46; the tree has 49. | baseline report |

## 5 · Experience gap vs PhET / OLabs-style labs

| Dimension | Here today | PhET | OLabs | Target |
|---|---|---|---|---|
| Direct manipulation | knob/slider on apparatus | drag the object itself | click through procedure | drag wire → terminal, plug, snap |
| Immediate feedback | numeric + needle | visual + causal | staged | + audio + motion + flow cue |
| Procedure | prose in a tab | none (by design) | strong, stepwise | Guided mode with live step state |
| Mistakes | impossible | mostly impossible | scripted "wrong" branch | real: open circuit, wrong meter, reversed polarity |
| Apparatus fidelity | good 2D symbols | schematic | photographic | real terminals, plugs, analog faces |
| Measurement discipline | live readouts | live | tabulated | + least count, zero error, repeats |
| Physics fidelity | **strong (best of the three)** | strong | moderate | keep |
| Accessibility | **strong (best of the three)** | moderate | weak | keep and extend to new interactions |

The honest summary: **the physics and the accessibility already beat both
references; the tactility, the procedure and the consequence of error do not.**

## 6 · Proposed architecture (additive)

```
                    ┌───────────────────────┐
                    │  physics-engine (pure)│  ← unchanged, extended
                    │  + circuits/graph.ts  │  ← NEW: solver over a netlist
                    └───────────┬───────────┘
                                │ ModelOutput / CircuitSolution
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐   ┌──────────▼─────────┐   ┌─────────▼────────┐
│ lab-experience │   │ PhysicsExperiment  │   │  presentation    │
│  motion tokens │   │  (wiring, unchanged│   │  SVG (today)     │
│  audio bus     │◄──┤   public contract) ├──►│  Three (pilot)   │
│  interaction   │   │  + optional bench  │   │                  │
│  feedback bus  │   └────────────────────┘   └──────────────────┘
└────────────────┘
```

New directories, nothing moved:

```
src/physics-engine/circuit/     graph.ts · solve.ts · faults.ts   (pure)
src/lab/audio/                  bus.ts · sounds.ts · useSound.ts
src/lab/motion/                 tokens.ts · useSettle.ts
src/lab/interaction/            useConnect.ts (pointer + keyboard equivalent)
src/lab/feedback/               rules.ts (rule-based tutor over the model)
src/components/bench/           CircuitBench · Terminal · Wire · parts/*
```

Rule: `src/lab/**` may import from `physics-engine` and `types`, never the
reverse. `compute` stays pure and stays unaware that audio exists.

## 7 · Circuit bench design

```ts
type NodeId = string;                      // a junction
interface Terminal { id: string; part: string; node: NodeId | null }
interface Part { id: string; kind: PartKind; terminals: [string, string]; params: … }
interface CircuitGraph { parts: Part[]; wires: { a: string; b: string }[] }
```

- **Topology is data, never geometry.** SVG positions are a layout hint for the
  view; the solver never reads a coordinate.
- **Solver**: build the node set by union-find over wires, stamp a conductance
  matrix (MNA), solve for node potentials, back out branch currents. Ideal
  meters get their real resistances so "the voltmeter loads the circuit" is a
  consequence, not a special case. Deterministic, pure, unit-testable.
- **Faults are derived from the graph**, not authored per experiment:
  `OPEN` (source not in a closed path), `SHORT` (source across ~0 Ω),
  `AMMETER_PARALLEL`, `VOLTMETER_SERIES`, `REVERSED_POLARITY`, `FLOATING_TERMINAL`,
  `OVER_RANGE`.
- **Apparatus state machine** per connection point:
  `DISCONNECTED → ALIGNED → CONNECTED → ACTIVE → MEASURING`, with the visual
  state read off the machine, never off CSS position.
- **Accessibility equivalent, first-class**: connecting is
  "select source terminal → select target terminal → Enter", the same state
  transitions the pointer path uses.

## 8 · Audio + motion system

**Audio** — Web Audio only, zero assets, synthesised on demand:

| Cue | Synthesis | When |
|---|---|---|
| `switch` | 2-stage filtered noise burst, 18 ms | key thrown |
| `plug` | short low click + damped thunk | terminal connected |
| `unplug` | inverted envelope | disconnected |
| `hum` | 50 Hz + harmonic, −38 dB, faded | current flowing (optional) |
| `needle` | tiny noise tick | meter crosses a major division |
| `error` | two-tone descending, soft | fault raised |
| `success` | two-tone rising | balance found / reading valid |

Muted by default until first gesture (autoplay policy), one shared
`AudioContext`, master gain + mute persisted in preferences, `prefers-reduced-motion`
respected for the continuous hum, and a no-op fallback when Web Audio is absent
so the portable file still works. **Audio never carries information alone.**

**Motion** — one token table (`src/lab/motion/tokens.ts`):

| Token | Duration / curve | Meaning |
|---|---|---|
| `snap` | 120 ms `cubic-bezier(.2,.9,.3,1.2)` | connection made |
| `throw` | 90 ms linear | switch |
| `settle` | 260 ms damped overshoot | needle (already in use — promoted, not replaced) |
| `turn` | follows the pointer | knob |
| `flow` | continuous, period from ‖I‖ | current cue |
| `shake` | 180 ms, ±2 px | rejected action |
| `confirm` | 200 ms scale+fade | reading recorded |

Every token is a no-op under `[data-motion="off"]` and
`prefers-reduced-motion`.

## 9 · 2D / 3D strategy

Stay 2D SVG for circuits, schematics, graphs, ray diagrams, meter faces — they
are more legible flat and they are what the board expects a student to draw.

Introduce Three.js **behind a lazy boundary, for one pilot only**, where depth
genuinely teaches: the solenoid / Helmholtz field volume (a field is a 3D object
and the 2D section is the compromise). Non-negotiables: the same `compute`
drives it, `three` is dynamically imported so the portable bundle is unaffected
unless the pilot is opened, the SVG view remains the default and the fallback,
and the 3D view ships with the accessible object list the audit can read.

## 10 · First five experiments to upgrade

| # | Experiment | Why it earns the slot |
|---|---|---|
| 1 | **Ohm's law** (`ohms-law`) | already the reference implementation; every new subsystem lands here first |
| 2 | **Laws of combination of resistances** (A3, `resistance-series-parallel`) | the bench's second consumer — proves reuse, needs real series/parallel wiring |
| 3 | **Galvanometer half-deflection** (A4) | analog instrument behaviour, shunt reasoning, a genuine wrong-connection risk |
| 4 | **Convex lens u–v** (B3) | proves the pattern generalises past circuits, through a factory shared by 4 modules |
| 5 | **p–n junction diode I–V** (B9) | non-ohmic, polarity matters, over-range and burn-out are real mistakes |

## 11 · Test strategy (extend, never replace)

| New suite | Asserts |
|---|---|
| `physics-engine/circuit/graph.test.ts` | union-find topology, series/parallel reduction, meter loading, known-network anchors |
| `physics-engine/circuit/faults.test.ts` | each fault raised exactly when the graph deserves it, and not otherwise |
| `lab/audio/bus.test.ts` | mute, volume, no-Web-Audio fallback, no throw in jsdom |
| `lab/motion/tokens.test.ts` | reduced motion collapses every duration to 0 |
| `lab/interaction/connect.test.tsx` | keyboard connect/disconnect reaches the same state as pointer |
| `components/bench/CircuitBench.test.tsx` | ARIA on terminals, state machine transitions, no geometry in topology |
| existing suites | unchanged and still green — the regression contract |
| `check-placement.mjs` | extended: terminals are keyboard-reachable and announce their state |

## 12 · Implementation order

```
P1  audit + baseline + docs            ← this stage (no code)
P2  motion tokens · audio bus · feedback rules   (pure, tested, unused)
P3  circuit graph + solver + faults    (pure engine, tested, unused)
P4  CircuitBench view + Terminal/Wire interaction + a11y
P5  Ohm's law onto the bench — the gold reference
P6  A3 · A4 (bench reuse)  ·  B3 · B9 (pattern generalisation)
P7  notebook 2.0 · guided/exploration/assessment modes
P8  Three.js pilot (solenoid field), lazy, SVG stays default
P9  Class XI expansion + gap-analysis docs
```

Each phase ends green on: typecheck · lint · test · build · build:portable ·
audit · audit:portable, and is its own commit.

## 13 · Risks

| Risk | Mitigation |
|---|---|
| Portable bundle grows past usable size | audio is synthesised (0 assets); Three is dynamically imported and excluded from the portable target; size asserted in the portable script |
| A solver bug silently changes 49 existing modules' readings | the bench is *additive* — existing modules keep their closed-form `compute` until each is migrated deliberately, one commit at a time |
| Drag-to-connect breaks the 360 px / keyboard guarantees | keyboard path is built first, pointer second; the placement audit is extended before the feature lands |
| Audio annoys or misleads | off until first gesture, mute persisted, never the sole channel, no continuous sound without opt-in |
| "Real lab feel" drifts into decoration | §42 checklist enforced in review; every animation must be readable off `ModelOutput` |
| Scope: 49 modules × full 2.0 in one pass | reference-first. Five modules reach L4/L5; the rest inherit as the abstractions stabilise |
| CI time (two Chromium audits already ~4 min) | new tests are unit-level; audit additions are per-page evaluations, not extra page loads |

## 14 · Files expected to change

**New** (the bulk of the work):
```
src/physics-engine/circuit/{graph,solve,faults,index}.ts + tests
src/lab/motion/tokens.ts · src/lab/audio/{bus,sounds,useSound}.ts
src/lab/interaction/useConnect.ts · src/lab/feedback/rules.ts
src/components/bench/{CircuitBench,Terminal,Wire,parts/*}.tsx
docs/{upgrade,architecture,science,curriculum,audio,animation,testing}/**
```

**Modified** (surgical, contract-preserving):
```
src/types/lab.ts                 + bench/fault types (additive only)
src/components/controls/StageKit.tsx   + Plug/Terminal handle, existing exports untouched
src/components/instruments/Instruments.tsx  + honest flow labelling, analog faces
src/app/providers/PreferencesProvider.tsx   + sound/volume prefs
src/styles/lab-scene.css         + motion tokens, bench classes
src/simulations/experiments/ohms-law.tsx    ← reference migration
scripts/check-placement.mjs      + terminal a11y assertions
README.md · HANDOVER.md          + corrected counts, new subsystems
```

**Not touched**: the other 48 experiment modules, `registry.ts`, `AppRoutes.tsx`
route keying, `portable.mjs`, the existing test files.
