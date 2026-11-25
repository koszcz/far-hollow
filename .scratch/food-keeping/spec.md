# Food keeping: food spoils, and the player preserves it

**Status:** ready-for-agent

## Problem statement

Food never goes bad, so the player can stockpile raw fish for weeks. With seasons, winter stops food from growing and freezes the river. A store of food that never spoils makes winter easy. Preparing for winter should be a real task.

## Solution

Fresh food spoils after a day or a few. The player preserves food on a drying rack, so that it keeps for good. Berries and mushrooms dry on the rack with no fire. Raw fish smokes on the rack while a lit fire is close by. A player who dries and smokes food in summer and autumn gets through winter. One who does not runs out of food.

## User stories

1. As a player, I want fresh food to spoil, so that I cannot stockpile it for winter.
2. As a player, I want cooked fish to keep longer than raw fish, so that cooking is worth it.
3. As a player, I want to see how soon my food spoils, so that I eat it or preserve it in time.
4. As a player, I want to be told when food spoils, so that I know where it went.
5. As a player, I want to eat my oldest food first, so that I waste as little as possible.
6. As a player, I want to build a drying rack from sticks and cord, so that I can preserve food early in the game.
7. As a player, I want to dry berries and mushrooms on the rack, so that they keep for winter.
8. As a player, I want to smoke raw fish on the rack next to a fire, so that fish keeps for winter.
9. As a player, I want preserved food to fill as much hunger as fresh food, so that preserving costs only time.
10. As a player, I want the journal to suggest preserving food, so that I learn to prepare for winter.
11. As a player with an older save, I want my food to keep its full time from when I load the game, so that the update costs me nothing.

## Implementation decisions

### Spoiling

- Fresh food is berries, mushrooms, raw fish, and cooked fish. Each spoils after a set keeping time, counted in game time from when it was gathered, caught, or cooked:

| Food | Keeps for |
|---|---|
| Raw fish | 1 day |
| Cooked fish | 2 days |
| Berries | 2 days |
| Mushrooms | 3 days |

- Food stays fully fresh until it spoils. It does not go stale first.
- Spoiled food vanishes. A short notice says what spoiled, such as "2 berries spoiled."
- Food spoils at the same rate in the backpack, in a chest, on a shelf, on the ground, and in every season.
- A fish in a fish trap does not spoil. A fish on a campfire or fireplace does not spoil.
- The backpack, chests, and shelves keep one count per food kind, as today. Each count also knows when each of its foods spoils. The player always eats, stores, and takes the oldest first.
- When a food is cooked, its keeping time starts again as cooked fish.

### Showing freshness

- Each fresh food's hotbar cell has a thin bar. The bar drains as the oldest of that food nears spoiling.
- The cell's tooltip says how long the oldest one has left, such as "Spoils in 14 h".
- The chest and shelf panels show the same bar and text for each fresh food.
- Preserved food has no bar.

### Preserving

- Preserved food never spoils. It weighs the same and fills the same hunger as the fresh food it came from: dried berries 0.1, dried mushroom 0.15, smoked fish 0.3. Smoked fish does not make the player sick.
- The drying rack is furniture from the build menu, built from 6 sticks and 2 cord. It stands indoors or outdoors.
- The player hangs food from the backpack on the rack, and takes it off by hand into the backpack. It works like fish on a fire. It is not crafting.
- The rack holds up to 6 foods in any mix.
- Drying berries or mushrooms takes 6 game hours and needs no fire.
- Smoking raw fish takes 4 game hours. It goes on only while a lit campfire or fireplace is within 2 m of the rack. If the fire goes out, the fish keeps its progress.
- The rack refuses cooked fish, with a reason (ADR 0008).
- Fresh food on the rack keeps spoiling until it is preserved.
- Finished food can stay on the rack for as long as the player likes.
- Rain does not affect the rack.
- The rack cannot be taken down while it holds food, as with a chest.
- The journal gets a last goal, "Preserve some food for winter". It is done the first time any food finishes on a rack.

### Older saves

- The save upgrade gives every food in an older save its full keeping time from the moment the save loads (ADR 0011).

## Testing decisions

- Test behaviour through the game's command and view seam, as the existing sim tests do. Do not test the internals.
- The prior art is the foraging, cooking, fish trap, firing, chest, shelf, and save upgrade tests.
- Check the visual drafts in the browser, following `docs/agents/game-testing.md`.

## Out of scope

- Clay crocks, salting, and a cold cellar.
- Rain that stops drying on an outdoor rack.
- Food that goes stale, or rotten food the player can still eat.
- Storage or cold weather that slows spoiling.

## Further notes

A full hunger bar lasts 2 game days. A 7-day winter needs about 3.5 full bars of food. That is about 12 smoked fish, or 35 dried berries, or a mix.
