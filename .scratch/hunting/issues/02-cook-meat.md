# 02: Cook meat on a fire

**What to build:** The player can cook raw meat on a lit fire, the same way as raw fish. Cooked meat fills hunger and does not make the player sick.

**Blocked by:** 01 (Cord and snare)

**Status:** deferred

**Assets:** Reuse `campfire`. Add the drafts `meat-on-fire`, `hunting-icons` (cooked meat icon), and `hunting-piles` (cooked meat).

- [ ] The player puts raw meat on a lit campfire within reach. If `.scratch/fireplace/` has landed, a lit fireplace takes it too.
- [ ] Meat and fish share the 3 places on a fire.
- [ ] Meat cooks in the same time as fish. Meat on a fire that is out keeps its progress.
- [ ] The player takes meat and fish off a fire together, cooked ones first, as far as they fit in the backpack.
- [ ] The meat shows on the fire and darkens as it cooks.
- [ ] Cooked meat is a new food that weighs 0.5 kg. It fills hunger as much as cooked fish and does not make the player sick. It never burns.
- [ ] Food eaten at a table fills more hunger, as with other food.
- [ ] Cooked meat can be dropped, forms piles, and can go in a chest or on a shelf.
- [ ] The fire's action menu and panel offer and show meat the way they do fish.
- [ ] Cooked meat and the meat on each fire, with its progress, are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` defines cooked meat, and says the player cooks raw fish or raw meat.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover cooking meat, meat and fish sharing a fire, taking them off, and eating cooked meat.
