# 04: Walk through gaps between trees that look wide enough

**What to build:** The player can walk through any gap between trees that looks wide enough on screen. They no longer detour around a gap the walk map treats as closed.

**Blocked by:** 01, 02

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

Each tree blocks every 1 m cell whose centre lies within 1.2 m of the tree's centre (`TREE_WALK_BLOCK_RADIUS_METRES` in `src/sim/game.ts`). The widest trunk is about 0.4 m across. The player also cannot step diagonally between two blocked cells. Together, these close some diagonal gaps between trees. See cause 3 in `../spec.md`.

Tickets 01 and 02 remove most strange routes. Play the game after they land. Then decide whether this ticket is still needed.

## Options for the owner

- **Finer walk map:** 0.5 m cells, with a tree radius of about 0.7 m. This keeps more of the real space between trees. It uses four times the memory and makes each search slower, so measure the cost on the full-size map first (see `.scratch/performance/issues/02-no-hitches-while-walking.md`).
- **Smaller tree radius only:** keep 1 m cells and lower the radius. This is cheaper, but the player may clip the edge of wide trunks.
- **Close as wontfix:** if routes feel right after tickets 01 and 02.

## Acceptance criteria

- [ ] The owner picks an option.
- [ ] If the walk map changes, a unit test shows the player walking straight through a diagonal gap between two trees about 3 m apart.
- [ ] If the walk map changes, finding a path after a map change still takes well under one frame on the full-size map.
- [ ] Existing tests pass.
