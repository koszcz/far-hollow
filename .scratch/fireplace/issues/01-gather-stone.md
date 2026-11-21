# 01: Gather stone on the river bank

**What to build:** The player can gather stone on the river bank and carry it in the backpack. Stone can be dropped, picked up, and stored. Nothing uses stone yet.

**Status:** resolved

**Assets:** Reuse `player` and `river`. Add the drafts `stone` and `gather-stone-animation`.

- [x] Stone is a new backpack content that weighs 2 kg. The hotbar shows it with its icon.
- [x] Clicking river bank ground or the river offers "Gather stone". The player walks into reach first.
- [x] Gathering one stone takes 4 seconds of held work and needs no tool. It drains fatigue like other timed work.
- [x] Stone never runs out.
- [x] If one more stone does not fit in the backpack, the action shows greyed with the reason.
- [x] The player plays `gather-stone-animation` while gathering.
- [x] Stone can be dropped. Dropped stone forms piles and can be picked up again.
- [x] Stone can go in a chest and on a shelf.
- [x] A sled does not take stone.
- [x] Stone and stone piles are saved. The save version goes up, and older saves are upgraded when loaded.
- [x] In the playground, the player starts with stone, like the other materials.
- [x] `GLOSSARY.md` defines stone as the spec does.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover where gathering is offered, the time it takes, a full backpack, and dropping and storing stone.
