# 01: Stumps grow back into trees

**What to build:** A felled tree's stump grows back into a full tree over 6 game days. It passes through the sapling and young tree stages in `.scratch/regrowth/spec.md`. The player cannot dig up saplings or plant them yet.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** Reuse `trees` and `stumps`. Add draft `saplings` (a small sapling and a young tree for each tree kind).

- [ ] A stump shows a sapling growing from it 1 game day after the tree is felled.
- [ ] The sapling becomes a young tree 2 game days later. The stump disappears then.
- [ ] The young tree becomes a full tree 3 game days later.
- [ ] A regrown tree is the same kind and size as a tree at that spot would be, and gives the same number of logs.
- [ ] The player cannot chop a stump, a sapling, or a young tree. For a young tree, the game says it is too young to chop.
- [ ] Stumps, saplings on stumps, and young trees all block walking.
- [ ] Growth counts while the player sleeps.
- [ ] Each growing tree's stage and time left are saved. The save version goes up. A stump in an older save starts growing as if just felled.
- [ ] Drawing growing trees keeps the frame-rate targets with every tree in the valley felled and regrowing.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover each stage change, the chop refusal, the regrown tree's log count, and saving.
