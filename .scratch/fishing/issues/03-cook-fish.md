# 03: Cook fish on a campfire

**What to build:** The player puts raw fish on a lit campfire. After a while they become cooked fish, which the player takes off and eats. See "Cooking fish" and "Eating" in `../spec.md`.

**Blocked by:** 02 (Catch fish at the river)

**Status:** ready-for-agent

**Assets:** Reuse `campfire`, `fire-effect`, `pot`, `player`, `pick-up-animation`, and `fishing-icons`. Add the draft `fish-on-fire`. Add a cooked fish icon to `fishing-icons` and cooked fish to `fishing-piles`.

- [ ] The campfire's action menu offers "Cook fish". It puts one raw fish from the backpack on the fire.
- [ ] "Cook fish" shows greyed, with the reason, if the fire is not lit, the player has no raw fish, or the fire holds 3 fish.
- [ ] A campfire holds up to 3 fish, beside the pot. The pot and the fish do not get in each other's way.
- [ ] A fish on a lit fire becomes cooked fish after 8 game minutes.
- [ ] If the fire goes out, the fish keep their progress. They go on cooking when the fire is lit again.
- [ ] Cooked fish never burn.
- [ ] "Take fish off" moves every fish on the fire into the backpack, raw or cooked, as far as they fit. The rest stay on the fire.
- [ ] The campfire's panel shows each fish on the fire and how far it has cooked.
- [ ] The player cannot take down a campfire while fish are on it. The menu says why.
- [ ] Cooked fish weighs 0.5 kg. Eating one fills hunger by 0.3 and does not make the player sick.
- [ ] Cooked fish can be dropped as a pile and stored in a chest.
- [ ] Cooked fish and the fish on each campfire, with their progress, are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` defines cooked fish and to cook.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover cooking, the 3-fish limit, a fire going out, taking fish off with a full backpack, the take-down refusal, eating cooked fish, and saving.
