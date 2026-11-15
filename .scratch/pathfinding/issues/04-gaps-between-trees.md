# 04: Walk through gaps between trees that look wide enough

**What to build:** The player can walk through any gap between trees that looks wide enough on screen. They no longer detour around a gap the walk map treats as closed.

**Blocked by:** 01, 02

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

Each tree blocks every 1 m cell whose centre lies within 1.2 m of the tree's centre (`TREE_WALK_BLOCK_RADIUS_METRES` in `src/sim/game.ts`). The widest trunk is about 0.4 m across. The player also cannot step diagonally between two blocked cells. Together, these close some diagonal gaps between trees. See cause 3 in `../spec.md`.

Tickets 01 and 02 remove most strange routes. Play the game after they land. Then decide whether this ticket is still needed.

## Options for the owner

- **Finer walk map:** 0.5 m cells, with a tree radius of about 0.7 m. This keeps more of the real space between trees. It uses four times the memory and makes each search slower, so measure the cost on the full-size map first (see `.scratch/performance/issues/02-no-hitches-while-walking.md`).
- **Smaller tree radius only:** keep 1 m cells and lower the radius. This is cheaper, but the player may clip the edge of wide trunks.
- **Close as wontfix:** if routes feel right after tickets 01 and 02.

## Acceptance criteria

- [x] The owner picks an option.
- [x] If the walk map changes, a unit test shows the player walking straight through a diagonal gap between two trees about 3 m apart.
- [x] If the walk map changes, finding a path after a map change still takes well under one frame on the full-size map.
- [x] Existing tests pass.

## Comments

Done on 2026-11-16. The owner picked "Smaller tree radius only", at 0.9 m.

- `TREE_WALK_BLOCK_RADIUS_METRES` in `src/sim/game.ts` is now 0.9 m, down from 1.2 m. The walk map keeps 1 m cells.
- Measured on the full 300 m map (seed 1, 2,600 trees), with one tree removed and put back before each search: the median search took 0.7 ms and the slowest 2.5 ms. At 1.2 m the figures were 1.0 ms and 3.0 ms.
- Share of walks that go straight through a gap between two trees 3 m apart, over 400 random placements: 41% at 1.2 m, 94% at 0.9 m. At 2.5 m apart: 7% and 58%.
- For comparison, 0.5 m cells with a 0.7 m radius opened every 3 m gap. But the median search took 3.1 ms and the slowest 9 to 15 ms, close to a whole frame at 60 frames per second.
- Risk: in rare cases a path can pass about 0.2 m from a tree's centre, grazing the widest trunks. In the 400 test walks, no path came closer than 0.8 m.
- Chopping reach is the tree radius plus 1 m, so the player now stands 1.7 m from the tree's centre to chop, down from 2.0 m.
- Test: "walks straight through a diagonal gap between two trees about 3 m apart" in `src/sim/pathfinding.test.ts`. It fails at 1.2 m.
