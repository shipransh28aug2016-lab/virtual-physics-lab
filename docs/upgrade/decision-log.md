# Decision log — Physics Lab 2.0

Newest last. One entry per architectural choice that a future developer could
otherwise reasonably reverse.

---

## D1 · Extend, do not replace, the experiment-module contract

**Decision.** `meta` / `definition` / `education` / `compute` / `renderStage` /
default-export stays exactly as it is. Every 2.0 subsystem is additive and
optional.

**Reason.** 49 modules, 518 tests, two Chromium audits and a portable build all
key off that contract. It is the reason the repository is worth upgrading rather
than rewriting.

**Alternatives.** A new `Experiment2` contract with a compatibility shim; a
wholesale rewrite onto a scene-graph API.

**Tradeoff.** Some 2.0 features (bench topology, guided steps) are expressed as
extra optional props rather than a cleaner unified object.

**Impact.** Zero regression risk for unmigrated modules. Migration is per-module
and reversible.

---

## D2 · Circuit topology is a data graph, never SVG geometry

**Decision.** Introduce `src/physics-engine/circuit/` — parts, terminals, wires,
union-find node resolution, an MNA solver, and fault detection derived from the
graph. The view reads the solution; it never defines the topology.

**Reason.** §26 of the brief, and the practical requirement that a student can
mis-wire the bench and get a physically honest consequence. Today "connected" is
a hard-coded path string plus a boolean, so no wrong connection is expressible.

**Alternatives.** Keep closed-form formulas per experiment and fake the faults
with extra booleans (cheap, but every fault is authored per experiment and the
student can never build a circuit the author did not anticipate).

**Tradeoff.** A real solver is more code and needs its own anchor tests; a
linear-network solver is also more than some experiments need.

**Impact.** New pure module, no existing behaviour changed until a module is
deliberately migrated. Ohm's law migrates first as the reference.

---

## D3 · Audio is synthesised, never shipped as assets

**Decision.** One Web Audio bus, all cues generated (filtered noise bursts,
short damped oscillators). No sound files anywhere.

**Reason.** The portable single-file build is a first-class target. Audio assets
would have to be base64-inlined, which would inflate an 829 kB file that must
still open from `file://`. Synthesis costs bytes measured in hundreds.

**Alternatives.** Bundled ogg/mp3; a CDN (rejected outright — §48 forbids a
network dependency).

**Tradeoff.** Synthesised cues are less rich than recorded ones.

**Impact.** Portable size unaffected. Graceful no-op when Web Audio is missing,
so jsdom tests and locked-down browsers behave.

---

## D4 · Three.js is a lazily-imported pilot, not a rendering strategy

**Decision.** 2D SVG remains the default and the fallback for every experiment.
Three.js is added behind a dynamic import for one experiment where depth
genuinely teaches, and is excluded from the portable target.

**Reason.** §15 — rendering choice follows educational value, not novelty. School
hardware and the offline build both punish an unconditional 3D dependency.

**Alternatives.** `@react-three/fiber` across the optics and magnetism units.

**Tradeoff.** Two view implementations to maintain for the pilot experiment.

**Impact.** No change to bundle size unless a student opens the pilot.

---

## D5 · The netlist is an ordinary experiment parameter

**Decision.** A bench's wiring is carried in `ParamValues` as a canonical
encoded string (`"c.a-k.b;k.a-r.a;…"`), not in component state.

**Reason.** `compute(params)` must stay pure and parameters must stay
serialisable. Encoding the netlist keeps both, and buys three things for free:
a reading is traceable to the circuit it came from, Reset restores a known
layout, and a mis-wiring is reproducible in a test by its encoding.

**Alternatives.** Wiring in React state inside the stage (breaks the model/view
split — `compute` could not see it); a new `ControlKind` (would have required
changing the shared `simulators.test` control checks, which are the regression
contract for 49 modules).

**Tradeoff.** The wiring control is declared as a `select` whose two or three
named options are the starting layouts; free wiring stores a value that is not
among them. That is slightly loose typing in exchange for not touching the
contract.

**Impact.** No change to `useLabState`, the notebook, the shell or any other
module.

---

## D6 · A3 stays as it is

**Decision.** `resistance-series-parallel` (A3, laws of combination) is **KEEP**,
not migrated to the bench.

**Reason.** §41 asks for classification before rewriting. A3 is a metre bridge:
a Wheatstone network whose defining interaction is sliding a jockey along a
uniform wire to find a null. Its current implementation already does that with a
real drag control, a real balance condition and a theory-vs-experiment
comparison in the notebook. Putting it on a netlist bench would replace a good
interaction with a worse one to satisfy a pattern.

**Alternatives.** Migrate it for consistency.

