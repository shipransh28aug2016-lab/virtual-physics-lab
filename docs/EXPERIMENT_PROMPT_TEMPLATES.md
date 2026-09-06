# Experiment-Panel Prompt Templates

Reusable prompts for briefing a developer (human or AI) to build a new
simulation panel in this lab. Every panel must satisfy `HANDOVER.md` §0: the
physics model is the single source of truth, controls drive real recomputation,
and no reading, needle, or graph is hard-coded or scripted.

## Master prompt (fill the placeholders)

```
Build the "<EXPERIMENT NAME>" simulator as
src/simulations/experiments/<slug>.tsx + <slug>.meta.ts, following the
ohms-law.tsx reference contract exactly: meta, definition, education,
compute(params) -> ModelOutput, renderStage(api), default export wrapped in
<PhysicsExperiment />.

PHYSICS
- compute() is pure, SI internally, and implements: <governing equations>.
- Add an anchor test in physics-engine/physics.test.ts pinning at least one
  textbook/NCERT/CODATA value.
- Validate inputs with physics-engine/validation.ts (validateRange,
  validateResistance, etc.) and surface issues via ValidationIssue.

APPARATUS (renderStage, SVG)
- Power supply: draw a battery/source symbol with visible +/- terminals;
  its rendered value (emf, current direction, on/off) must reflect the model.
- Wiring: connect components with visible wire paths (use CircuitBoard.tsx
  primitives — SeriesLoop, ResistanceBox, VoltmeterBranch — or add a new one
  there if the topology doesn't exist yet). No component may float unwired.
- Meters: every instrument that reads a quantity (ammeter, voltmeter,
  galvanometer, photodetector, thermometer) shows a live needle/digital
  readout bound to compute() output — never a static number.
- Use the shared `.readout` class and `formatSI` for numeric display so the
  audit script (check-placement.mjs) can find and validate it.

CONTROLS (StageKit, on-apparatus where physically sensible)
- Sliders (Knob with continuous drag) for continuous quantities (voltage,
  distance, angle, resistance) — set `onStage: true` for anything the user
  would touch on the real apparatus, min/max/step matched to real lab ranges.
- Knobs for rotary quantities (angle, dial resistance).
- Switches (StageSwitch) for binary state (key open/closed, AC/DC, polarity).
- Segmented controls (StageSegmented) for discrete modes (e.g. lens type).
- Every control needs a correct ARIA role, aria-valuenow, and full keyboard
  support (arrows/Home/End/PageUp) — inherited free from StageKit, don't
  reimplement.

REAL-TIME BEHAVIOUR
- Every control change must recompute() synchronously and repaint the
  instrument, reading, and chart in the same frame — no debounce, no
  "Apply" button.
- If the instrument animates continuously (a wave, a spinning coil, a
  moving charge), drive it with rAF + mutable refs + setAttribute, and keep
  React state untouched per-frame (see speed-of-light.tsx / wave-optics.tsx)
  so it holds 60 fps.

EDUCATION PACK
- theory, formulas (tex), variables, procedure, precautions, sourcesOfError,
  tips — matching the depth of ohms-law.tsx. Include a Devanagari title/aim
  in i18n (experiments-hi.ts) alongside the English strings.

GRAPH / NOTEBOOK
- Wire a chart (singleSeriesGraph or a custom one) plotting the physically
  meaningful pair (e.g. V vs I), populated from real compute() series, not
  precomputed constants.
- Confirm "Record reading" writes real trial data the notebook can compare
  against theory.

VERIFICATION
- npm run catalogue -- --check
- npm test (physics anchors + catalogue + simulators.test.tsx mount)
- npm run typecheck && npm run lint
- npm run build && npm run audit  — placement/FPS/keyboard audit must pass
  with no handle covering a label, no horizontal scroll at 360px, and no
  dropped frames while sweeping a control.
```

## Filled example — electricity/circuits

```
Build "Wheatstone Bridge" as
src/simulations/experiments/wheatstone-bridge.tsx.

Physics: balance condition P/Q = R/S, galvanometer deflection current from
loop analysis when unbalanced (physics-engine/circuits.ts). Anchor test:
classic 10/15/20 Ω arm balance at S = 30 Ω.

Apparatus: battery with key on one diagonal, galvanometer with a live
deflecting needle on the other, four resistance arms drawn as a diamond of
wires (extend CircuitBoard.tsx with a BridgeLoop primitive), a jockey/slider
on a meter-bridge wire for the "known" experiment variant.

Controls (onStage): sliders for P, Q, R (Ω, log scale like ohms-law's
`load`); a DragX jockey position on the wire; StageSwitch for the key.

Meters: galvanometer needle angle ∝ bridge current, zero-crossing highlighted
at balance; ammeter in the battery branch.

Real-time: needle and balance-point readout update on every drag/slider
change; chart plots galvanometer current vs jockey position.
```

## Filled example — optics

```
Build "Convex Lens — Lens Maker's Equation" as
src/simulations/experiments/lensmaker-equation.tsx, reusing lensFactory in
simulations/optics/.

Physics: 1/f = (n-1)(1/R1 - 1/R2) from physics-engine/optics.ts. Anchor:
n=1.5, R1=20cm, R2=-20cm -> f=20cm.

Apparatus: OpticsBench with lens icon whose curvature glyphs redraw from
R1/R2 sign and magnitude; ray-traced principal rays live-recomputed from f;
no power supply/meters needed here — the "instrument" is the ray diagram and
a screen with a live sharpness/position readout.

Controls (onStage): sliders for R1, R2 (cm, can be negative — surface
convention), refractive index n (dimensionless, 1.0-2.5); DragX for object
distance.

Real-time: rays, image position marker, and magnification readout redraw on
every drag; chart plots 1/v vs 1/u (should be linear, slope 1, intercept 1/f).
```

## Checklist before opening a PR

- [ ] `meta`/`definition` fields all sourced from `<slug>.meta.ts` (no
      hand-copied duplicates — the catalogue test enforces this).
- [ ] Every on-stage control has `onStage: true` and a real physical range.
- [ ] Every meter/readout is bound to `compute()` output via `.readout`.
- [ ] Wires/connections are drawn, not implied.
- [ ] `npm run catalogue`, `npm test`, `npm run typecheck`, `npm run lint`,
      `npm run audit` all pass.
