# 04: Open a chest and move things

**What to build:** The player can open a chest and move small materials, tools, and food between it and the backpack. This is how the player keeps the camp organised.

**Blocked by:** 03 (Place and build a chest)

**Status:** resolved

**Assets:** Reuse `chest`, `player`, and `backpack-icons`.

- [ ] Clicking a finished chest walks the player to it and opens it.
- [ ] A chest panel opens beside the backpack. It shows the chest's contents as a grid of icons, grouped by kind, like the backpack.
- [ ] Clicking an icon moves one of that kind between the backpack and the chest.
- [ ] Shift-clicking an icon moves all of that kind, or as many as fit.
- [ ] A chest holds up to 60 kg. Logs and debarked logs do not go in a chest.
- [ ] The panel closes when the player walks away.
- [ ] Chest contents are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover moving one, moving all, the weight limit, and saving.