**Tradeoff.** The bench has one fewer consumer, so B9 was chosen as the second
reference instead — and that turned out to be the more valuable target, because
the migration exposed real physics errors.

**Impact.** None. The bench propagation order is now A1, A4, A5,
`battery-series-parallel`.

---

## D7 · Meters carry their real resistance, and the loading error is taught

**Decision.** The bench's ammeter has a real resistance and its voltmeter a
real, finite one, so V/I from the meters is not exactly the marked value.

**Reason.** It is what a real bench does, and the difference is examinable —
"why is the ammeter connected in series and the voltmeter in parallel" is a
standard viva question whose answer is about exactly this.

**Alternatives.** Ideal meters, which would make every reading agree with the
closed-form value and quietly remove a real source of error from the practical.

**Tradeoff.** A bench reading legitimately differs from the textbook number.
That has to be explained rather than hidden, so the theory tab, the sources of
error and the viva all now say so.

**Impact.** In the diode bench this surfaced a stronger effect: in reverse bias
the ammeter reads the *voltmeter's* own current, which for silicon is a thousand
times the diode's leakage. Rather than idealise it away, the bench uses a 10 MΩ
digital voltmeter, reports the voltmeter's current as its own reading so it can
be subtracted, and teaches the effect. This is the clearest case so far of the
model being more honest than the module it replaced.

---

## D8 · The portable splice is verified, not trusted

**Decision.** `scripts/portable.mjs` passes a **function** to every
`String.replace` that inserts content, and then asserts the bundle survived the
splice byte for byte before writing the file.

**Reason.** A string replacement interprets `$&`, `` $` ``, `$'` and `$1`–`$99`
as patterns. A minified bundle routinely contains `$&&` — a variable named `$`
followed by a logical and — and the old code spliced the matched `</body>` into
the middle of react-router, producing an 877 kB file that parsed as HTML and
threw `SyntaxError: Unexpected token '<'` on open. Every route rendered blank.

The bug was latent for the life of the repository: it only bites when the
minifier happens to name a variable `$` *and* place it before `&&`. Adding the
notebook code shifted the name assignment and triggered it. Nothing about the
old code was obviously wrong to read, which is exactly why it needed a check
rather than care.

**Alternatives.** Escape `$` in the replacement (fixes this splice, leaves the
next one to be got right by hand); parse the emitted script with esbuild (adds a
dependency edge to a build script for a weaker guarantee).

**Tradeoff.** None worth naming — the check is one string comparison.

**Impact.** `npm run build:portable` now exits non-zero rather than emitting a
broken offline file, and CI runs it on every push. The failure mode is
impossible to ship silently again.

---

## D9 · Canvas for the entities, DOM for the instrument

**Decision.** Physics entities that move every frame are painted on a `<canvas>`
in a `requestAnimationFrame` loop. The apparatus, its instruments and every
control stay SVG. The canvas is an overlay, never a replacement.

**Reason.** A full-canvas route would lose two things that took the whole 2.0
effort to build: the Chromium placement audit, which queries `svg.svg-lab`,
`.stage-ctl` and `.readout` and cannot see into a canvas; and the accessibility
tree, since a canvas has none — no `role="slider"`, no `aria-valuenow`, no
keyboard reach, no focus ring. Neither can be recovered without building a
parallel shadow DOM, which is a second source of truth and therefore a second
thing to drift.

The entities genuinely belong on the canvas: a hundred moving markers cost a
hundred draw calls rather than a hundred layout passes.

**Alternatives.** Everything on canvas (the literal reading of the brief);
canvas overlay only, apparatus untouched (smaller, but the entities stay
static).

**Tradeoff.** Two renderers per upgraded experiment, and a scene must declare a
logical size matching the apparatus's viewBox or the layers misalign.

**Impact.** All 49 routes keep their audit and their accessibility. Adding a
scene to an experiment is additive and reversible.

---

## D10 · A scene is per-experiment work, and that is the honest cost

**Decision.** Canvas scenes are written against each experiment's own geometry,
grouped into families that share physics. No generic "ambient" scene is applied
across the catalogue.

**Reason.** A scene that is not driven by that experiment's model is decoration,
and §42 rules out exactly that: "fake glowing electricity with no model
relationship", "unnecessary particle effects". Every scene shipped here draws
from the same numbers the readouts do — the superposed field, the ray
construction, the solved branch current, B(x) on the axis, the resonance
amplitude. That is what makes moving a control visibly change the picture for
the right reason.

**Alternatives.** A universal particle layer driven by `ModelOutput.readouts`,
which would have covered all 49 immediately and meant nothing on any of them.

**Tradeoff.** Coverage grows one experiment at a time. Twelve have scenes; the
rest keep an SVG apparatus that is already model-driven.

**Impact.** Five reusable scene families exist, so the next experiment in a
covered family is a layout function rather than a new renderer.
