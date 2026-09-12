# The canvas layer

## Why hybrid, and not "everything on canvas"

Physics entities that move every frame — charges, field samples, light packets,
charge carriers, a vibrating string — are painted on a `<canvas>` inside a
`requestAnimationFrame` loop. Everything else stays SVG.

That split is not a compromise; it is the only arrangement that keeps three
things at once:

| Kept by | What would be lost on a full-canvas route |
|---|---|
| SVG apparatus | the placement audit (it queries `svg.svg-lab`, `.stage-ctl`, `.readout`) would go blind on that route |
| SVG controls | `role="slider"`, `aria-valuenow`, keyboard access, focus rings — a canvas has no accessibility tree |
| canvas entities | nothing: a hundred moving dots cost a hundred draw calls instead of a hundred layout passes |

This is also what PhET does. The picture is canvas; the instrument is DOM.

## The three pieces

```
PhysicsEngine ──► compute(params) ──► ModelOutput ──┐
   (SI state,          (pure)                        │
    integrator)                                      ▼
                                          SceneLayer ──► CanvasStage
UI control ──► lab.set(key, value) ──► params ───────┘      (rAF, DPR, resize)
```

1. **`src/lab/engine/PhysicsEngine.ts`** — every quantity in SI base units, a
   pure integrator, memoised derived values and a revision counter. No React, no
   DOM, no canvas.
2. **`src/lab/canvas/CanvasStage.tsx`** — the `<canvas>` and the loop. React
   renders it once; nothing after that waits on a re-render.
3. **`src/lab/canvas/scene.tsx`** — `SceneLayer` writes the live params and
   model into refs each render and the loop reads them back, so a slider move is
   on screen next frame with no re-render and no stale closure.

## Writing a scene

```ts
const scene = makeFieldScene({
  width: W, height: H,              // MUST match the apparatus viewBox
  label: (params) => '…',           // what a screen reader is told
  layout: (params) => ({ charges: […], pxPerMetre })
});

<PhysicsExperiment … scene={scene} />
```

Four rules, each learned from a bug rather than assumed:

1. **Match the viewBox.** A scene declares `width`/`height` and they must equal
   the SVG apparatus's viewBox. Both use `meet` letterboxing, so matching sizes
   is what keeps a drawn arrow on top of the charge the SVG drew. Coulomb's
   stage is 800×480; the common bench is 820×470.
2. **Share the geometry, don't re-derive it.** Where the apparatus and the scene
   both need a position, one exported function returns it and both call it —
   `benchGeometry` in Coulomb's law, `makeLensRays`, `wireControl`. Two copies
   of the same formula drift.
3. **Don't draw what the apparatus already draws.** Streamlines and a sampled
   arrow grid are two representations of one field; the field scene's `arrows`
   option exists so a scene can contribute only the motion.
4. **Say what the animation is.** Every scene factory sets a `disclosure`, and
   `SceneLayer` draws it automatically. A test asserts each shipped factory has
   one, because the audit cannot read canvas text.

## Scene families

| Family | Module | Drives from |
|---|---|---|
| electrostatic field | `scenes/field.ts` | superposition Σ kq r̂/r² over the real charges |
| optical rays | `scenes/rays.ts` | the experiment's own `BenchRay[]` construction |
| circuit carriers | `scenes/circuit.ts` | the MNA solution's per-branch current |
| axial magnetic field | `scenes/axial-field.ts` | the model's `B(x)` on the axis |
| standing wave | `scenes/standing-wave.ts` | the model's amplitude, mode and frequency |

## Coverage

All 49 experiments have the neumorphic case, the LED readouts, the notebook and
the live graph. Twelve have a bespoke canvas scene:

`coulombs-law` · `electric-field-charges` · `convex-lens` · `concave-lens` ·
`concave-mirror` · `convex-mirror` · `ohms-law` · `iv-characteristic` ·
`galvanometer-half-deflection` · `helmholtz-coil` · `anti-helmholtz-coil` ·
`sonometer`

The rest keep their SVG apparatus, which is already model-driven, and several
already animate through the existing rAF-without-re-render pattern. A scene is
per-experiment work by necessity: it has to know that experiment's geometry, and
a generic one would be decoration — which §42 of the brief rules out, rightly.

## Verifying a scene

Compiling is not evidence. Load the route in Chromium and check four things:

- a `canvas.canvas-stage` exists and has non-transparent pixels;
- its box matches the SVG's box (width **and** height);
- `pointer-events` is `none`, so controls underneath still work;
- **actual pixel data** changes between two samples.

That last one matters: comparing `toDataURL().length` can match by coincidence,
and did — it reported an animating scene as static and a static one as fine.

One caution: a resonance experiment is legitimately still away from resonance.
The sonometer wire does not move at 40 cm and should not; it moves at 80.8 cm.
Sweep the control before concluding a scene is broken.
