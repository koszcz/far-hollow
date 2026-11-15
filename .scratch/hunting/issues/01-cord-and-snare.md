# 01: Twist cord, set a snare, and take raw meat from it

**What to build:** The player can twist cord from bark, craft a snare, and set it on the ground. After some hours the snare holds a rabbit, and the player takes 2 raw meat from it. The player can eat raw meat, which makes them sick. Cooking comes in ticket 02.

**Status:** needs-triage

**Assets:** Add the drafts `hunting-icons` (cord, raw meat, and snare icons), `hunting-piles` (cord, raw meat, and snare), and `snare`.

- [ ] The craft menu lists cord as a hand recipe: 3 bark make 1 cord, with no tool. A cord weighs 0.1 kg.
- [ ] The craft menu lists the snare as a hand recipe: 1 cord and 2 sticks, with the knife. A snare weighs 0.5 kg.
- [ ] "Set" is the main action of a snare in the backpack. It sets the snare at the player's feet.
- [ ] A snare can be set only on forest floor or in a clearing, at least 10 m from any other set snare and at least 15 m from any structure. Otherwise "Set" shows greyed with the reason.
- [ ] A set snare catches a rabbit after 6 to 12 game hours. The time is drawn again after each catch, from the game's seeded random numbers.
- [ ] A snare holds one rabbit, and catches nothing more until the player empties it.
- [ ] A set snare shows whether it holds a rabbit. It does not block walking.
- [ ] "Take rabbit" is the main action of a snare that holds one. It needs the knife, and puts 2 raw meat in the backpack. The snare stays set.
- [ ] If 2 raw meat do not fit in the backpack, "Take rabbit" shows greyed with the reason.
- [ ] "Pick up" puts an empty set snare back in the backpack.
- [ ] Raw meat is a new food that weighs 0.5 kg. Eating it fills hunger as much as raw fish and gives the same sickness.
- [ ] Cord, raw meat, and snares can be dropped, form piles, and can go in a chest or on a shelf.
- [ ] Cord, raw meat, snares in the backpack, and set snares with their time to the next catch are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` defines cord, raw meat, and the snare as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover both recipes, where a snare can be set, the catch time, taking the rabbit, picking up, and eating raw meat.
