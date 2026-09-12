# The lab motion language

Seven tokens, one table, `src/lab/motion/tokens.ts`. Every animated element in
the apparatus must name the token it uses, and a token names what it is allowed
to mean.

| Token | Duration | Curve | Means |
|---|---:|---|---|
| `snap` | 120 ms | `cubic-bezier(.2,.9,.3,1.2)` | a connection was made |
| `throw` | 90 ms | linear | a switch or key moved mechanically |
| `settle` | 260 ms | `cubic-bezier(.34,1.2,.4,1)` | an instrument settling onto a reading |
| `turn` | 0 | — | a knob follows the pointer with no lag |
| `flow` | period from ‖I‖ | linear | conventional current direction |
| `shake` | 180 ms | `cubic-bezier(.36,.07,.19,.97)` | the apparatus refused an action |
| `confirm` | 200 ms | `cubic-bezier(.2,.7,.3,1)` | a reading was accepted |

## Reduced motion

`durationOf(token, true)` is `0` and `transitionOf(token, prop, true)` is
`'none'` for every token — asserted in `motion.test.ts` by iterating the table,
so a token added later cannot skip the check. CSS honours both
`prefers-reduced-motion` and the in-app `[data-motion="off"]` attribute.

## Scientific honesty

`flowPeriodSeconds(I)` maps the model's own current onto the animation period —
a heavier current visibly moves faster — bounded to 0.25–3 s so the cue stays
readable. It is **not** a claim about drift velocity, and any view that uses it
must be able to show `FLOW_DISCLOSURE`:

> Illustrative animation of conventional current direction — not literal
> electron drift speed.

## Why `settle` is 260 ms

Because that is what the moving-coil meter already used before 2.0, and it was
right. The token table promoted the existing behaviour rather than replacing it;
the needle's damped overshoot is now the shared vocabulary for every instrument
that has to arrive at a reading.
