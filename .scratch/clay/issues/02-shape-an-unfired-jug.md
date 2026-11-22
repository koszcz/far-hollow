# 02: Shape an unfired jug

**What to build:** The player can shape 2 clay into an unfired jug with a hand recipe. See `.scratch/clay/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

**Assets:** Reuse `clay` and `pile`. Add the drafts `jug` (the unfired look) and `jug-icons` (the unfired jug's backpack icon and the craft menu icon).

- [ ] The craft menu lists the unfired jug as a hand recipe: 2 clay, with no tool.
- [ ] Crafting it adds one unfired jug to the backpack. The hotbar shows it with its icon.
- [ ] An unfired jug cannot hold water. No action offers to fill it.
- [ ] Unfired jugs can be dropped, form piles, and can go in a chest or on a shelf.
- [ ] Unfired jugs are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` describes the unfired jug as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover crafting and saving.
