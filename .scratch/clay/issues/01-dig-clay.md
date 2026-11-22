# 01: Dig clay on the river bank

**What to build:** The player can dig clay by hand anywhere on the river bank and carry it in the backpack. See `.scratch/clay/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Reuse `player` and its stone-gathering motion, `pile`, and `backpack-icons`. Add the draft `clay`.

- [ ] "Dig clay" sits in the action menu of river bank ground and of river water, just below "Gather stone". Neither menu's main action changes.
- [ ] Digging needs no tool. It takes longer than gathering one stone and reuses the stone-gathering motion.
- [ ] Each dig adds one clay to the backpack. One clay weighs 2 kg. A full backpack refuses with the reason (ADR 0008).
- [ ] The river bank never runs out of clay.
- [ ] Clay can be dropped, forms piles, and can go in a chest or on a shelf.
- [ ] Clay is saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` describes clay as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover digging, the weight limit, and saving.

## Comments

### Triage decisions (2026-11-22)

This file first held the triage questions for the whole clay feature. The answers are now in `.scratch/clay/spec.md`:

- Clay comes from anywhere on the river bank, weighs 2 kg, and never runs out.
- Pottery is one jug that holds 3 drinks of boiled water. Crocks wait until food can spoil.
- The player fires a jug on a lit campfire or fireplace. There is no kiln.
- Digging needs no tool.
- A clay oven, a clay chimney, and the rain barrel are not part of this feature.
