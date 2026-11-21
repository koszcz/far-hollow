# 07: Timed tasks walk to their thing through the approach module

**What to build:** Every timed task walks the player within reach through the approach module that ticket 01 adds. A timed task keeps working after the player arrives, such as chopping, debarking, splitting, crafting, taking down, gathering stone, fishing, building, drinking, and filling a pot. Each activity module keeps only the state of the work itself.

**Blocked by:** 01

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

Ticket 01 moves the act-once tasks onto the approach module. The owner split the timed tasks into this ticket during triage on 2026-11-21, because one ticket for all 22 task components would make a very long session. Until this ticket lands, the timed activity modules still walk the player themselves.

## Decisions already made

These were settled in triage for ticket 01. Read ADR 0010, ADR 0011, the glossary entry **Approach**, and ticket 01's agent brief first.

- The approach stores the command that started it. On arrival, the game checks the command's refusal again, then carries out the command's act step. It does not send the command again.
- The act step starts the timed work. The work keeps its own component, such as `chopTask` with `secondsDone`. That component comes to mean "working" only, keeps its name, and its comment says so.
- Older saves load and play on (ADR 0011). A save upgrade turns a timed task saved before its work began into an approach that holds the matching command: the player still has a `walkPath` and `secondsDone` is 0. A timed task already under way stays as it is. The upgrade writes command shapes as literals.

## What to do

1. Move each timed activity module onto the approach, one at a time.
2. Remove each module's own walk and reach check on arrival. Keep only the work state in its task component.
3. Add the save upgrade described above, one new entry at the end of `SAVE_UPGRADES`.

## Acceptance criteria

- [ ] Outside the approach module and the walking module, only the free walk command calls `walkTo`, `walkWithin`, `walkBeside`, `walkOntoOrWithinReach`, or the building module's `walkWithinReach`.
- [ ] Each timed task component holds only the state of the work.
- [ ] A test loads a save made at the previous version with a `chopTask` mid-walk. The player arrives and chops. A second test loads a save with a `chopTask` mid-chop. The chop continues from its saved progress.
- [ ] Existing behaviour tests pass, such as the chopping, crafting, fishing, and action queue tests.
- [ ] `make check` passes.

## Comments
