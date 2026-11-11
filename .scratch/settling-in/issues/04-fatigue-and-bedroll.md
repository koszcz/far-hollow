# 04: Fatigue and sleeping on a bedroll

**What to build:** The player gets tired while awake. They start with a bedroll in their backpack. They can lay it on the ground and sleep on it. Sleeping skips the night, restores fatigue, and makes the bedroll their respawn point.

**Blocked by:** 01 (Turn warmth into one of four needs), 02 (Autosave and continue)

**Status:** ready-for-agent

- [ ] Fatigue drains while the player is awake. It drains faster during timed work such as chopping and building.
- [ ] Low fatigue slows the player, like other needs.
- [ ] A new game starts with a bedroll in the backpack, along with the axe, knife, and fire striker.
- [ ] The player can lay the bedroll on the ground and pick it up again.
- [ ] The player can sleep on a laid bedroll. Sleeping at night skips to morning and restores fatigue.
- [ ] Other needs change for the time slept. Warmth still drains if no lit campfire is near.
- [ ] Sleeping on a bedroll makes it the respawn point. After a collapse, the player wakes there.
- [ ] The HUD shows fatigue.
- [ ] Fatigue, the bedroll, and the respawn point are saved.
- [ ] Before any bedroll model enters the game, the owner approves it (ADR 0004).
- [ ] Unit tests cover fatigue drain, sleeping, the night skip, and the new respawn point.
