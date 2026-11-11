# 04: Fatigue and sleeping on a bedroll

**What to build:** The player gets tired while awake. They start with a bedroll in their backpack. They can lay it on the ground and sleep on it. Sleeping skips the night, restores fatigue, and makes the bedroll their respawn point.

**Blocked by:** 01 (Turn warmth into one of four needs), 02 (Autosave and continue)

**Status:** resolved

**Assets:** Reuse `player`. Add the draft `bedroll`, shown laid out on the ground.

- [x] Fatigue drains while the player is awake. It drains faster during timed work such as chopping and building.
- [x] Low fatigue slows the player, like other needs.
- [x] A new game starts with a bedroll in the backpack, along with the axe, knife, and fire striker.
- [x] The player can lay the bedroll on the ground and pick it up again.
- [x] The player can sleep on a laid bedroll. Sleeping at night skips to morning and restores fatigue.
- [x] Other needs change for the time slept. Warmth still drains if no lit campfire is near.
- [x] Sleeping on a bedroll makes it the respawn point. After a collapse, the player wakes there.
- [x] The HUD shows fatigue.
- [x] Fatigue, the bedroll, and the respawn point are saved.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover fatigue drain, sleeping, the night skip, and the new respawn point.
