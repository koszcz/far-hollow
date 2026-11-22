# 01: Build a rain barrel, catch rain, and drink or fill the pot from it

**What to build:** The player can build a rain barrel. While rain falls on it, it fills with clean water. The player drinks from it or fills the pot from it, with no boiling. See `.scratch/rain-barrel/spec.md`.

**Status:** resolved

**Assets:** Add the drafts `rain-barrel` (plank staves held by two hoops, open on top, with a water surface that rises with the drinks it holds) and `rain-barrel-icon` (its build menu icon). Reuse `pot`. Decided with the owner on 2026-11-22.

## Building

- [x] The build menu lists the rain barrel as furniture, after the stool. It costs 6 planks, needs the axe, and takes 10 seconds to build.
- [x] It is placed freely, like the chest, and does not snap to the grid. It blocks walking.
- [x] Taking it down gives back its planks. Its water spills.

## Catching rain

- [x] A barrel holds up to 6 drinks.
- [x] It gains 1 drink for every 2 game hours that rain falls on it. Progress toward the next drink carries over between spells of rain. Time runs on while the player sleeps.
- [x] A barrel under a roof, where rain would not fall on the player, catches nothing. It uses the same rule as the player's shelter from rain.
- [x] A full barrel stops gaining water. Its progress does not build up.
- [x] The barrel's water surface rises with the drinks it holds. An empty barrel shows no water.
- [x] The barrel's info shows its drinks out of 6. Under a roof it also shows "Under a roof: catches no rain."
- [x] The rule of filling up to a limit, with progress carried over, is a value object (ADR 0009).

## Drinking and filling the pot

- [x] "Drink" is the main action of a barrel that holds water. It fills thirst completely, takes out 1 drink, and never makes the player sick.
- [x] "Fill pot" turns the empty pot in the backpack into a pot of clean water and takes out 1 drink. The pot then works as one of boiled water: the player can drink it or pour it into a jug.
- [x] The pot of boiled water is renamed "Pot of clean water" everywhere the player sees it.
- [x] Each action is quick, not timed work. The player first walks within reach of the barrel.
- [x] "Drink" and "Fill pot" show greyed, with the reason, when the barrel is empty (ADR 0008).
- [x] "Fill pot" also shows greyed, with the reason, when the backpack holds no empty pot.

## Saving and the rest

- [x] A barrel is saved with its spot, its facing, its drinks, and its progress toward the next drink. The save version goes up, and older saves are upgraded when loaded (ADR 0011).
- [x] Barrel water never goes bad.
- [x] The journal gets no new goal.
- [x] `GLOSSARY.md` defines the rain barrel, the drink, and clean water. This is done already.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover the cost, filling in the rain, the 6-drink limit, carried-over progress, no filling under a roof, drinking, filling the pot, the refusals, taking down, and saving.
