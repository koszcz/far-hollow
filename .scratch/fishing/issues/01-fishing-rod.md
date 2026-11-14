# 01: Fishing line and fishing rod

**What to build:** The player starts with a fishing line. They craft it with 2 sticks into a fishing rod in the craft menu. See "The fishing rod" in `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player`, `chop-animation`, `hud`, `backpack-icons`, and `crafting-icons`. Add the draft `fishing-icons` with icons for the fishing line and the fishing rod. Add the draft `fishing-piles` with the fishing line and the fishing rod lying on the ground.

- [x] A new game's backpack holds a fishing line, along with the rest of the starting kit.
- [x] Older saves gain a fishing line when they load, unless they already hold a fishing rod.
- [x] The fishing line weighs 0.1 kg. The fishing rod weighs 0.5 kg.
- [x] The craft menu lists the fishing rod as a hand recipe. It uses 1 fishing line and 2 sticks, needs the knife, and takes 5 seconds.
- [x] The recipe follows the existing crafting rules: nothing is used up if the player stops, and the carrying and full-backpack refusals apply.
- [x] The fishing line and the fishing rod can be dropped as piles and stored in a chest.
- [x] The fishing line and the fishing rod are saved. The save version goes up.
- [x] `GLOSSARY.md` defines the fishing line and the fishing rod.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover crafting the rod, the starting kit, and the save upgrade.
