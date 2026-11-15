# 01: Craft a torch, light it, and carry it

**What to build:** The player can craft a torch from a stick and bark, light it, and carry it. A lit torch lights the ground around the player for 3 game hours.

**Status:** needs-triage

**Assets:** Reuse `player` and `fire-effect`. Add the drafts `torch` and `torch-icons`.

- [ ] The craft menu lists the torch as a hand recipe: 1 stick and 1 bark, with no tool.
- [ ] A torch is a new backpack content that weighs 0.8 kg. The hotbar shows it with its icon.
- [ ] Unlit torches can be dropped, form piles, and can go in a chest or on a shelf.
- [ ] "Light" is the main action of a torch in the backpack. Without the steel and flint, it shows greyed with the reason.
- [ ] Lighting takes one torch out of the backpack and puts it in the player's hand, lit.
- [ ] The player holds one lit torch at a time. With a torch already lit, "Light" shows greyed with the reason.
- [ ] A lit torch lights the ground within about 6 m of the player. It casts no shadows.
- [ ] A lit torch burns for 3 game hours, then is gone.
- [ ] The hotbar shows the lit torch with a gauge of the burning time left.
- [ ] The player keeps the lit torch while they walk, work, carry a log, and drag a sled.
- [ ] "Put out" throws the lit torch away.
- [ ] The player puts out the torch before they sleep.
- [ ] A torch gives no warmth, and rain does not put it out.
- [ ] Unlit torches, the lit torch, and its burning time left are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` describes the torch as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover crafting, lighting, the one-torch limit, burning out, putting out, and sleeping.
