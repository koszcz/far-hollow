# 07: Timed tasks walk to their thing through the approach module

**What to build:** Every timed task walks the player within reach through the approach module that ticket 01 adds. A timed task keeps working after the player arrives, such as chopping, debarking, splitting, crafting, taking down, gathering stone, fishing, building, drinking, and filling a pot. Each activity module keeps only the state of the work itself.

**Blocked by:** 01

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

Ticket 01 moves the act-once tasks onto the approach module. The owner split the timed tasks into this ticket during triage on 2026-11-21, because one ticket for all 22 task components would make a very long session. Until this ticket lands, the timed activity modules still walk the player themselves.

## Decisions already made

These were settled in triage for ticket 01. See ADR 0010 and the glossary entry **Approach**.

- The approach owns only the walk and the reach check on arrival. On arrival, the game runs the stored command again, and the activity module starts the work.
- Timed task components keep their names, such as `chopTask`. They come to mean "working" only, and their comments say so.
- A save upgrade turns a timed task whose player is still walking (the player has a `walkPath`) into an `approach`. A player who is already working keeps their work state.

## What to do

1. Move each timed activity module onto the approach, one at a time.
2. Remove each module's own walk, reach check on arrival, and the walking part of its task component.
3. Add the save upgrade described above.

## Acceptance criteria

- [ ] No activity module calls `walkTo`, `walkWithin`, `walkBeside`, or `walkOntoOrWithinReach` to reach a thing.
- [ ] Each timed task component holds only the state of the work.
- [ ] A test loads a save made at the previous version with a `chopTask` mid-walk. The player arrives and chops. A second test loads a save with a `chopTask` mid-chop. The chop continues from its saved progress.
- [ ] Existing behaviour tests pass, such as the chopping, crafting, fishing, and action queue tests.
- [ ] `make check` passes.

## Comments
