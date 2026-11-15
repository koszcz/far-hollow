# 02: Bed

**What to build:** The player can build a bed from 8 planks and sleep in it. A bed restores fatigue twice as fast as a bedroll and becomes the respawn point.

**Blocked by:** 01 (The chest costs planks)

**Status:** ready-for-agent

**Assets:** Reuse `player` and `sleep-animation`. Add the drafts `bed` and `furniture-icons` (bed icon).

- [ ] The build menu lists the bed with its cost of 8 planks, and shows its icon.
- [ ] The bed blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [ ] A bed blueprint cannot overlap a standing tree, a structure, or other furniture.
- [ ] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [ ] The bed shows its build stages.
- [ ] A finished bed blocks walking.
- [ ] "Sleep" is the bed's main action. Sleeping in a bed follows the same rules as sleeping on a bedroll.
- [ ] A bed restores fatigue twice as fast as a bedroll. Under a roof, the roof bonus also applies.
- [ ] Sleeping in a bed makes the spot where it stands the respawn point.
- [ ] The player can take down a bed or its blueprint and get back every plank. The respawn point stays where it was.
- [ ] Beds and bed blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a bed spends no planks.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, building, the faster fatigue recovery with and without a roof, the respawn point, and taking down.
