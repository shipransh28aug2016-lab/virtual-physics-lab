# Scientific verification — the circuit engine

## Concept

A circuit is a linear network of two-terminal elements plus, for the junction
diode, one nonlinear element. Node potentials are found by **modified nodal
analysis**: Kirchhoff's current law is written at every node, each element
contributes ("stamps") its conductance, and an ideal voltage source adds a row
for its own branch current.

## Equations

| Element | Stamp |
|---|---|
| Resistance R between a, b | conductance G = 1/R on the (a,a), (b,b) diagonal, −G off-diagonal |
| Cell, ε with internal resistance r > 0 | Norton equivalent: G = 1/r with a current source εG out of the positive terminal |
| Cell, ideal (r = 0) | voltage-source row: V(a) − V(b) = ε, with the branch current as an extra unknown |
| Diode | companion model at the operating point: G_eq = dI/dV, I_eq = I(V₀) − G_eq·V₀ |

Diode current is the Shockley equation

$$ I = I_s\left(e^{\,V/(\eta V_T)} - 1\right), \qquad V_T = \frac{kT}{q} $$

and the network is iterated by Newton's method with junction-voltage limiting
until the change in every junction voltage is below 10⁻⁷ V.

## Assumptions

- **Lumped elements.** No transmission-line effects, no stray capacitance or
  inductance; this is a d.c. bench, which is what the Class XII practicals are.
- **Steady state.** Transients are the business of the separate RC and RL
  modules, which keep their closed-form solutions.
- **Ohmic conductors at fixed temperature.** Resistance does not drift with the
  heating the model itself reports; the warning that it would on a real bench is
  raised as a fault instead of being silently modelled.
- **Real instruments.** An ammeter carries its stated resistance and a voltmeter
  its stated (finite) resistance, so meter loading is a computed consequence,
  not a special case. This is deliberately *less* idealised than the closed-form
  modules and is why a bench reading can legitimately differ from the textbook
  value by the loading error.
- **Contact resistance.** Leads and closed keys carry 1 mΩ, so a short circuit is
  limited by something physical rather than by a guard clause.

## Units

SI throughout: volts, amperes, ohms, watts, kelvin. The view converts.

## Boundary conditions

| Condition | Behaviour |
|---|---|
| Open key / broken path | branch not stamped; every current in the loop is zero |
| Component wired to nothing | its terminals are separate nodes; it solves and carries nothing |
| Empty bench | solves to an empty solution, does not throw |
| Unreferenced island | grounded independently; 10⁻¹² S leakage keeps the matrix non-singular |
| Diode exponent > 80 | clamped, so a forward sweep cannot overflow to Infinity |
| Short circuit | I = ε/(r + contact resistance), reported as an error-level fault |

## Test anchors

`src/physics-engine/circuit/circuit.test.ts`

| Anchor | Value |
|---|---|
| ε = 6 V, r = 0.5 Ω, R = 20 Ω | I = 6/20.5 = 0.29268 A |
| ideal cell, R = 20 Ω | I = 0.300000 A exactly |
| 10 Ω + 20 Ω series | I = ε/30 |
| 10 Ω ‖ 20 Ω | branch currents 0.6 A and 0.3 A, source 0.9 A |
| KVL | Σ drops = terminal voltage to 1 part in 10⁸ |
| voltmeter 10 kΩ across 1 kΩ of a 1 kΩ + 1 kΩ divider | reads 2.86 V, not 3.00 V |
| silicon diode, I_s = 1 pA, η = 1, 5 V through 470 Ω | V_D ≈ 0.6 V |
| diode sweep −5 V … +5 V | converges at every step, monotonic in V |

## Known simplifications

1. The diode has no series resistance and no reverse breakdown; beyond the
   sweep range the model is not claimed to be predictive.
2. Rheostat travel is linear in the slider fraction. Real wire-wound rheostats
   are close to linear; the difference is not examinable at this level.
3. Galvanometer damping is a property of the *view* (the needle settle), not of
   the solver, which reports the steady deflection.

## References

- NCERT Physics Part I, Class XII, Chapter 3 (Current Electricity) — Ohm's law,
  internal resistance, Kirchhoff's rules, the metre bridge and the potentiometer.
- NCERT Physics Part II, Class XII, Chapter 14 (Semiconductor Electronics) —
  the junction diode characteristic and the knee voltage.
- CBSE Physics Curriculum 2026-27, Section A and Section B practical lists.
