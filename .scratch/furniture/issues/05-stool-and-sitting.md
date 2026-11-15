# 05: Stool and sitting

**What to build:** The player can build a stool from 2 planks and sit on it. Sitting restores fatigue slowly while time runs at normal speed.

**Blocked by:** 01 (The chest costs planks)

**Status:** ready-for-agent

**Assets:** Reuse `player`. Add the drafts `stool`, `sit-animation`, and `furniture-icons` (stool icon).

- [ ] The build menu lists the stool with its cost of 2 planks, and shows its icon.
- [ ] The stool blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [ ] A stool blueprint cannot overlap a standing tree, a structure, or other furniture.
- [ ] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [ ] The stool shows its build stages.
- [ ] A finished stool blocks walking.
- [ ] "Sit" is the stool's main action. The player walks to the stool and sits down on it.
- [ ] While the player sits, fatigue comes back at a quarter of the rate of sleep in the open. Time runs at normal speed.
- [ ] The player stands up as soon as they walk or act.
- [ ] Sitting does not change the respawn point.
- [ ] The player can take down a stool or its blueprint and get back every plank. A player sitting on it stands up first.
- [ ] Stools and stool blueprints are saved. Sitting is not saved. A loaded game starts with the player standing.
- [ ] The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a stool spends no planks.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, building, the fatigue rate while sitting, and standing up on walk or action.
