# 01: Ground types

**What to build:** The valley's ground shows three ground types instead of one repeated tile: forest floor, clearing, and river bank. Each one blends softly into the next. See `.scratch/forest-floor/spec.md`.

**Blocked by:** none

**Status:** resolved

**Assets:** Rework the approved `terrain` asset and set it back to `"status": "draft"`. The owner approved this in chat on 2026-11-11.

- [ ] Forest floor shows brown needle and leaf litter within a few metres of trees.
- [ ] A clearing shows brighter grass away from trees.
- [ ] A river bank shows mud and pebbles on the sloped strip beside the water.
- [ ] Ground types blend softly. No hard edges or visible tile seams.
- [ ] Ground types come from the trees that stand when the valley is made and from the river. Felling a tree does not change them.
- [ ] One function answers "which ground type is here?" for any spot. Ticket 02 reuses it to decide what grows where.
- [ ] The same seed always gives the same ground.
- [ ] The game still runs at 60 fps on an Apple M1 laptop in Chrome.
- [ ] The `terrain` entry in `asset-manifest.json` is a draft, and its description names the three ground types.
- [ ] The asset showcase (`/?asset=terrain`) shows all three ground types.
- [ ] Unit tests cover the ground-type function: near trees, in the open, and beside the river.
