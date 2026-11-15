# 02: Dig up a sapling

**What to build:** The player can dig up the sapling growing from a stump and put it in the backpack. This removes the stump for good.

**Blocked by:** 01

**Status:** ready-for-agent

**Assets:** Reuse `saplings`, `stumps`, and `backpack-icons`. Add draft `sapling-icon`.

- [ ] E, the main action, on a sapling digs it up. No tool is needed. It takes a few seconds.
- [ ] Digging up the sapling on a stump removes the stump too. The ground there is free to walk on and build on.
- [ ] A sapling goes in the backpack, weighs 1 kg, and stacks. The hotbar and backpack show it with its icon.
- [ ] The player cannot dig up a bare stump or a young tree. The game says why.
- [ ] Saplings in the backpack are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover digging up, the stump being removed, the refusals, and saving.
