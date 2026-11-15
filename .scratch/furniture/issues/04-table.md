# 04: Table

**What to build:** The player can build a table from 6 planks. Food eaten within reach of a finished table restores 25% more hunger.

**Blocked by:** 01 (The chest costs planks)

**Status:** resolved

**Assets:** Reuse `player`. Add the drafts `table` and `furniture-icons` (table icon).

- [x] The build menu lists the table with its cost of 6 planks, and shows its icon.
- [x] The table blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [x] A table blueprint cannot overlap a standing tree, a structure, or other furniture.
- [x] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [x] The table shows its build stages.
- [x] A finished table blocks walking.
- [x] Food eaten within reach of a finished table restores 25% more hunger. A table blueprint gives no bonus.
- [x] Eating works as before. There is no new action.
- [x] The player can take down a table or its blueprint and get back every plank.
- [x] Tables and table blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [x] In the playground, a table spends no planks.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover placement, building, the hunger bonus near a finished table, and no bonus near a blueprint or out of reach.
