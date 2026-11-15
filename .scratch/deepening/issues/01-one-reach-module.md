# 01: One module for walking within reach, then acting

**What to build:** One sim module owns "walk within reach of a thing, then act on it". Activity modules ask it to take the player to a thing and say what to do on arrival. They no longer keep their own task component, reach check, and walk.

**Blocked by:** `.scratch/pathfinding/issues/03-other-walks-to-things.md`

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

The same pattern is copied into about 20 modules. `src/sim/beds.ts:30-70` and `src/sim/stools.ts:47-82` are nearly the same code:

- a lookup of the thing by id;
- a reach check;
- an action that acts at once when in reach, or sets a task component and walks;
- a `cancel` that removes the task component;
- a `step` that waits for the walk to end, checks reach again, and acts.

`bedrolls.ts`, `chests.ts`, `piles.ts`, `foraging.ts`, `gathering.ts`, `carrying.ts`, `drinking.ts`, `fishing.ts`, `pot.ts`, and `crafting.ts` follow the same pattern.

The copies have drifted apart:

- They walk in four ways: `walkTo` to the thing's centre, `walkBeside`, `walkWithin`, and `walkWithinReach`.
- There are about 15 separate reach constants.
- `src/sim/entities.ts:76-264` declares 21 task components. Each is mirrored in `src/sim/save-schema.ts:73-140` and in `TASK_PARTS` in `src/sim/activity.ts`.

So a fix to walking lands in some modules and not others. Pathfinding ticket 02 made sleds, woodpiles, campfires, chests, stools, and stations walk beside things the short way. Beds, piles, and bedrolls still walk to the thing's centre. Pathfinding ticket 03 fixes those one call at a time. This ticket makes the next fix land everywhere at once.

## What to do

1. Start from pathfinding ticket 03's result, so every walk to a thing already takes the short way.
2. Design the module's interface with the owner before you write it. Settle these questions:
   - Does one generic task component replace the per-kind ones, or does each kind keep its own data inside it?
   - How does the module measure reach: to a point, a footprint's edge, or a reach height?
   - How does an activity say what happens on arrival, given that saves must hold the pending task as plain data?
   - How does an older save with per-kind task components load?
3. Move the activity modules onto it one at a time. Start with beds and stools, the two closest copies.
4. Delete each module's own task component, reach check, and `cancel` once it no longer needs them.
5. Add the term for the new module to `GLOSSARY.md` if it names a new idea. **Reach** is already defined there.

## Acceptance criteria

- [ ] One module decides how the player walks within reach of a thing. No activity module calls `walkTo`, `walkBeside`, `walkWithin`, or `walkWithinReach` to reach a thing.
- [ ] Beds, piles, and bedrolls walk the short way, as sleds do.
- [ ] Tests for walking within reach, cancelling, and arriving out of reach live with the new module. They run once, not once per kind.
- [ ] Older saves load, with a save upgrade if the task components change.
- [ ] Existing behaviour tests pass, such as `src/sim/bed.test.ts` and `src/sim/stool.test.ts`.

## Comments
