# 02: Bed

**What to build:** The player can build a bed from 8 planks and sleep in it. A bed restores fatigue twice as fast as a bedroll and becomes the respawn point.

**Blocked by:** 01 (The chest costs planks)

**Status:** resolved

**Assets:** Reuse `player` and `sleep-animation`. Add the drafts `bed` and `furniture-icons` (bed icon).

- [x] The build menu lists the bed with its cost of 8 planks, and shows its icon.
- [x] The bed blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [x] A bed blueprint cannot overlap a standing tree, a structure, or other furniture.
- [x] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [x] The bed shows its build stages.
- [x] A finished bed blocks walking.
- [x] "Sleep" is the bed's main action. Sleeping in a bed follows the same rules as sleeping on a bedroll.
- [x] A bed restores fatigue twice as fast as a bedroll. Under a roof, the roof bonus also applies.
- [x] Sleeping in a bed makes the spot where it stands the respawn point.
- [x] The player can take down a bed or its blueprint and get back every plank. The respawn point stays where it was.
- [x] Beds and bed blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [x] In the playground, a bed spends no planks.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover placement, building, the faster fatigue recovery with and without a roof, the respawn point, and taking down.
