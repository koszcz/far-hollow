# 03: Other walks to blocked things take the short way

**What to build:** Every other action that walks the player to a thing that blocks walking, such as a bed, walks the shortest way to a spot within reach. None of them walks the player round to the far side.

**Blocked by:** 01 (Chop a tree from the near side)

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

Several actions walk the player to a thing's centre with `walking.walkTo`. When that centre is blocked, cause 1 in `../spec.md` applies: the walk ends at the open cell nearest the centre, which may be on the far side.

## What to do

1. Check each of these calls. Find out whether its target can lie on a blocked cell:
   - `src/sim/beds.ts`: walks to the bed's centre.
   - `src/sim/bedrolls.ts`: walks to the bedroll's centre.
   - `src/sim/piles.ts`: walks to the pile's centre.
   - `src/sim/gathering.ts`, `src/sim/foraging.ts`, and `src/sim/carrying.ts`: walk to a stick, bark, bush, or log.
   - `src/sim/debarking.ts` and `src/sim/building.ts`: walk to a stand spot they work out themselves.
2. For each call whose target can be blocked, walk within the action's reach with the function from ticket 01. Measure reach the same way the action's own reach check does, such as to a bed's footprint edge.
3. Leave walks to unblocked targets as they are. On open ground the player still walks onto a log or stick to pick it up.

## Acceptance criteria

- [x] Each call in the list is either changed or noted in this ticket's comments as safe, with the reason.
- [x] A unit test covers at least one changed action, such as a bed: the player stops on the side they came from.
- [x] After each changed walk, the action is carried out. The player never stops out of reach.
- [x] Existing tests pass.

## Comments

- From ticket 01: on seed 42, after the player fells the tree nearest the start, the farthest log's nearer-end debark stand spot is blocked by another tree. The debark walk then stops out of line with the log. This is a concrete case for `src/sim/debarking.ts`.

Done on 2026-11-16.

- `walkOntoOrWithinReach` in `src/sim/walking.ts` is the new helper. If the spot the action walks to is open ground, the player walks onto it, as before. If something blocks it, the player walks the shortest way to stand within reach instead, with `walkWithin`.
- Every walk stops 0.2 m inside the reach, so the player is surely within it. `WALK_REACH_MARGIN_METRES` in `src/sim/walking.ts` holds this margin. Chopping now uses it too, in place of its own copy.

Each call in the list:

- `src/sim/beds.ts`: changed. A bed always blocks the cells under it. The player now walks within reach of the bed's edge, which is how the reach check measures it. Before, the walk ended at the open cell nearest the bed's middle. For a bed facing the default way on a cell centre, that cell is always off the -x side.
- `src/sim/bedrolls.ts`, `src/sim/piles.ts`: changed to use the helper. A bedroll or pile lies where the player stood, so it is usually on open ground. Nothing stops a later blocker from covering it, so the helper guards that case at no cost.
- `src/sim/gathering.ts`, `src/sim/foraging.ts`, `src/sim/carrying.ts`: changed to use the helper. New sticks fall under standing trees (`src/sim/stick-fall.ts`), and a felled tree's logs can lie over ground another tree blocks when no clear heading exists. So a stick, a piece of bark, or a log can lie on a blocked cell. Berry bushes and mushrooms do not block walking themselves. On open ground the player still walks onto the thing.
- `src/sim/debarking.ts`: changed. If the stand spot off the log's nearer end is open, the player walks to it, as before. If a tree blocks it, the player walks within reach of the log's middle.
- `src/sim/building.ts` (`walkWithinReach`, also used by taking down): changed. If the stand spot outside the footprint is blocked, the player walks within reach of the footprint's edge. A player standing on the footprint still steps off to the stand spot, as before.

Tests:

- `src/sim/bed.test.ts`: the player comes from the bed's +x side and stops on that side, within reach, then sleeps. On the old code the walk ended on the -x side, and the test fails.
- `src/sim/debarking.test.ts`: a tree blocks the stand spot off the nearer end of a log, and the player still debarks it. This guards the change. It also passes on the old code, because there the nearest open cell happened to lie within reach.
- A check over 3,872 bed positions and approach directions on a bare walk map found no walk that stopped out of reach.
- The seed 42 log from ticket 01 no longer exists. After ticket 02, no log on the ground has a blocked nearer end, so the debark test places a tree to make one.
