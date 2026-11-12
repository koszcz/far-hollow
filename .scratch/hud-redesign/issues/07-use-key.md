# 07: E uses the nearest thing

**Status:** resolved

**Blocked by:** 02, 04

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Use key" in `../spec.md`. E does the main action on the nearest thing within reach.

- [x] E does the main action on the nearest thing within the player's reach. With nothing in reach, E does nothing.
- [x] When the cursor is over that nearest thing, its prompt shows "E" beside the main action.
- [x] E does nothing while typing in a form field.
- [x] Tests cover E with one thing in reach, two things in reach, and none.
