# 02: Walk beside things the short way

**What to build:** When the player acts on a sled, woodpile, campfire, chest, stool, or crafting station out of reach, they walk the shortest way to a spot beside it. They no longer walk around trees to reach one fixed spot.

**Blocked by:** 01 (Chop a tree from the near side)

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

`walkBeside` in `src/sim/walking.ts` picks one spot a fixed distance from the thing, on the straight line towards the player. In the forest, trees often stand on that line, so the player weaves around them to reach that exact spot. With a sled in the forest, the worst walks were 1.5 to 1.9 times the direct route. See cause 2 in `../spec.md`.

## What to do

1. Change `walkBeside` to use the function from ticket 01. The player walks the shortest way to any spot within the stand distance of the thing.
   - Keep the reach check: a player already within reach does not walk.
   - Keep the stand distances, so on open ground the player stops where they stop today.
2. Measure the distance the same way each thing's reach check does:
   - A sled's reach is measured to its footprint's edge, not its centre. Walk within that distance of the footprint's edge, or the player may stop out of reach of a long sled.
   - The others measure from the centre.
3. Update the callers if `walkBeside` needs new arguments: `src/sim/sleds.ts`, `src/sim/woodpiles.ts`, `src/sim/campfires.ts`, `src/sim/chests.ts`, `src/sim/stools.ts`, and `src/sim/crafting.ts`.

## Acceptance criteria

- [x] On open ground, the player stops in the same place as before for each of these things.
- [x] A sled with a tree between it and the player: the player walks the short way round and stops within reach. A unit test covers this.
- [x] A woodpile beside a sled: putting a log on the sled from the woodpile's side still walks the player within reach of the sled.
- [x] After each walk, the action is carried out. The player never stops out of reach.
- [x] A player already within reach does not walk.
- [x] Existing tests pass, including `src/sim/sled.test.ts`, `src/sim/campfires.test.ts`, `src/sim/chest.test.ts`, and `src/sim/stool.test.ts`.

## Comments

Done on 2026-11-16.

- `findPathWithin` and `Walking.walkWithin` now take a point or a rectangle. For a rectangle, they measure the distance to its edge. `distanceToTarget` in `src/sim/pathfinding.ts` measures it the same way.
- `walkBeside` keeps the reach check, then calls `walkWithin` with the stand distance. On open ground, the player stops at exactly the spot the old code chose for campfires, woodpiles, chests, stools, and stations.
- Note for the owner: the sled could not keep both rules. Its stand distance used to be 1.3 m from the middle. It is now 0.9 m from the edge, so the player stops at the old spot when they come from the long side. When they come from an end, they stop 1.8 m from the middle, 0.5 m further away than before, but still well within reach.
- The sled now passes the real reach, `USE_REACH_METRES`, to `walkBeside`. It used to pass 0. A player who walks within reach while doing something else therefore keeps their old path. Tending removes that path first, so the result is the same.
- Tests: three rectangle tests in `src/sim/pathfinding.test.ts`, and four tests under "walking to a sled" in `src/sim/sled.test.ts`. The test with a tree between the player and the sled fails on the old code. With the old code, the walk was 9.3 m. With the new code, it is 8.3 m.
