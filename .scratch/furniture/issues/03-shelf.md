# 03: Shelf

**What to build:** The player can build a standing shelf from 4 planks. It stores small things like a chest, but holds only 30 kg.

**Blocked by:** 01 (The chest costs planks)

**Status:** ready-for-agent

**Assets:** Reuse `player` and the chest panel's icons. Add the drafts `shelf` and `furniture-icons` (shelf icon).

- [ ] The build menu lists the shelf with its cost of 4 planks, and shows its icon.
- [ ] The shelf blueprint is placed freely, off the building grid. R rotates it. A click places it. Esc cancels.
- [ ] A shelf blueprint cannot overlap a standing tree, a structure, or other furniture.
- [ ] Planks reach the blueprint the way ticket 01 delivers them, over several trips if needed. Building needs no tool.
- [ ] The shelf shows its build stages.
- [ ] A finished shelf blocks walking.
- [ ] The player opens a shelf the same way as a chest. It uses the chest panel.
- [ ] A shelf holds small materials, tools, and food, up to 30 kg. Logs and debarked logs do not go on a shelf.
- [ ] The shelf model does not show what the shelf holds.
- [ ] The player cannot take down a shelf that still holds anything. Taking down an empty shelf or its blueprint returns every plank.
- [ ] Shelves, shelf blueprints, and what each shelf holds are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a shelf spends no planks.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, building, the 30 kg limit, and the rule against taking down a full shelf.
