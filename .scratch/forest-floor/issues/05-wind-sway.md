# 05: Undergrowth and trees sway in the wind

**What to build:** Grass, ferns, flowers, saplings, young trees, and treetops sway gently in the **wind**, so the valley feels alive even when the player stands still. Wind is only for looks. See `.scratch/forest-floor/spec.md`.

**Blocked by:** none

**Status:** idea

**Assets:** Changes five approved assets so they sway: `trees`, `saplings`, `grass`, `ferns`, and `flowers`. Each goes back to `draft`. The owner approved the `trees` change in chat on 2026-11-22. The other four still need the owner's approval. Adds none.

Questions for grilling:

- Does the owner approve changing `saplings`, `grass`, `ferns`, and `flowers` so they sway? Once they do, record it here and set this ticket to `ready-for-agent`.

- [ ] Grass, ferns, flowers, saplings, young trees, and treetops sway.
- [ ] Tree trunks, pebbles, stumps, sticks, and berry bushes stay still.
- [ ] The wind is a gentle breeze with slow gusts. It does not follow the time of day.
- [ ] The wind blows harder while it rains. It eases in and out when rain starts or stops.
- [ ] The wind blows the same way across the whole valley. Its direction drifts slowly over game hours. The same seed always gives the same wind.
- [ ] Wind is not saved. The game logic never sees it. It does not affect the campfire's smoke.
- [ ] Undergrowth still fades out at its edge without popping in.
- [ ] The game still runs at 60 fps on an Apple M1 laptop in Chrome.
- [ ] The `trees`, `saplings`, `grass`, `ferns`, and `flowers` entries in `asset-manifest.json` are `draft`, link this ticket, and record the owner's approval.
- [ ] The asset showcase shows the sway for trees and undergrowth, so the owner can review it.
- [ ] Unit tests cover the wind's strength in and out of rain, and the same seed giving the same wind.
