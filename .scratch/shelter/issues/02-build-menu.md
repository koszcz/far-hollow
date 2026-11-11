# 02: Build menu

**What to build:** The player presses B to open a build menu. It lists what they can build and its cost. Picking an entry puts its blueprint under the mouse. R rotates it, a click places it, and Esc cancels. The campfire moves into this menu.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `campfire` and `hud`.

- [ ] B opens and closes the build menu. It lists the campfire and its stick cost.
- [ ] Picking an entry shows its blueprint under the mouse, snapped to the building grid.
- [ ] The blueprint shows when its spot is not allowed.
- [ ] R rotates the blueprint by 90°. A click places it. Esc cancels.
- [ ] The build menu replaces the HUD button that places a campfire.
- [ ] Holding the build action on a blueprint works as before.
- [ ] The menu is built so the later shelter tickets can add entries with their own cost and placement rules.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover the menu's entries and placement through the menu.
