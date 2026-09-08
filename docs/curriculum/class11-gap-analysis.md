# Class XI — coverage against the CBSE 2026-27 curriculum

## Current state: zero

The lab has **no Class XI content**. This is structural, not an oversight of
authoring: `UnitSlug` in `src/types/lab.ts` admits only the nine Class XII units
plus the two practical sections, so a Class XI module cannot currently be filed
anywhere. `src/data/units.ts` likewise carries only the Class XII map, and every
route and page is written against it.

## What has to change first

1. `UnitSlug` gains the Class XI units and the two Class XI practical sections.
2. `src/data/units.ts` gains a Class XI table with its own marks and chapters.
3. A `class` field (`11 | 12`) on the meta, so the catalogue, the search, the
   unit pages and the routes can separate the two years. `catalogue.test.ts`
   asserts the practical tables per class.
4. Routes: `/class-11`, `/class-11/:unit`, mirroring the Class XII pages, which
   already read entirely from the registry.

None of this touches the physics engine, the bench, the experiment contract or
any existing module. It is catalogue work, and it is a prerequisite for all of
the content below.

## The nine Class XI units and where the lab already has the machinery

| Unit | Marks | Engine support today | Effort |
|---|---:|---|---|
| I · Physical World and Measurement | 23 (with II) | none | low — vernier/screw-gauge least count is a measurement simulator, and it is exactly what the uncertainty vocabulary in §21 is for |
| II · Kinematics | 23 (with I) | `numerical`, `vectors` | low — projectile and relative motion are pure kinematics over the existing vector module |
| III · Laws of Motion | 17 (with IV) | `vectors` | medium — friction, circular motion; needs a small rigid-body layer |
| IV · Work, Energy and Power | 17 (with III) | `vectors` | low — collisions, energy bar charts |
| V · Motion of System of Particles and Rigid Body | 20 (with VI) | `vectors` | medium — moment of inertia, torque, angular momentum |
| VI · Gravitation | 20 (with V) | `constants`, `vectors` | low — orbital motion, escape velocity, Kepler plots |
| VII · Properties of Bulk Matter | 20 (with VIII, IX) | none | medium — elasticity, surface tension, viscosity, calorimetry |
| VIII · Thermodynamics | 20 (with VII, IX) | none | medium — p–V work, cycles, efficiency |
| IX · Behaviour of Perfect Gas and Kinetic Theory | 20 (with VII, VIII) | none | medium — a kinetic-theory visualisation must be labelled conceptual per §37 |
| X · Oscillations and Waves | 10 | `waves-acoustics` | **low — start here** |

## Recommended order

1. **Oscillations and Waves.** `waves-acoustics` already exists and the
   sonometer practical already uses it. SHM, a simple pendulum, resonance and
   beats are the cheapest real modules in the whole plan, and the pendulum is
   also a Class XI practical.
2. **Measurement.** Vernier callipers and the screw gauge. These are the
   canonical Class XI practicals, they are pure interaction and reading, and
   they are the natural home for least count, zero error and the uncertainty
   model §21 asks for. Building them here means Class XII inherits the
   vocabulary.
3. **Kinematics and Gravitation.** Both are closed-form over the existing
   vector module; projectile motion and orbits are high-recognition modules.
4. **Work, Energy and Power.** Collisions on the same base.
5. Everything else in weighting order.

## Class XI practicals worth building first

| Practical | Why |
|---|---|
| Vernier callipers — diameter and volume of a cylinder | least count, zero error, repeated readings |
| Screw gauge — thickness of a sheet and diameter of a wire | the same, at a finer least count |
| Simple pendulum — L–T² graph and g | a graph-and-slope practical with an existing engine |
| Helical spring — force constant from load and extension | linear fit, clean error analysis |
| Surface tension by capillary rise | a measurement with a real bench geometry |
| Coefficient of viscosity by terminal velocity | terminal velocity is a satisfying live model |

## Honest scope note

Class XI is roughly the same size as Class XII. Delivering it is a programme,
not a phase, and doing it well means resisting the temptation to ship L1 demos
across ten units to claim coverage. The value of this lab is that its modules
are measurement simulators; a Class XI section of animated diagrams would dilute
that. The order above is deliberately front-loaded with the units where a real
measurement simulator is cheapest to build well.
