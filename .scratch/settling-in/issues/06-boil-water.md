# 06: Boil water at a campfire

**What to build:** The player starts with a pot. They fill it at the river, boil it on a lit campfire, and drink the boiled water. Boiled water fills thirst without making the player sick.

**Blocked by:** 05 (Thirst, river water, and sickness)

**Status:** ready-for-agent

**Assets:** Reuse `campfire` and `fire-effect`. Add the draft `pot`, shown empty, full of water, and steaming while it boils.

- [ ] A new game starts with a pot in the backpack.
- [ ] The player can fill the pot at the river.
- [ ] The player can put a full pot on a lit campfire. Boiling takes a short, timed wait.
- [ ] The pot comes off the fire holding boiled water. If the fire goes out first, the water stays unboiled.
- [ ] The player can drink boiled water from the pot. It fills thirst and does not cause sickness.
- [ ] The pot's state is saved: empty, full of river water, or full of boiled water.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover filling, boiling, a fire going out mid-boil, and drinking safely.
