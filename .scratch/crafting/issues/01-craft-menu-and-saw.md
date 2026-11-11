# 01: Craft menu and the saw

**What to build:** The player presses C to open a craft menu. It lists every recipe. The first recipe is the saw: a hand recipe that turns a saw blade and three sticks into a saw. Crafting is timed work, like chopping. See `.scratch/crafting/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Reuse `player`, `chop-animation`, `hud`, and `backpack-icons`. Add the draft `crafting-icons` with icons for the saw blade and the saw.

- [ ] A new game's backpack holds a saw blade, along with the rest of the starting kit.
- [ ] Older saves gain a saw blade when they load, unless they already hold a saw.
- [ ] The saw blade weighs 0.5 kg. The saw weighs 1 kg.
- [ ] C opens and closes the craft menu. It lists every recipe with its materials and time.
- [ ] A recipe the player cannot follow yet shows the tool or work station it is missing.
- [ ] Choosing the saw recipe starts five seconds of timed work where the player stands. It drains fatigue like other timed work.
- [ ] When the work finishes, one saw blade and three sticks leave the backpack and a saw goes in.
- [ ] If the player stops partway, nothing is used up. The work starts again from the beginning next time.
- [ ] Crafting does not start while the player carries a log. The menu says to put the log down first.
- [ ] Crafting does not start if the result would not fit in the backpack. The weight of the materials it uses up counts as freed first. A short message says why.
- [ ] Recipes are built so later tickets can add hand recipes and station recipes without changing how crafting works.
- [ ] The saw blade and the saw are saved. The save version goes up.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover crafting the saw, stopping partway, the full-backpack refusal, the carrying refusal, the starting kit, and the save upgrade.
