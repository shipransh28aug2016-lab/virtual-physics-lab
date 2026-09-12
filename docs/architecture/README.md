# Architecture

## The shape of it

```
                     ┌───────────────────────────────┐
                     │   physics-engine  (pure)      │
                     │   circuits · optics · quantum │
                     │   magnetism · waves · …       │
                     │   circuit/  graph→solve→faults│
                     └───────────────┬───────────────┘
                                     │ ModelOutput · CircuitSolution · Fault[]
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼─────────┐      ┌───────────▼────────────┐     ┌─────────▼─────────┐
│   src/lab/      │      │  PhysicsExperiment     │     │   presentation    │
│  motion tokens  │◄─────┤  useLabState · compute ├────►│  SVG instruments  │
│  audio bus      │      │  useNotebook · shell   │     │  components/bench │
│  interaction    │      └────────────────────────┘     │  (Three: pilot)   │
│  feedback rules │                                      └───────────────────┘
└─────────────────┘
```

**One import rule, and it is the whole architecture:** `src/lab/**` and the
component layer may import from `physics-engine`; `physics-engine` imports from
nothing but itself. `compute(params)` is pure — no React, no DOM, no clock, no
randomness — which is why a 3D view, a tutor layer and property-based tests are
all additive rather than rewrites.

## The experiment-module contract (unchanged since 1.0)

Every `src/simulations/experiments/<slug>.tsx` exports `meta`, `definition`,
`education`, `compute`, `renderStage` and a default component. The meta is the
single source of truth for identity; drift is a test failure. See
`HANDOVER.md §2` for the full contract and `ohms-law.tsx` for the reference.

## The circuit bench (2.0)

```
CircuitGraph { parts[], wires[] }        ← data. no coordinates.
        │  resolveNodes (union-find over wires)
        ▼
   NodeMap { nodeOf, terminals, floating }
        │  solveCircuit (MNA + Newton for diodes)
        ▼
   CircuitSolution { nodeVoltage, current, voltage, power }
        │  detectFaults (graph + solution)
        ▼
   Fault[]  →  ValidationIssue[]  →  the issue list on the page
```

The netlist is carried as an ordinary experiment parameter — a canonical
encoded string — so a reading is traceable to the circuit it came from, reset
restores a known layout, and a mis-wiring is reproducible in a test by its
encoding. `src/physics-engine/circuit/encode.ts` is the whole of that.

Geometry never defines topology. `Part.layout` is a drawing hint the solver
never reads; `Layout.span` lets a mount fix its socket spacing so swapping a
component does not move the student's wiring.

## Interaction

`useConnect` owns the connect state machine —
`DISCONNECTED → ALIGNED → CONNECTED → ACTIVE → MEASURING` — and the two-press
gesture: press a socket to pick a lead up, press a second to put it down. There
is **one** code path for pointer, touch and keyboard, which is why the two can
never drift apart. See `docs/accessibility/README.md`.

## The canvas layer

Physics entities that move every frame are painted on a `<canvas>` in a
`requestAnimationFrame` loop; the apparatus and every control stay SVG and keep
their accessibility tree and their audit selectors. `PhysicsEngine` holds state
in SI units with a pure integrator; `CanvasStage` owns the loop, the device
pixel ratio and the resize; `SceneLayer` bridges live React state into the loop
through refs so no frame waits on a re-render. See `docs/canvas/README.md`.

## Motion and audio

Seven motion tokens with stated meanings (`docs/animation/README.md`); one
synthesised Web Audio bus with eight cues and no assets
(`docs/audio/README.md`). Both collapse to nothing when the student turns them
off, and neither is ever the only channel.

## Feedback

`src/lab/feedback/rules.ts` turns bench state the engine already computed into
an observation, an explanation in syllabus language and a physical next action.
It may not invent a circuit the model does not report. An LLM tutor, if one is
ever added, sits above this and is fed the same validated state — it never
becomes the source of the physics.

## What the tests hold

| Layer | Test | Holds |
|---|---|---|
| engine | `physics.test.ts` (51) | NCERT/CODATA anchors |
| engine | `circuit/*.test.ts` (37) | topology, MNA, faults, encoding |
| catalogue | `catalogue.test.ts` (76) | the CBSE practical table, row by row |
| every module | `simulators.test.tsx` (392) | mounts, no NaN, definition matches meta |
| benches | `*.bench.test.ts` (34) | the physics of each reference bench, and its mistakes |
| lab layer | `lab/**` (38) | motion, audio fallback, connect, feedback |
| shell | `preferences.test.tsx` (3) | the sound and motion switches |
| the browser | `check-placement.mjs` | placement, a11y, fps, keyboard wiring, honesty |

The Chromium audit runs against `dist/` over http **and** against the single
portable file over `file://`. Both must be green.

## Portable build

`VPL_PORTABLE=1` inlines dynamic imports so `scripts/portable.mjs` can embed one
bundle — a `file://` page cannot fetch a lazy chunk. Anything added to the lab
must degrade gracefully offline: audio is synthesised rather than shipped for
exactly this reason, and a 3D pilot must stay behind a dynamic import that the
portable target never pulls in.
