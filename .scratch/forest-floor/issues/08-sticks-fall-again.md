# 08: New sticks fall from the trees

**What to build:** New sticks keep falling from the trees, so the forest floor never runs out. Most fall as a **deadfall**, and some fall alone.

**Blocked by:** 07 (Sticks lie in deadfalls)

**Status:** ready-for-agent

**Assets:** Reuses `sticks`. Adds none.

- [ ] New sticks fall at new random spots under standing trees, not at the spots the player cleared.
- [ ] Most new sticks fall as a deadfall of 3 to 6 sticks. Some fall alone.
- [ ] New sticks fall at about the rate the player gathers them. A cleared area fills up again over a few in-game days.
- [ ] The ground never holds more sticks than a new valley starts with. Sticks the player drops count toward this limit.
- [ ] No new sticks fall on or right next to anything the player has built or placed.
- [ ] New sticks keep falling after saving and loading, at the same pace.
- [ ] Saved games from before this change also get new sticks.
- [ ] Unit tests cover the limit, the gap around built things, and falling after a load.
