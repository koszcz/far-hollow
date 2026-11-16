# 01: Stumps grow back into trees

**What to build:** A felled tree's stump grows back into a full tree over 6 game days. It passes through the sapling and young tree stages in `.scratch/regrowth/spec.md`. The player cannot dig up saplings or plant them yet.

**Blocked by:** None

**Status:** resolved

**Assets:** Reuse `trees` and `stumps`. Add draft `saplings` (a small sapling and a young tree for each tree kind).

- [x] A stump shows a sapling growing from it 1 game day after the tree is felled.
- [x] The sapling becomes a young tree 2 game days later. The stump disappears then.
- [x] The young tree becomes a full tree 3 game days later.
- [x] A regrown tree is the same kind and size as a tree at that spot would be, and gives the same number of logs.
- [x] The player cannot chop a stump, a sapling, or a young tree. For a young tree, the game says it is too young to chop.
- [x] Stumps, saplings on stumps, and young trees all block walking.
- [x] Growth counts while the player sleeps.
- [x] Each growing tree's stage and time left are saved. The save version goes up. A stump in an older save starts growing as if just felled.
- [x] Drawing growing trees keeps the frame-rate targets with every tree in the valley felled and regrowing.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover each stage change, the chop refusal, the regrown tree's log count, and saving.

## Comments

Frame-rate check, 2026-11-16, with `.scratch/regrowth/measure.ts`: seed 12345, 2,600 trees, 1512 by 900 at pixel ratio 2, no frame cap. The mean frame time was 3.4 ms in all three cases: the forest standing, every tree a sapling on its stump, and every tree a young tree. That is well inside the 8.3 ms a 120 fps target allows.

Known limit: the log batches hold as many logs as the valley's tree spots can give at once. Trees now regrow, so a player who fells the valley more than once and leaves every log lying could run past that limit. Logs past it are not drawn.
