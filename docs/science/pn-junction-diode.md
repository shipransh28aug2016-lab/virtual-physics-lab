# Scientific verification — the p–n junction diode (B9)

## Concept

A junction diode conducts easily in one direction and blocks in the other. The
practical measures its I–V characteristic in both directions and reads the knee
voltage from the forward curve and the reverse saturation current from the
reverse one.

## Equations

$$ I = I_s\left(e^{\,qV/\eta kT} - 1\right) \qquad
   I_s(T) = I_s(300\,\text{K})\cdot 2^{(T-300)/10} \qquad
   r_d = \frac{dV}{dI} = \frac{\eta kT}{qI} $$

The circuit imposes a load line

$$ I = \frac{E - V}{R_h + R_A + r} $$

and the operating point is where the two cross. The bench draws both and marks
the crossing, because the single most common misconception here is that the
diode alone decides the current.

## Device parameters

| Device | I_s at 300 K | η | Knee | Reverse leakage |
|---|---:|---:|---|---|
| Silicon | 1 nA | 1.8 | ≈ 0.7 V at a few mA | ≈ 1 nA |
| Germanium | 1 µA | 1.8 | ≈ 0.3 V | ≈ 1 µA |

An ideality of 1.8 is what puts a 1 nA device's knee at 0.7 V at milliampere
currents, which is where NCERT's characteristic shows it. An ideality of 1 with
the same I_s would put the knee near 0.5 V and reach an ampere by 0.7 V — the
value the pre-2.0 module used.

## What changed in 2.0, and why

| Before | After |
|---|---|
| `diodeCurrent(1e-9, V)` with V taken as the device voltage | the whole circuit is solved; V across the device is a result |
| the series resistance was in the drawing but not in the model | the series resistance sets the load line and limits the current |
| knee voltage was a hard-coded `0.7 − (T − 27)·0.002` readout | the knee is where the computed curve turns |
| I_s fixed, so "reverse current grows with temperature" was untrue in the model | I_s doubles per 10 K, so the viva answer and the model now agree |
| the graph clipped diode current to 20 mA | the sweep *ends* at the 50 mA rating, as a real one does; no datum is clipped |
| reverse bias was a negative applied voltage | reverse bias is the device turned round in its mount |
| "reverse current saturates near −1 µA" for a 1 nA device | silicon reads ≈ 1 nA, germanium ≈ 1 µA |

## An effect the model surfaced

With the voltmeter across the device, the ammeter in reverse bias reads the
**voltmeter's own current** as well as the diode's — once the junction blocks,
the voltmeter is the easiest path in that branch. With the 100 kΩ moving-coil
voltmeter first modelled, that current was 60 µA against a 1 nA silicon leakage:
the meter would have been reading nothing but itself.

The bench now uses a 10 MΩ digital voltmeter and **reports the voltmeter's own
current as a separate reading**, so a student can subtract it. The effect is
taught in the theory, the procedure, the sources of error and the viva rather
than idealised away. It is a real limitation of the real measurement.

## Boundary conditions

| Condition | Behaviour |
|---|---|
| supply 0 V | no current; the operating point sits at the origin |
| bare bench / key open | open circuit fault; both meters read zero |
| forward current past 50 mA | over-range fault, and a warning to raise the series resistance |
| device swapped in the mount | socket spacing is fixed by the mount, so the wiring stays valid |
| 0–100 °C over the whole control range | every reading finite, asserted for 72 combinations |

## Test anchors

`src/simulations/experiments/iv-characteristic.bench.test.ts` (16) and
`src/physics-engine/physics.test.ts` (the I_s doubling rule and the two knees).

- silicon at 3 V through 220 Ω: 0.6 V < V_D < 0.8 V, 2 mA < I < 20 mA
- germanium at the same setting: 0.2 V < V_D < 0.45 V
- current ×10 moves the diode voltage by less than 0.25 V
- series resistance 10 Ω vs 1000 Ω changes the current by more than ×5
- reverse silicon leakage 0.5–5 nA; germanium at least 100× more
- reverse ammeter reading equals the voltmeter current for silicon, to 1e-8 A

## Known simplifications

1. No reverse breakdown: beyond the sweep range the model is not predictive, and
   the Zener region is not part of this practical.
2. No junction capacitance — the practical is d.c.
3. No bulk series resistance in the diode itself, so at very high forward
   current the curve is slightly steeper than a real device's.
4. Self-heating is not modelled: the temperature is the bench temperature the
   student sets, not one the current raises.

## References

- NCERT Physics Part II, Class XII, Chapter 14 — Semiconductor Electronics:
  the junction diode, forward and reverse characteristics, knee voltage.
- CBSE Physics Curriculum 2026-27, Section B practical 9.
