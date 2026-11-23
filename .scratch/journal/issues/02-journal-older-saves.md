# 02: Older saves fill in the journal

**What to build:** When the player loads a save made before the journal existed, the journal marks done every goal the camp already proves. A friend who has built a lean-to never sees "Build a lean-to" as their next goal. ADR 0011 requires every older save to stay playable.

**Blocked by:** 01

**Status:** resolved

**Assets:** None.

## Acceptance criteria

- [ ] The check runs once, in the save upgrade for saves made before the journal existed.
- [ ] It marks done every goal the camp proves. For example, a lean-to proves goal 4, a sawhorse proves goal 6, and a room proves goal 7.
- [ ] A proven goal also marks done every goal before it. For example, a room proves that the player once picked up sticks.
- [ ] The check never runs again. After the upgrade, done goals come only from the save.
- [ ] The upgrade shows no done notices.
- [ ] Unit tests cover an older save with no camp, one with a lean-to, one with a snug room, and a save already made with the journal.

## Comments

Split from ticket 01 in the grilling session on 2026-11-22.

Built on 2026-11-23. The save upgrade `addJournal` still writes an empty journal. `readSave` sees that the upgrade ran and asks the new game to fill in the goals from the camp (`journalFromCamp`). The check runs on the camp after every upgrade, so later save changes cannot break it. A lit campfire proves goal 2, a stump or log proves goal 3, and planks prove goal 6, as in ticket 01. Sleeping on a bedroll leaves no trace, so only a later goal proves it.
