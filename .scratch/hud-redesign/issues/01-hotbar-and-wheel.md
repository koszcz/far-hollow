# 01: Hotbar and wheel HUD

**Status:** resolved

**Assets:** changes the approved `hud`. The owner approved this change in chat on 2026-11-11. Reuses the approved `backpack-icons`, and the draft `build-icons` and `crafting-icons`.

**What to build:** The owner chose variant B, "Hotbar and wheel", from four HUD mockups on 2026-11-11. The HUD moves to the bottom centre of the screen, so the scene stays clear.

- [x] The backpack becomes a hotbar: one row of item cells at the bottom centre, with the backpack weight at its end. A click on a cell drops one of that item, as before. With a chest open, a click puts the item in the chest.
- [x] The hotbar has no number keys and shows no keyboard shortcuts.
- [x] The buttons to eat, lay the bedroll, fill the pot, and drink sit in the hotbar, after the item cells.
- [x] The four needs show as short bars with icons, in two columns, just above the hotbar. A low need still pulses. The sickness hint stays.
- [x] The time of day and the pause button sit in the top corners.
- [x] Build and craft are icon buttons at the end of the hotbar. Each opens a wheel in the centre of the screen. The B and C keys still open and close their wheels, and Escape closes them.
- [x] The build wheel shows one segment per structure, with its icon. Pointing at a segment shows its name and cost in the wheel's centre. A click picks it, as the build menu did.
- [x] The craft wheel shows one segment per recipe, with the icon of what it makes. The centre shows the name, cost, time, and any missing tool or station. A recipe the player cannot follow yet is dimmed.
- [x] The context panels (campfire, woodpile, bedroll, pile, blueprint, carrying a log, timed work, placing) and the open chest sit in one column just above the needs bars.
- [x] Banners stay at the top centre.
- [x] The `hud` catalogue entry describes the new layout and records the owner's approval. The showcase at `/?asset=hud` shows the new HUD.

## Comments

**2026-11-11.** The owner answered three scope questions in chat.

- The hotbar has no number keys and shows no keyboard shortcut labels.
- The context panels dock above the hotbar. They do not follow the object on screen.
- Each wheel opens and closes with a press, not a hold, so it works with a trackpad.
