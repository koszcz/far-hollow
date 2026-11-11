# 10: Warmth, collapse, and surviving the night

**What to build:** The player has a warmth need. Warmth drains at night when the player is away from a lit campfire, and it recovers near one. Low warmth slows the player. If warmth stays too low for too long, the player has a collapse and wakes at the starting spot. Reaching morning after the first night counts as surviving it.

**Blocked by:** 09 (Fuel the campfire)

**Status:** resolved

- [x] Warmth is the only need in the first playable. Hunger, thirst, and fatigue come later.
- [x] Warmth drains at night away from a lit campfire. It recovers within a campfire's warmth range.
- [x] The player can see their warmth level.
- [x] Low warmth slows the player's movement and actions.
- [x] If warmth stays too low for too long, the player has a collapse.
- [x] After a collapse, the player wakes at their respawn point with low warmth. They keep everything in their backpack. The rest of that day is lost.
- [x] Until a bed exists, the respawn point is the spot where the player started at the valley edge.
- [x] Reaching the first morning without a collapse shows a short message that the player survived the night. The message text lives in the strings file.
- [x] Unit tests cover warmth drain, recovery, slowdown, collapse, and the respawn.

## Comments

- 2026-11-11, owner decision after code review: a collapse wakes the player at the next 06:00. This is intended, even though it costs no daylight. The campfire glow gets a brighter inner pool that marks the 4 m warmth range. The extras the agents added (seed in the URL, log dropped on collapse, first log shouldered automatically, 8-hour fuel cap, 2 m campfire spacing, Escape cancels placing) stay.
