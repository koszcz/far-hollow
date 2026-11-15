# 03: Plant a sapling

**What to build:** The player can plant a sapling from the backpack. It grows into a full tree over 5 game days.

**Blocked by:** 02

**Status:** ready-for-agent

**Assets:** Reuse `saplings`, `sapling-icon`, and `trees`.

- [ ] The player plants a sapling from its hotbar cell. A see-through sapling shows where it will go. Planting takes a few seconds.
- [ ] A sapling can be planted only on forest floor or clearing, at least 3 metres from any tree, stump, or sapling, and away from any structure, blueprint, or foundation square.
- [ ] On a spot that is not allowed, the see-through sapling turns red and the game says why.
- [ ] A planted sapling does not block walking. It becomes a young tree 2 game days after planting, and a full tree 3 game days after that.
- [ ] If the player stands where a planted sapling would become a young tree, it waits until they step away.
- [ ] The player can dig up a planted sapling again, as in 02.
- [ ] A planted tree is the same kind and size as a tree at that spot would be.
- [ ] Planted saplings and their growth are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover the planting rules, growth, the wait while the player stands there, and saving.
