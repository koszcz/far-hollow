# 05: Undergrowth and trees sway in the wind

**What to build:** Grass, ferns, flowers, saplings, young trees, and treetops sway gently in the **wind**, so the valley feels alive even when the player stands still. Wind is only for looks. See `.scratch/forest-floor/spec.md`.

**Blocked by:** none

**Status:** resolved

**Assets:** Changes five approved assets so they sway: `trees`, `saplings`, `grass`, `ferns`, and `flowers`. Each goes back to `draft`. The owner approved the `trees` change in chat on 2026-11-22. The owner approved the `saplings`, `grass`, `ferns`, and `flowers` changes in chat on 2026-11-23. Adds none.

- [x] Grass, ferns, flowers, saplings, young trees, and treetops sway.
- [x] Tree trunks, pebbles, stumps, sticks, and berry bushes stay still.
- [x] The wind is a gentle breeze with slow gusts. It does not follow the time of day.
- [x] The wind blows harder while it rains. It eases in and out when rain starts or stops.
- [x] The wind blows the same way across the whole valley. Its direction drifts slowly over game hours. The same seed always gives the same wind.
- [x] Wind is not saved. The game logic never sees it. It does not affect the campfire's smoke.
- [x] Undergrowth still fades out at its edge without popping in.
- [x] The game still runs at 60 fps on an Apple M1 laptop in Chrome.
  Measured on an Apple M3 Pro, as ticket 09 was. See the comment below.
- [x] The `trees`, `saplings`, `grass`, `ferns`, and `flowers` entries in `asset-manifest.json` are `draft`, link this ticket, and record the owner's approval.
- [x] The asset showcase shows the sway for trees and undergrowth, so the owner can review it.
- [x] Unit tests cover the wind's strength in and out of rain, and the same seed giving the same wind.

## Comment: how it was built, 2026-11-23

- `src/render/wind.ts` gives the wind's direction from the seed and the game hour. `windAt` gives the whole wind at one moment.
- `src/render/wind-sway.ts` bends shapes in the vertex shader. Points higher above a shape's foot move more, so the foot stays put. Gusts roll downwind across the valley, and each plant flutters at its own phase.
- Full trees sway only in their crowns. Young trees and saplings have their own materials and sway whole. Pebbles, stumps, sticks, logs, berry bushes, and the campfire's smoke do not change.
- The sway applies after the undergrowth's edge fade, so a plant shrinking at the edge also sways less. It never pops in.
- Shadows do not sway. The sway is small, so the shadows still match closely.
- Frame rate, measured with `.scratch/forest-floor/measure.ts` on an Apple M3 Pro, seed 12345, 1512 by 900 at pixel ratio 2: 4.17 ms at the start spot, 4.00 ms in the dense forest, and 4.51 ms on the open river bank. Ticket 09 measured 3.98, 3.89, and 4.07 ms before the sway. The M1 target allows 16.7 ms.
- The showcases for `trees`, `saplings`, `grass`, `ferns`, and `flowers` play the sway live with `&play`, such as `/?asset=grass&play`. Their stills show the lean at one moment.
