# 01: Fresh food spoils

**What to build:** Berries, mushrooms, raw fish, and cooked fish spoil after a set time, wherever they are. The player sees how soon each food spoils and is told when it does. See `.scratch/food-keeping/spec.md`. Ticket 02 adds the drying rack, so food can be preserved.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `hud` for the freshness bar, tooltip, and spoil notice. No new assets. Settled with the owner on 2026-11-25.

## Spoiling

- [x] Each fresh food spoils after its keeping time, counted in game time from when it was gathered, caught, or cooked: raw fish 1 day, cooked fish 2 days, berries 2 days, mushrooms 3 days.
- [x] Food stays fully fresh until it spoils, and fills its full hunger until then.
- [x] Spoiled food vanishes. A short notice says what spoiled, such as "2 berries spoiled."
- [x] Food spoils at the same rate in the backpack, in a chest, on a shelf, and on the ground, and in every season.
- [x] A fish in a fish trap does not spoil. A fish on a campfire or fireplace does not spoil.
- [x] A cooked fish starts its keeping time when it is cooked.
- [x] The backpack, chests, and shelves keep one count per food kind, as today. Each count also knows when each of its foods spoils. Eating, storing, taking, and dropping always use the oldest first.
- [x] The spoil times are part of a value object with pure functions (ADR 0009).

## Showing freshness

- [x] Each fresh food's hotbar cell has a thin bar that drains as the oldest of that food nears spoiling.
- [x] The cell's tooltip says how long the oldest one has left, such as "Spoils in 14 h".
- [x] The chest and shelf panels show the same bar and text for each fresh food.

## Saving

- [x] Spoil times are saved, for the backpack, chests, shelves, and dropped food. The save version goes up.
- [x] The save upgrade gives every food in an older save its full keeping time from the moment the save loads (ADR 0011).

## The rest

- [x] `GLOSSARY.md` defines Fresh food and Spoil. This is done already.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover each keeping time, oldest-first eating and moving, spoiling in each place, the trap and fire exemptions, cooking restarting the time, the notice, and the save upgrade.

## Comments

- 2026-11-25, implementation: a fish on a fire does not spoil, so a cooked fish starts its 2 days when the player takes it off the fire. A fish cooked and left on the fire for hours still gets its full 2 days.
- Food that joins a holder by any route other than a move between holders, such as foraging, fishing, a trap, or taking fish off a fire, gets its full keeping time. Food that leaves by any other route, such as eating, cooking, or planting a mushroom, takes the oldest first.
