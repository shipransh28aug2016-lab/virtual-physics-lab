# Class XII — coverage against the CBSE 2026-27 curriculum

Census taken from the 49 `.meta.ts` files on the branch, not from memory.
Quality levels follow `docs/upgrade/stage0-repository-map.md`:

```
L0 theory only · L1 visual demo · L2 interactive simulator
L3 measurement simulator · L4 virtual practical · L5 immersive laboratory
```

## Theory units

| Unit | Marks | Modules | Level | Verdict |
|---|---:|---:|---|---|
| I · Electrostatics | 16 (with II) | 5 | L2–L3 | adequate; Gauss's law and dielectrics are thin |
| II · Current Electricity | 16 (with I) | 6 + 3 practicals | **L4** | strongest unit; Ohm's law is the reference bench |
| III · Moving Charges & Magnetism | 17 (with IV) | 7 + 2 practicals | L2–L3 | strong on fields, thin on magnetic materials |
| IV · EMI and Alternating Current | 17 (with III) | 2 + 1 practical | L2 | **weakest examined unit** — see below |
| V · Electromagnetic Waves | 4 | 1 | L1 | one explorer; acceptable for the weighting |
| VI · Optics | 18 | 9 + 9 practicals | L3–L4 | broadest unit; ray optics is well covered |
| VII · Dual Nature | 12 (with VIII) | 1 | L3 | photoelectric effect only; de Broglie missing |
| VIII · Atoms and Nuclei | 12 (with VII) | 1 | L2 | Bohr spectrum only; **nuclei entirely absent** |
| IX · Electronic Devices | 7 | 1 + 1 practical | L3→**L4** | diode bench is now a reference; logic gates absent |

## Practicals

All 15 board practicals are present and filed in the correct section — asserted
row by row by `catalogue.test.ts`, which *is* the specification.

| No. | Module | Level | Note |
|---|---|---|---|
| A1 | `resistivity-vi-graph` | L4 | shared `SeriesLoop`; a bench migration candidate |
| A2 | `meter-bridge-resistivity` | L4 | drag jockey, real balance |
| A3 | `resistance-series-parallel` | L4 | metre bridge; **keep** — not a netlist circuit |
| A4 | `galvanometer-half-deflection` | L3 | bench migration candidate, high value |
| A5 | `galvanometer-conversion` | L3 | bench migration candidate |
| A6 | `sonometer` | L3 | resonance, not a circuit |
| B1–B4 | mirrors and lenses | L4 | four modules from two shared factories |
| B5 | `prism-dispersion` | L4 | δ_m anchored to NCERT |
| B6–B8 | refractive index | L3–L4 | |
| B9 | `iv-characteristic` | **L4** | migrated to the bench; load line and both knees |

Plus one Section B activity, `glass-slab` (lateral shift), beyond the list.

## Ranked gaps

| # | Gap | Marks at stake | Effort | Why it ranks here |
|---|---|---:|---|---|
| 1 | **Nuclei**: mass defect, binding-energy curve, radioactive decay, half-life | 12 (VIII with VII) | medium | a whole examined chapter with no simulator; the binding-energy curve and a decay-law plot are both natural measurement simulators |
| 2 | **AC circuits**: series LCR, resonance, phasors, impedance, power factor, transformer | 17 (IV with III) | medium | one of the two heaviest blocks, and the unit has two modules; LCR resonance is the classic missing bench |
| 3 | **Logic gates & transistor** | 7 (IX) | low | truth tables are cheap and examinable; the bench already has the parts model to extend |
| 4 | **de Broglie / matter waves** | 12 (VII with VIII) | low | one module beside the photoelectric effect closes the unit |
| 5 | **Gauss's law applications** — sphere, sheet, cylinder | 16 (I with II) | low | field-vs-r plots are a natural L3 module |
| 6 | **Magnetic materials** — hysteresis, dia/para/ferro | 17 (III with IV) | low | a B–H loop is a good measurement simulator |
| 7 | **Capacitors in combination**, dielectrics, energy stored | 16 (I with II) | low | the bench's parts model extends to capacitors |
| 8 | **AC generator, eddy currents** | 17 (IV with III) | medium | complements Lenz's law, already present |

## Ranked upgrades to existing modules

| # | Module | From | To | Why |
|---|---|---|---|---|
| 1 | `resistivity-vi-graph` (A1) | L4 SVG loop | L4 bench | the board's own A1 procedure is a wiring task; shares everything with the Ohm's law bench |
| 2 | `galvanometer-half-deflection` (A4) | L3 | L4 bench | half-deflection is about *where* the shunt goes — a wiring question the current module cannot pose |
| 3 | `galvanometer-conversion` (A5) | L3 | L4 bench | same; the shunt and multiplier are physical parts |
| 4 | `battery-series-parallel` | L2 | L4 bench | cells in series/parallel is a wiring task by definition |
| 5 | `pn-junction-rectifier` | L2 | L3 | the bench's diode model now supports a real half/full-wave rectifier |

## Method

Chapter strings are validated against the real NCERT chapter list per unit by
`catalogue.test.ts`, so no module can claim a chapter belonging to another unit.
Marks are the CBSE 2026-27 block totals from `src/data/units.ts`; the board
groups units into blocks, so a figure shown against two units is the block
total they share.
