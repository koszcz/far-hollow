# 03: Shelf

**What to build:** The player can build a standing shelf from 4 planks. It stores small things like a chest, but holds only 30 kg.

**Blocked by:** 01 (The chest costs planks)

**Status:** resolved

**Assets:** Reuse `player` and the chest panel's icons. Add the drafts `shelf` and `furniture-icons` (shelf icon).

- [x] The build menu lists the shelf with its cost of 4 planks, and shows its icon.
- [x] The shelf blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [x] A shelf blueprint cannot overlap a standing tree, a structure, or other furniture.
- [x] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [x] The shelf shows its build stages.
- [x] A finished shelf blocks walking.
- [x] The player opens a shelf the same way as a chest. It uses the chest panel.
- [x] A shelf holds small materials, tools, and food, up to 30 kg. Logs and debarked logs do not go on a shelf.
- [x] The shelf model does not show what the shelf holds.
- [x] The player cannot take down a shelf that still holds anything. Taking down an empty shelf or its blueprint returns every plank.
- [x] Shelves, shelf blueprints, and what each shelf holds are saved. The save version goes up, and older saves are upgraded when loaded.
- [x] In the playground, a shelf spends no planks.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover placement, building, the 30 kg limit, and the rule against taking down a full shelf.
