# Scientific verification — galvanometer resistance by half deflection (A4)

## Concept

A moving-coil galvanometer's own coil resistance G cannot be measured with an
ohmmeter without risking the movement. The half-deflection method measures it
using only the galvanometer itself, a high series resistance and a shunt.

## Equations

Set full-scale deflection with a high series resistance R:

$$ I_g = \frac{\varepsilon}{R + G} $$

Bridge a shunt S across the coil and reduce it until the deflection halves. At
that point

$$ S = \frac{RG}{R+G} \quad\Longleftrightarrow\quad G = \frac{RS}{R-S} $$

and the figure of merit is $k = I_g/n$.

**Derivation of the shunt condition.** With the shunt in place the total
resistance is $R + \frac{GS}{G+S}$ and the coil takes the fraction
$\frac{S}{G+S}$ of the total current, so

$$ I_g' = \frac{\varepsilon S}{R(G+S)+GS}. $$

Setting $I_g' = \tfrac12 I_g$ gives $S(R+G) = RG$, hence $S = RG/(R+G)$: the
shunt that halves the deflection is the *parallel combination* of R and G, which
is close to G itself whenever $R \gg G$.

## What changed in 2.0

| Before | After |
|---|---|
| `trueG` was a **slider** — the student could dial the answer | three galvanometers in a cupboard, told apart only by the label; the coil resistance is not a control |
| the figure of merit was computed from a typed-in full-scale current | derived from the instrument and the scale it is read on |
| deflection came from the constant-total-current approximation | the whole circuit is solved, so the approximation's error is a result rather than an assumption |
| the shunt was a knob; it could not be put in the wrong place | the shunt and its key are parts the student wires **across** the coil — or, if they choose, into the loop |
| "why is the measured G slightly less than the true value?" was asserted in the viva but could not be shown | the bench measures low by about 0.5%, for exactly the reason the viva gives |
| K₁ was drawn permanently closed | K₁ is a real key |

## The mistake the method depends on not making

Wiring the shunt **in the loop** instead of **across the coil** adds a few tens
of ohms to ten thousand: the deflection falls by well under a percent and no
half-deflection point exists anywhere in the shunt's range. That is offered as a
named layout so it can be tried deliberately, and the test suite pins it — the
deflection stays above 94% of full scale for every shunt setting from 5 Ω to
500 Ω.

## Instruments

| Case | G | Full scale |
|---|---:|---:|
| Galvanometer A | 62 Ω | 300 µA |
| Galvanometer B | 118 Ω | 150 µA |
| Galvanometer C | 45 Ω | 500 µA |

Three different instruments mean three different balancing shunts, so a student
cannot carry an answer from one attempt to the next.

## Test anchors

`src/simulations/experiments/galvanometer-half-deflection.bench.test.ts` (16)

- default setting puts the pointer between 29 and 30 of 30 divisions
- at S = RG/(R+G) the deflection is half the full-scale value
- G = RS/(R−S) recovers the marked value for all three instruments
- the measured value is low by less than 3% and never high by more than 0.5 Ω
- shunt in the loop: deflection stays above 94% of full scale for every S
- key open reads zero and reports an open circuit
- R = 1 kΩ at 6 V drives the pointer past the stop and reports over-range
- 72 control combinations, all finite

## Known simplifications

1. The pointer position is the steady deflection; the needle's damped swing is
   a property of the view, not of the solver.
2. No temperature coefficient on the coil.
3. The scale is linear, as a moving-coil scale is to a good approximation.

## References

- NCERT Physics Part I, Class XII, Chapter 4 — Moving Charges and Magnetism:
  the moving-coil galvanometer, current sensitivity, shunts.
- CBSE Physics Curriculum 2026-27, Section A practical 4.
