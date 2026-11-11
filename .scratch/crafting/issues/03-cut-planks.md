# 03: Cut planks at the sawhorse

**What to build:** Station recipes arrive. At a finished sawhorse, with the saw in the backpack, the player cuts one debarked log lying next to the sawhorse into four planks. See `.scratch/crafting/spec.md`.

**Blocked by:** 01, 02

**Status:** resolved

**Assets:** Reuse `sawhorse`, `debarked-log`, `player`, `chop-animation`, and `hud`. Add a plank icon to the draft `crafting-icons`.

- [x] The craft menu lists "Cut planks". It shows the saw or the sawhorse as missing until the player has both.
- [x] Choosing it in the craft menu walks the player to the nearest finished sawhorse, then starts the work.
- [x] Right-clicking a finished sawhorse offers "Cut planks". The player walks to it first.
- [x] A sawhorse blueprint does not count as a work station.
- [x] The recipe uses a debarked log lying within 2 m of the sawhorse. Without one, it does not start and a short message says why.
- [x] Cutting takes eight seconds of timed work. When it finishes, the debarked log is gone and four planks go in the backpack.
- [x] Each plank weighs 2 kg. The full-backpack and carrying refusals from ticket 01 apply.
- [x] Stopping partway leaves the debarked log where it was.
- [x] Planks are saved. The save version goes up.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover cutting planks, the missing-log refusal, the blueprint refusal, and stopping partway.
