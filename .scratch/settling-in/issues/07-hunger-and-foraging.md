# 07: Hunger and foraging

**What to build:** The player gets hungry over time. Berry bushes and mushrooms grow in the valley. The player can forage them and eat them to fill hunger.

**Blocked by:** 01 (Turn warmth into one of four needs), 02 (Autosave and continue)

**Status:** resolved

**Assets:** Add the drafts `berry-bush`, shown with and without berries, and `mushrooms`.

- [x] Hunger drains over time. Low hunger slows the player, like other needs.
- [x] The seed decides where berry bushes and mushrooms grow. The same seed always places them the same way.
- [x] The player can click a bush or mushroom to walk to it and forage. The food goes in the backpack, if it fits.
- [x] A foraged bush or mushroom spot grows back over several days.
- [x] The player can eat berries or mushrooms from the backpack. Eating fills hunger. Neither causes sickness.
- [x] The HUD shows hunger.
- [x] Hunger, foraged food, and the state of each bush and mushroom spot are saved.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover hunger drain, seeded placement, foraging, regrowth, and eating.
