# 01: Gather stone on the river bank

**What to build:** The player can gather stone on the river bank and carry it in the backpack. Stone can be dropped, picked up, and stored. Nothing uses stone yet.

**Status:** ready-for-agent

**Assets:** Reuse `player` and `river`. Add the drafts `stone` and `gather-stone-animation`.

- [ ] Stone is a new backpack content that weighs 2 kg. The hotbar shows it with its icon.
- [ ] Clicking river bank ground or the river offers "Gather stone". The player walks into reach first.
- [ ] Gathering one stone takes 4 seconds of held work and needs no tool. It drains fatigue like other timed work.
- [ ] Stone never runs out.
- [ ] If one more stone does not fit in the backpack, the action shows greyed with the reason.
- [ ] The player plays `gather-stone-animation` while gathering.
- [ ] Stone can be dropped. Dropped stone forms piles and can be picked up again.
- [ ] Stone can go in a chest and on a shelf.
- [ ] A sled does not take stone.
- [ ] Stone and stone piles are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, the player starts with stone, like the other materials.
- [ ] `GLOSSARY.md` defines stone as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover where gathering is offered, the time it takes, a full backpack, and dropping and storing stone.
