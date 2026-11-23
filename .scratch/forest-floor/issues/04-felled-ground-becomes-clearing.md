# 04: The ground follows the trees that stand for good

**What to build:** The ground type changes slowly when trees go or come for good. Where the player digs up a sapling and no tree is left, forest floor turns into clearing over 3 game days. Around a planted tree that has become a full tree, clearing turns into forest floor over 3 game days. The undergrowth changes with the ground. See `.scratch/forest-floor/spec.md`.

**Blocked by:** none

**Status:** resolved

**Assets:** Reuses `terrain`, `grass`, `ferns`, `flowers`, and `pebbles`. Adds none.

Regrowth changed this ticket. A felled tree's stump grows back within 6 game days, so felling alone no longer leaves the ground open. The ground can stay open for good only where the player digs up a sapling.

- [x] Where no tree, stump, or sapling is left, forest floor turns into clearing over 3 game days.
- [x] A stump that is growing back, and the sapling on it, still count as a tree. Felling a tree alone does not change the ground.
- [x] Once a planted sapling becomes a full tree, clearing turns into forest floor around it over 3 game days. Saplings and young trees do not change the ground.
- [x] A new full tree spreads forest floor as far as a starting tree does: all forest floor within 3 m, fading into clearing by 7 m.
- [x] The river bank never changes.
- [x] The ground blends softly while it changes. There are no hard edges, and no sudden jumps when the change starts or ends.
- [x] Undergrowth follows the ground. Ferns thin out as grass and flowers move in, or the reverse. It still never pops in.
- [x] Gameplay rules that read the ground type, such as planting and gathering stone, use the current ground type.
- [x] The game saves when each change started. The save version goes up. An older save loads with the ground matching the trees it holds now, with no change in progress. See ADR 0011.
- [x] The same seed and the same actions always give the same ground.
- [ ] The game still runs at 60 fps on an Apple M1 laptop in Chrome while the ground changes. Nobody has measured this on an M1 yet. See ticket 09 for the M3 Pro results.
- [x] Unit tests cover a dug-up spot turning to clearing, a planted full tree turning to forest floor, a growing stump changing nothing, the 3-day timing, and loading saves from before and after the change.
