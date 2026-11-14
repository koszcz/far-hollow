# 02: Catch fish at the river

**What to build:** The player fishes from the river bank with the fishing rod and catches raw fish. They can eat raw fish, which makes them sick. See "Catching fish" and "Eating" in `../spec.md`.

**Blocked by:** 01 (Fishing line and fishing rod)

**Status:** ready-for-agent

**Assets:** Reuse `player`, `river`, `hud`, and `fishing-icons`. Add the draft `fishing-rod` and the draft `fishing-animation`. Add a raw fish icon to `fishing-icons` and raw fish to `fishing-piles`.

- [ ] The river's action menu offers "Fish" after "Drink". Drinking stays the main action.
- [ ] "Fish" shows greyed, with the reason, if the backpack holds no fishing rod.
- [ ] The player walks to the river bank and casts. After a random wait of 15 to 45 game minutes, one raw fish goes in the backpack.
- [ ] The waits come from the game's seeded random numbers.
- [ ] The player casts again on their own until they stop, walk away, or the backpack is full.
- [ ] If a fish bites when the backpack is full, the fish gets away. A short message says why, and fishing stops.
- [ ] Fishing is timed work that drains fatigue like other timed work.
- [ ] The player cannot fish while they carry a log or drag a sled. The menu says why.
- [ ] The player holds the fishing rod and plays the fishing animation while they fish.
- [ ] Raw fish weighs 0.5 kg. Eating one fills hunger by 0.15 and makes the player sick.
- [ ] Raw fish can be dropped as a pile and stored in a chest.
- [ ] Raw fish are saved.
- [ ] `GLOSSARY.md` defines raw fish.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover the wait, the catch, casting again, the full-backpack escape, the refusals, and eating raw fish.
