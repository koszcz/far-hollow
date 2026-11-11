# 03: Place and build a chest

**What to build:** The player can place a chest blueprint anywhere, off the building grid, and build it. The chest is the first piece of furniture. It cannot be opened yet.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player` and `debarked-log`. Adds the draft `chest`.

- [ ] The build menu lists the chest, with its cost of 2 debarked logs.
- [ ] The chest blueprint follows the mouse freely. It does not snap to the building grid.
- [ ] R rotates the chest blueprint. A click places it. Esc cancels.
- [ ] A chest blueprint cannot overlap a standing tree, a structure, or other furniture.
- [ ] The player delivers debarked logs to the blueprint and holds the build action, as with other structures.
- [ ] Building a chest needs the axe.
- [ ] The chest shows its build stages.
- [ ] Chests and chest blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover free placement, rotation, overlap rules, and building.
