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
