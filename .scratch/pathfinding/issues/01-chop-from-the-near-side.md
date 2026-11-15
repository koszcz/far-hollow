# 01: Chop a tree from the near side

**What to build:** When the player clicks a tree to chop it, they walk the shortest way to a spot within chopping reach. They chop from the side they came from, unless something blocks that side.

**Status:** ready-for-agent

**Assets:** None. This ticket changes no asset.

## Why

Chopping walks the player to the tree's centre. That spot is blocked, so `findPath` ends the walk at the open cell nearest the tree's centre, whichever side of the tree it is on. On seed 42, 6 of the 12 trees nearest the start were chopped from the far side. See cause 1 in `../spec.md`.

## What to do

1. Add a function to `src/sim/pathfinding.ts` that finds a path from the player to the nearest spot within a given distance of a target. "Nearest" means the shortest walk, not the shortest straight line.
   - The search ends at the first open cell, in walking order, whose centre lies within the distance. A* with the goal test "within the distance" and the estimate "straight-line distance minus the distance, at least 0" does this.
   - If the player already stands within the distance, the path is empty.
   - If no open cell within the distance can be reached, the path ends at the reachable cell nearest the target, as `findPath` does now.
   - Smooth the path as `findPath` does, so the player walks in straight lines where they can.
2. Expose it on `Walking` in `src/sim/walking.ts`, for example as `walkWithin(target, distance)`.
3. In `src/sim/chopping.ts`, walk within the chopping reach: the tree's blocking radius plus `CHOP_REACH_METRES`. Keep a small margin inside that reach, so the reach check after the walk always passes.

## Acceptance criteria

- [ ] A player who clicks a tree in open ground stops on the side facing where they started.
- [ ] A player who clicks a tree whose near side is blocked walks to the nearest side they can reach.
- [ ] A player already within chopping reach does not walk.
- [ ] The player never walks further than the old route did to reach a tree, measured over the 12 trees nearest the start on seed 42.
- [ ] Unit tests in `src/sim/pathfinding.test.ts` cover the new function: near side in open ground, blocked near side, already within reach, and no reachable cell within the distance.
- [ ] A unit test in `src/sim/chopping.test.ts` checks that the player chops from the near side, for a tree whose open cell nearest its centre is on the far side.
- [ ] Existing tests pass.
