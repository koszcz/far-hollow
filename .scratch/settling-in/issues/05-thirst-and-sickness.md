# 05: Thirst, river water, and sickness

**What to build:** The player gets thirsty over time. They can drink from the river, but unboiled river water makes them sick. Sickness makes all needs drain faster. It wears off over one day, and resting speeds it up.

**Blocked by:** 01 (Turn warmth into one of four needs), 02 (Autosave and continue)

**Status:** resolved

- [x] Thirst drains over time. Low thirst slows the player, like other needs.
- [x] The player can click the river to walk to its bank and drink. Drinking fills thirst.
- [x] Drinking unboiled river water makes the player sick.
- [x] Sickness makes every need drain faster.
- [x] Sickness wears off over one day. Sleeping speeds this up once ticket 04 exists. Until then, resting means standing still.
- [x] The HUD shows thirst and whether the player is sick.
- [x] Thirst and sickness are saved.
- [x] All player-facing text lives in the strings file.
- [x] Unit tests cover thirst drain, drinking, catching sickness, faster drain while sick, and recovery.
