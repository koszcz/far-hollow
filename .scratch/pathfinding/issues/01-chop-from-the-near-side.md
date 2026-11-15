# 01: Chop a tree from the near side

**What to build:** When the player clicks a tree to chop it, they walk the shortest way to a spot within chopping reach. They chop from the side they came from, unless something blocks that side.

**Status:** resolved

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

- [x] A player who clicks a tree in open ground stops on the side facing where they started.
- [x] A player who clicks a tree whose near side is blocked walks to the nearest side they can reach.
- [x] A player already within chopping reach does not walk.
- [x] The player never walks further than the old route did to reach a tree, measured over the 12 trees nearest the start on seed 42.
- [x] Unit tests in `src/sim/pathfinding.test.ts` cover the new function: near side in open ground, blocked near side, already within reach, and no reachable cell within the distance.
- [x] A unit test in `src/sim/chopping.test.ts` checks that the player chops from the near side, for a tree whose open cell nearest its centre is on the far side.
- [x] Existing tests pass.

## Comments

Done on 2026-11-16.

- `findPathWithin` in `src/sim/pathfinding.ts` is the new function. `Walking.walkWithin` exposes it. Chopping walks to 0.2 m inside its reach.
- On open ground, the function first tries a straight walk to the nearest point of the circle round the target. If that line is clear, the path is that one spot. Otherwise it runs the A* search the ticket describes.
- Before searching, it checks that some cell within the distance shares the player's region. If none does, it falls back to `findPath`, so a hopeless search never covers the whole region.
- On seed 42, all 12 trees nearest the start are now chopped from the near side. Every walk is shorter than the old walk to the tree's centre: 0.7 to 2 m shorter for near-side trees, and up to 5.3 m shorter where the old walk went round to the far side.
- Logs now fall away from the near side, so the first felled tree's logs lie elsewhere. In `src/sim/debarking.test.ts`, the stand-spot test used the farthest log, whose nearer-end stand spot is now blocked by another tree. The test now picks a log with open ground off its nearer end. The blocked stand spot is a real case for ticket 03.
