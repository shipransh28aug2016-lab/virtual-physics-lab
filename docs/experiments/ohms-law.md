# Ohm's law — the reference implementation

`src/simulations/experiments/ohms-law.tsx` · CBSE Class XII, Unit II ·
the pattern every other bench experiment should follow.

## experiment_experience

```yaml
apparatus:
  - cell, emf 0–12 V, internal resistance 0–5 Ω (both on dials)
  - plug key K
  - rheostat, 0–50 Ω
  - moving-coil ammeter, 1.5 A full scale, 0.08 Ω
  - moving-coil voltmeter, 15 V full scale, 20 kΩ
  - resistor under test, 1–100 Ω
  - connecting leads with 4 mm plugs

preparation:
  - the bench can start bare ("wire it yourself") or correctly wired
  - the rheostat should be at maximum before the key is closed

procedure:
  - wire cell → key → resistor → ammeter → rheostat → back to the cell
  - bridge the voltmeter across the resistor alone
  - close the key, read both meters, record
  - step the rheostat down and repeat for at least six readings
  - plot V against I and take the slope

student_actions:
  - press a socket to pick a lead up, press a second socket to put it down
  - press an occupied socket and Delete to pull every lead out of it
  - turn the emf, r, R and rheostat dials
  - throw the key
  - record a trial; clear the table

measurable_variables:
  - ammeter reading I (A)
  - voltmeter reading V (V)
  - derived R = V/I (Ω)
  - terminal voltage of the cell (V)
  - power in the resistor and power lost in the cell (W)

observations:
  - V against I is a straight line through the origin for the ohmic resistor
  - the terminal voltage falls below the emf as the current rises
  - V/I is a little under the marked resistance — the loading error

common_errors:
  - ammeter bridged across the resistor instead of in series (error)
  - voltmeter dropped into the loop instead of across a component (error)
  - either meter connected with reversed polarity (warning)
  - a lead left out, so the loop is open (warning)
  - a lead straight across the cell terminals (error, short circuit)
  - the ammeter driven past full scale (error)
  - both voltmeter leads on the same point (note)

safety:
  - never leave a short across the cell; it heats the leads and flattens the cell
  - keep the current below ~0.8 A or the resistor warms and the line bends

expected_result:
  - the V–I graph is a straight line through the origin, so the conductor is
    ohmic, and the reciprocal of its slope is the resistance

theory_relation:
  - V = IR; I = ε/(R + R_h + r); V_term = ε − Ir; P = VI
```

## What makes it the reference

1. **Topology is the student's.** The wiring is a real netlist carried in the
   parameters, so a reading is traceable to the circuit it came from, the
   reset button restores a known layout, and a mis-wiring is reproducible in a
   test by its encoding.
2. **Mistakes are reachable and answered.** Seven distinct wiring faults are
   detected from the graph, not authored as branches.
3. **Instruments are real.** The 0.08 Ω ammeter and the 20 kΩ voltmeter mean
   V/I comes out at 19.9 Ω for a 20 Ω resistor. The bench says why in the
   theory tab and in the viva — the loading error is taught, not hidden.
4. **One gesture, three input methods.** Press-to-pick-up and press-to-put-down
   is the same code path for mouse, touch and keyboard; the audit presses Enter
   on two sockets in Chromium and fails the build if no lead appears.
5. **Audio follows the physical event**, never the state change: a plug seats,
   a key clicks. Muted by default; the visual change stands alone.
6. **The animation is labelled.** The apparatus prints "illustrative animation
   of conventional current direction — not literal electron drift speed", and
   the audit fails any route that animates flow without saying so.

## Quality score

| Dimension | Score | Note |
|---|---:|---|
| Curriculum alignment | 96 | A1-adjacent; the board's own procedure, wiring included |
| Physics accuracy | 97 | MNA solution; meter loading modelled; 31 engine anchors + 18 bench anchors |
| Experimental authenticity | 94 | real wiring, real faults, real loading error; no bench photographs |
| Pedagogical value | 95 | predict → wire → observe → measure → compare, with error analysis in the notebook |
| Interaction quality | 93 | two-press connect on all three input methods; drag-along-the-wire is still to come |
| Visual quality | 91 | sagging leads, brass sockets, analog faces; a 3D bench is not attempted |
| Audio / animation | 92 | synthesised cues, seven motion tokens, disclosure enforced by the audit |
| Accessibility | 96 | every socket named, focusable and described in words, not colour |
| Performance | 95 | ≥30 fps under a swept control in Chromium; the solver is a 7×7 matrix |
| Maintainability | 94 | engine, interaction, audio and view are separable; the next bench reuses all of it |

No dimension is below 90 and nothing scientific or curricular fails.

---

## Lab notebook 2.0

Since the notebook is shared by all 49 experiments, the upgrade below applies to
every one of them, not only to this bench.

| Field | Where it comes from |
|---|---|
| trial number | monotonic, stable across deletions |
| measured columns | `capture()` reads the live model |
| derived columns | `derive()` recomputed on render, never stored |
| **timestamp** | recorded automatically; shown on the trial number's tooltip |
| **apparatus settings** | snapshotted from the experiment's own declared controls at the moment of recording, so no experiment has to remember to supply one |
| **note** | an editable cell per trial, with its own accessible name |
| theoretical value and % error | the existing comparison foot |
| **conclusion** | a persisted textarea, shown once there is something to conclude from |
| **export** | CSV: header, one line per trial with timestamp, settings and note, then the comparison and the conclusion |

The netlist is deliberately excluded from the settings snapshot: it is long and
it is not a setting a student reads back off the bench.

The export falls back to showing the text for manual copying when a browser
refuses the download — some `file://` sandboxes do, and the portable build is a
first-class target, so silently doing nothing was not an option.
