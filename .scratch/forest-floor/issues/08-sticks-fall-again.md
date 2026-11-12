# 08: New sticks fall from the trees

**What to build:** New sticks keep falling from the trees, so the forest floor never runs out. Most fall as a **deadfall**, and some fall alone.

**Blocked by:** 07 (Sticks lie in deadfalls)

**Status:** resolved

**Assets:** Reuses `sticks`. Adds none.

- [x] New sticks fall at new random spots under standing trees, not at the spots the player cleared.
- [x] Most new sticks fall as a deadfall of 3 to 6 sticks. Some fall alone.
- [x] New sticks fall at about the rate the player gathers them. A cleared area fills up again over a few in-game days.
- [x] The ground never holds more sticks than a new valley starts with. Sticks the player drops count toward this limit.
- [x] No new sticks fall on or right next to anything the player has built or placed.
- [x] New sticks keep falling after saving and loading, at the same pace.
- [x] Saved games from before this change also get new sticks.
- [x] Unit tests cover the limit, the gap around built things, and falling after a load.
