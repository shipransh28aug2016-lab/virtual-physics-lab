# The lab audio system

## Why it exists

A real bench makes noise, and the noise is information: a key clicks when it
closes, a plug seats with a thunk, a pointer ticks past a division. 2.0 adds
those cues so an action feels like it happened to a physical object.

## Rules the code enforces

| Rule | Where |
|---|---|
| Off until the student turns it on | `PreferencesProvider` default `sound: false` |
| Never the only channel — a cue always accompanies a visual change | the bus cannot render anything; asserted per call site |
| Degrades to a no-op with no Web Audio | `AudioBus.ensure()` returns `null`, `play()` returns `false` |
| Zero assets | every cue is synthesised — see `sounds.ts` |
| No continuous sound without an explicit opt-in | only one-shot cues are in the table |
| A cue with no meaning does not ship | `Cue.meaning` is required and tested |

`play()` returns a boolean so a caller can distinguish *muted* from
*unsupported*, but no caller has to check: a cue is always safe to fire.

## The cue table

| Cue | Meaning | Synthesis |
|---|---|---|
| `switchOn` / `switchOff` | the key was thrown | 18–20 ms bandpassed noise + a short square tone |
| `plug` / `unplug` | a lead seated / was pulled | 30 ms low noise + a swept sine |
| `needle` | the pointer crossed a major division | 8 ms noise tick at 5.2 kHz |
| `record` | a reading went into the notebook | rising two-tone |
| `error` | a fault appeared or an action was refused | falling two-tone, soft |
| `success` | a balance or a valid measurement configuration | rising fifth |

Every layer is ≤ 200 ms and ≤ 0.6 gain before the master (which is itself
halved), and the noise generator is seeded so a cue sounds identical twice.

## Portable build

Nothing in this subsystem adds a byte of asset. The whole system is roughly 6 kB
of source, which is why the single-file build stays where it was.

## Accessibility

Audio is an addition to, never a replacement for, the visual and ARIA channels.
The continuous current hum described in the 2.0 brief is deliberately **not**
implemented: a persistent tone is the cue most likely to be experienced as
noise, and the visual flow cue already carries the same information.
