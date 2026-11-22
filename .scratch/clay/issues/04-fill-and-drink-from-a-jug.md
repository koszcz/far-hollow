# 04: Pour boiled water into a jug, then drink from it

**What to build:** The player can pour a pot of boiled water into a jug, up to 3 drinks, and drink from it later. See `.scratch/clay/spec.md`.

**Blocked by:** 03

**Status:** needs-triage

**Assets:** Reuse `jug`, `pot`, and `pile`. Extend the draft `jug-icons` with a backpack icon for each fill level.

- [ ] A jug that is not full offers "Pour in boiled water" when the backpack holds a pot of boiled water. Otherwise the action shows greyed with the reason (ADR 0008).
- [ ] Each pour adds 1 drink to the jug and leaves the pot empty.
- [ ] A jug never holds unboiled river water. No action fills it at the river.
- [ ] Each fill level is its own backpack content: empty, 1, 2, or 3 drinks.
- [ ] Pouring goes into the fullest jug that still has room.
- [ ] "Drink" is the main action of a jug that holds water. Each drink fills thirst completely and takes 1 drink out of the jug.
- [ ] Drinking comes from the emptiest jug that holds water.
- [ ] A jug weighs 1 kg plus 2 kg for each drink, so a full jug weighs 7 kg.
- [ ] A dropped jug, or one in a chest or on a shelf, keeps its water. Jugs of the same fill level join one pile.
- [ ] Jugs and their water are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover pouring, the 3-drink limit, which jug is filled and drunk from, weight, dropping, and saving.
