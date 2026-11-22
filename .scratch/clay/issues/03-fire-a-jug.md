# 03: Fire a jug on a campfire or fireplace

**What to build:** The player can put an unfired jug on a lit campfire or fireplace. After 20 game minutes of fire, it becomes a jug. See `.scratch/clay/spec.md`.

**Blocked by:** 02

**Status:** resolved

**Assets:** Reuse `campfire`, `fireplace`, `pot`, and `fish-on-fire`. Extend the drafts `jug` (the fired look, and both looks sitting on a fire) and `jug-icons` (the empty jug's backpack icon).

- [x] A lit campfire or fireplace offers "Fire jug" when the backpack holds an unfired jug. On an unlit fire, the action shows greyed with the reason (ADR 0008).
- [x] A campfire or fireplace fires one jug at a time. The jug sits there with the pot and the fish.
- [x] Firing takes 20 game minutes on a lit fire.
- [x] If the fire goes out, the jug keeps its progress. Firing carries on when the fire is lit again.
- [x] The campfire and fireplace panels show how far the firing has gone.
- [x] Taking an unfired jug off early puts it back in the backpack with its progress at zero.
- [x] A finished jug stays on the fire until the player takes it off. Taking it off puts an empty jug in the backpack.
- [x] An empty jug weighs 1 kg. It can be dropped, forms piles, and can go in a chest or on a shelf.
- [x] A jug on a fire, with its firing progress, and empty jugs are saved. The save version goes up, and older saves are upgraded when loaded.
- [x] `GLOSSARY.md` describes firing and the jug as the spec does.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover firing, a fire going out, taking a jug off early and when it is done, and saving.
