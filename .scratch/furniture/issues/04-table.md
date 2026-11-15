# 04: Table

**What to build:** The player can build a table from 6 planks. Food eaten within reach of a finished table restores 25% more hunger.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Reuse `player`. Add the drafts `table` and `furniture-icons` (table icon).

- [ ] The build menu lists the table with its cost of 6 planks, and shows its icon.
- [ ] The table blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [ ] A table blueprint cannot overlap a standing tree, a structure, or other furniture.
- [ ] Planks come straight from the backpack. Building needs no tool.
- [ ] The table shows its build stages.
- [ ] A finished table blocks walking.
- [ ] Food eaten within reach of a finished table restores 25% more hunger. A table blueprint gives no bonus.
- [ ] Eating works as before. There is no new action.
- [ ] The player can take down a table or its blueprint and get back every plank.
- [ ] Tables and table blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a table spends no planks.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, building, the hunger bonus near a finished table, and no bonus near a blueprint or out of reach.
