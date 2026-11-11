# 02: Woodpile

**What to build:** The player can build a woodpile from the build menu and stack logs, debarked logs, and firewood on it. They can take them off again.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player`, `logs`, `debarked-log`, `firewood`, and `backpack-icons`. Adds the draft `woodpile`.

- [ ] The build menu lists the woodpile. It snaps to the building grid, like a campfire.
- [ ] A woodpile costs nothing and takes a short construction.
- [ ] The player puts the log or debarked log on their shoulder onto the woodpile, one at a time.
- [ ] The player puts firewood from the backpack onto the woodpile. Clicking moves one. Shift-clicking moves all that fit.
- [ ] A woodpile holds up to 20 logs, debarked logs, and pieces of firewood, in any mix.
- [ ] Taking a log or debarked log off the woodpile puts it on the player's shoulder, if their shoulder is free.
- [ ] Taking firewood off the woodpile puts as much as fits in the backpack.
- [ ] The woodpile shows how full it is.
- [ ] The player cannot fuel a campfire straight from the woodpile.
- [ ] Rain has no effect on the woodpile.
- [ ] Woodpiles and what they hold are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover stacking, the limit, taking off, and saving.
