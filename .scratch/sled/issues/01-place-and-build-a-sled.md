# 01: Place and build a sled

**What to build:** The player can build a sled from the build menu. It stands where they built it. This ticket adds only the empty sled. Loading and dragging come later.

**Blocked by:** None

**Status:** resolved

**Assets:** Reuse `player`. Add draft `sled` (empty, with build stages and a see-through blueprint).

- [ ] The build menu lists the sled. It costs 2 logs and 4 sticks and needs the axe.
- [ ] The sled is placed freely, off the building grid. R rotates it.
- [ ] Building it works like any other structure: blueprint, deliver materials, hold the build action.
- [ ] The player can build as many sleds as they like.
- [ ] Sleds, where they stand, and which way they face are saved. The save version goes up. Older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover the cost, building, and saving.
