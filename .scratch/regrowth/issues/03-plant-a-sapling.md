# 03: Plant a sapling

**What to build:** The player can plant a sapling from the backpack. It grows into a full tree over 5 game days.

**Blocked by:** 02

**Status:** resolved

**Assets:** Reuse `saplings`, `sapling-icon`, and `trees`.

- [x] The player plants a sapling from its hotbar cell. A see-through sapling shows where it will go. Planting takes a few seconds.
- [x] A sapling can be planted only on forest floor or clearing, at least 3 metres from any tree, stump, or sapling, and away from any structure, blueprint, or foundation square.
- [x] On a spot that is not allowed, the see-through sapling turns red and the game says why.
- [x] A planted sapling does not block walking. It becomes a young tree 2 game days after planting, and a full tree 3 game days after that.
- [x] If the player stands where a planted sapling would become a young tree, it waits until they step away.
- [x] The player can dig up a planted sapling again, as in 02.
- [x] A planted tree is the same kind and size as a tree at that spot would be.
- [x] Planted saplings and their growth are saved.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover the planting rules, growth, the wait while the player stands there, and saving.
