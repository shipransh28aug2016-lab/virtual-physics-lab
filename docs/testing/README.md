# Testing strategy

Extend, never replace. The 1.0 suites are the regression contract for 49
experiment modules; nothing in 2.0 has changed one of them.

## The gates

```sh
npm run typecheck                 # tsc --noEmit, strict
npm run lint                      # eslint --max-warnings=0
node scripts/gen-catalogue.mjs --check
npm test                          # vitest
npm run build && npm run build:portable
npm run audit && npm run audit:portable   # real Chromium, http and file://
```

All seven must be green before a commit. CI runs exactly this list.

## What each suite is for

| Suite | Count | Question it answers |
|---|---:|---|
| `physics-engine/physics.test.ts` | 51 | does the model still agree with NCERT and CODATA? |
| `physics-engine/circuit/circuit.test.ts` | 31 | does the solver get known networks right, and do faults fire only when they should? |
| `physics-engine/circuit/encode.test.ts` | 6 | is a netlist canonical, and does a malformed string degrade rather than throw? |
| `experiments/catalogue.test.ts` | 76 | is the CBSE practical table still satisfied, row by row? |
| `simulations/simulators.test.tsx` | 392 | does every module mount, compute finite values across its whole control range, and match the catalogue that lists it? |
| `simulations/experiments/*.bench.test.ts` | 34 | does this bench get the physics right, **and does it respond correctly to being wired wrongly?** |
| `lab/motion`, `lab/audio`, `lab/interaction`, `lab/feedback` | 38 | do the experience subsystems degrade, mute, collapse and describe correctly? |
| `app/layout/preferences.test.tsx` | 3 | do the sound and motion switches actually reach the bus and the document? |
| `i18n/i18n.test.tsx` | 1 | does a missing key degrade rather than throw? |

## The browser audit

`scripts/check-placement.mjs` mounts every route in real Chromium and asserts
what a screenshot would otherwise need eyeballing:

- the apparatus fills its panel; no horizontal scroll at 1440 px or 360 px;
- no on-apparatus handle covers a label or leaves the drawing;
- every handle is keyboard-reachable and announces a value;
- the graph draws a real series; no reading shows NaN or Infinity;
- frames stay above 30 fps while a control is swept;
- clicking through to another experiment actually swaps the apparatus.

**Added in 2.0:**

- every bench socket has an accessible name and is in the tab order;
- two Enter presses on two sockets actually connect a lead — the keyboard path
  is verified in a real browser, not only in jsdom;
- any route that animates charge flow must print the disclosure that the
  animation is not electron drift speed. This check caught a real violation in
  `resistivity-vi-graph` on its first run.

It runs against `dist/` over http and against the single portable file over
`file://`, because the two builds differ (code splitting versus one inlined
bundle) and a `file://`-only failure has happened before.

## The portable build checks itself

`scripts/portable.mjs` exits non-zero if more than one bundle is emitted, if any
external reference survives, or — added after it happened — **if the bundle text
did not survive being spliced into the HTML byte for byte**. That last check
exists because a `String.replace` with a string replacement interprets `$&` and
friends as patterns, and a minified bundle routinely contains `$&&`. The result
was an offline file that parsed as HTML and threw `SyntaxError` on open, with
every route blank. See `docs/upgrade/decision-log.md` D8.

The lesson generalises: the portable target is a *different build*, and a check
that runs only against `dist/` will not see its failures. Both audits must be
green.

## Writing a bench test

A bench test is not only "does the physics come out right". Half of it is
**does the apparatus respond correctly to being used wrongly** — that is the
behaviour 2.0 added, so it is the behaviour that needs pinning. Build the
mis-wiring with `addWire`/`removeWire` from the correct one, so the test reads
as the physical action a student took:

```ts
// Take the ammeter out of the loop and hang it across the resistor instead.
let w = removeWire(CORRECT_WIRING, 'r.b', 'am.a');
w = removeWire(w, 'am.b', 'rh.a');
w = addWire(w, 'r.b', 'rh.a');
w = addWire(w, 'am.a', 'r.a');
w = addWire(w, 'am.b', 'r.b');
expect(at({ wiring: w }).faults.map((f) => f.kind)).toContain('ammeter-in-parallel');
```

Every bench also needs a sweep asserting that **no combination of controls
produces a non-finite number**. The browser audit greps the whole page for
`NaN` and `Infinity`, so one escaping value fails the build — which is the
behaviour we want, but it is cheaper to catch in a unit test.

## What is deliberately not tested

- The exact pixel layout of an apparatus. The audit asserts relationships
  (fills, does not overlap, does not escape) rather than coordinates, so a
  redesign does not have to rewrite the tests.
- Audio output. There is nothing to assert about a sound; the tests cover the
  contract around it — muted by default, no-op without Web Audio, one cue per
  completed connection, never the only channel.
