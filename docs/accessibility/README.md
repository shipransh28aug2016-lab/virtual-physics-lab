# Accessibility in the lab

The rule: **every physical action has a non-pointer equivalent, and it is the
same code path.** A second, parallel "accessible mode" is a mode that drifts.

## Wiring the bench

| Action | Pointer | Keyboard | Touch |
|---|---|---|---|
| pick a lead up | click a socket | Tab to it, Enter or Space | tap |
| put the lead down | click a second socket | Tab, Enter or Space | tap |
| cancel | click the held socket again | Enter on it again | tap |
| disconnect everything at a socket | — | Delete or Backspace | — |

All four run through `useConnect`, which is why `connect.test.tsx` can assert
that presses arriving in either order reach an identical netlist. The Chromium
audit presses Enter on two sockets on every bench route and fails the build if
no lead appears.

Each socket carries:

- `role="button"`, `tabIndex=0`, a visible focus ring;
- `aria-label` — the part and which terminal ("Cell, positive terminal");
- `aria-description` — the live state *and the next action*, in words:
  "connected by 2 leads. Press to start another lead, or Delete to disconnect";
- `aria-pressed` while a lead is held there.

A test asserts the description never names a colour, because colour is not
available to every student and is not available at all to a screen reader.

## Controls on the apparatus

Unchanged from 1.0 and still enforced by the audit on all 49 routes: knobs are
`role="slider"` with `aria-valuenow`/`aria-valuetext`, arrows step, PageUp/Down
jump a tenth of the range, Home/End go to the stops; keys are `role="switch"`
with `aria-checked`; mode selectors are radio groups with roving tabindex.

## Motion

Two independent switches, both honoured:

- the OS `prefers-reduced-motion` setting;
- the in-app **Motion off** button, which writes `data-motion` on the document.

Every motion token collapses to zero duration under either, asserted by
iterating the token table so a token added later cannot skip the check.

> Fixed in 2.0: the in-app switch writes `data-motion` on `<html>`, but four CSS
> rules were scoped to `body[data-motion="off"]` and so never matched. The
> button appeared to work and did nothing for those animations. The selectors
> are now document-scoped, and the current-flow cue and needle swing were added
> to the set the switch actually stops.

## Sound

Off by default, toggled from the header, and never the only channel — every cue
accompanies a visual change that stands on its own. A student who never turns it
on loses no information.

## Screen readers

Readings, faults and the notebook are ordinary DOM: the measurements panel is a
labelled region, the issue list is `aria-live="polite"` so a new fault is
announced, and the observation table is a real `<table>` with a caption.
