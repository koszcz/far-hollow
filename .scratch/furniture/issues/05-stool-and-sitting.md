# 05: Stool and sitting

**What to build:** The player can build a stool from 2 planks and sit on it. Sitting restores fatigue slowly while time runs at normal speed.

**Blocked by:** 01 (The chest costs planks)

**Status:** resolved

**Assets:** Reuse `player`. Add the drafts `stool`, `sit-animation`, and `furniture-icons` (stool icon).

- [x] The build menu lists the stool with its cost of 2 planks, and shows its icon.
- [x] The stool blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [x] A stool blueprint cannot overlap a standing tree, a structure, or other furniture.
- [x] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [x] The stool shows its build stages.
- [x] A finished stool blocks walking.
- [x] "Sit" is the stool's main action. The player walks to the stool and sits down on it.
- [x] While the player sits, fatigue comes back at a quarter of the rate of sleep in the open. Time runs at normal speed.
- [x] The player stands up as soon as they walk or act.
- [x] Sitting does not change the respawn point.
- [x] The player can take down a stool or its blueprint and get back every plank. A player sitting on it stands up first.
- [x] Stools and stool blueprints are saved. Sitting is not saved. A loaded game starts with the player standing.
- [x] The save version goes up, and older saves are upgraded when loaded.
- [x] In the playground, a stool spends no planks.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover placement, building, the fatigue rate while sitting, and standing up on walk or action.
