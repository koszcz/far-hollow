# 01: Drawknife and debarking

**What to build:** The player starts with a drawknife. They can debark a log that lies on the ground. Debarking turns it into a debarked log and adds bark to the backpack. Bark burns as fuel.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player`, `logs`, `chop-animation`, and `hud`. Add the drafts `debarked-log` and `bark`.

- [ ] A new game's backpack holds a drawknife, along with the axe, knife, fire striker, bedroll, and pot.
- [ ] Older saves gain a drawknife when they load.
- [ ] The player can right-click a log on the ground and choose "Debark". The player walks to it first.
- [ ] Debarking takes a few seconds of timed work, like chopping, and drains fatigue like other timed work.
- [ ] Debarking turns the log into one debarked log and adds bark to the backpack.
- [ ] The player can pick up, carry, and drop a debarked log, one at a time, like a log.
- [ ] Bark can fuel a campfire, like sticks.
- [ ] The HUD shows bark in the backpack.
- [ ] Debarked logs and bark are saved. The save version goes up.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover debarking, the starting kit, the save upgrade, and bark as fuel.
