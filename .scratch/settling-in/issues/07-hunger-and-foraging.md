# 07: Hunger and foraging

**What to build:** The player gets hungry over time. Berry bushes and mushrooms grow in the valley. The player can forage them and eat them to fill hunger.

**Blocked by:** 01 (Turn warmth into one of four needs), 02 (Autosave and continue)

**Status:** ready-for-agent

- [ ] Hunger drains over time. Low hunger slows the player, like other needs.
- [ ] The seed decides where berry bushes and mushrooms grow. The same seed always places them the same way.
- [ ] The player can click a bush or mushroom to walk to it and forage. The food goes in the backpack, if it fits.
- [ ] A foraged bush or mushroom spot grows back over several days.
- [ ] The player can eat berries or mushrooms from the backpack. Eating fills hunger. Neither causes sickness.
- [ ] The HUD shows hunger.
- [ ] Hunger, foraged food, and the state of each bush and mushroom spot are saved.
- [ ] Before any bush or mushroom model enters the game, the owner approves it (ADR 0004).
- [ ] Unit tests cover hunger drain, seeded placement, foraging, regrowth, and eating.
