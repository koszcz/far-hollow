# 01: The chest costs planks

**What to build:** A new chest costs 4 planks instead of 2 debarked logs. The planks come straight from the backpack. Chests in older saves keep the debarked logs they were built from.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Reuse `chest` unchanged. Reuse `crafting-icons` for the plank cost.

- [ ] The build menu lists the chest with its cost of 4 planks.
- [ ] Building a chest takes planks from the backpack, as a roof takes bark. The player does not carry planks to the blueprint.
- [ ] The chest blueprint and model look the same as before.
- [ ] Nothing else about building or using a chest changes.
- [ ] Taking down a new chest, or its blueprint, returns every plank spent or delivered.
- [ ] Chests and chest blueprints in older saves keep their debarked logs. Taking one down returns those logs.
- [ ] Plank chests are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a chest spends no planks.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover the plank cost, taking down new and old chests, and loading an older save.
