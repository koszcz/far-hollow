# 03: Other walks to blocked things take the short way

**What to build:** Every other action that walks the player to a thing that blocks walking, such as a bed, walks the shortest way to a spot within reach. None of them walks the player round to the far side.

**Blocked by:** 01 (Chop a tree from the near side)

**Status:** ready-for-agent

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

- [ ] Each call in the list is either changed or noted in this ticket's comments as safe, with the reason.
- [ ] A unit test covers at least one changed action, such as a bed: the player stops on the side they came from.
- [ ] After each changed walk, the action is carried out. The player never stops out of reach.
- [ ] Existing tests pass.
