# Fishing and cooking: spec

The player can only eat berries and mushrooms. Both are small meals, and the bushes and patches take three days to grow back. The river holds fish, but the player cannot catch them. This feature lets the player make a **fishing rod**, catch fish at the **river**, and **cook** them on a **campfire**.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- The player has a food source that never runs out.
- Raw fish makes the player sick, so cooking matters.
- The campfire becomes the place where the player prepares food, not only water.

## The fishing rod

- A new game's backpack holds a **fishing line**, along with the rest of the starting kit. The player brought it into the valley, like the saw blade.
- Older saves gain a fishing line when they load, unless they already hold a fishing rod.
- The fishing rod is a hand recipe in the craft menu. It uses 1 fishing line and 2 sticks and needs the knife. The work takes 5 seconds.
- The fishing line weighs 0.1 kg. The fishing rod weighs 0.5 kg.
- The fishing rod is a **tool**, so it never wears out.

## Catching fish

1. The player clicks the river. Its action menu now offers "Fish" after "Drink". Drinking stays the main action.
2. "Fish" shows greyed, with the reason, if the backpack holds no fishing rod.
3. The player walks to the river bank, as when they drink, and casts the line.
4. After a wait, a fish bites and the player reels it in. One **raw fish** goes in the backpack.
5. The player casts again on their own. They keep fishing until the player stops, walks away, or the backpack is full.

- Each wait lasts a random 15 to 45 game minutes. That is 15 to 45 real seconds.
- The waits come from the game's random numbers, so tests can repeat them.
- Fishing is timed work. It drains fatigue like other timed work.
- The player cannot fish while they carry a log or drag a sled.
- The player can fish by day or night, and in the rain.
- The river never runs out of fish.
- If the backpack is full when a fish bites, the fish gets away. A short message says why, and fishing stops.

## Cooking fish

- The player cooks fish on a lit campfire. Cooking needs no tool and no pot.
- A campfire holds up to 3 fish at once, beside the pot. The pot and the fish do not get in each other's way.
- The campfire's action menu offers "Cook fish". It puts one raw fish from the backpack on the fire. It shows greyed, with the reason, if the fire is not lit, the player has no raw fish, or the fire already holds 3 fish.
- A fish on a lit fire becomes **cooked fish** after 8 game minutes.
- If the fire goes out, the fish stop cooking. They keep their progress and go on cooking when the fire is lit again.
- Cooked fish never burn. They can stay on the fire as long as the player likes.
- The action menu offers "Take fish off". It moves every fish on the fire into the backpack, raw or cooked, as far as they fit. The rest stay on the fire.
- The campfire's panel shows each fish on the fire and how far it has cooked.
- The player cannot take down a campfire while fish are on it, as with the pot.

## Eating

| Food | Fills hunger by | Sickness |
| --- | --- | --- |
| Berries (as now) | 0.1 | None |
| Mushroom (as now) | 0.15 | None |
| Raw fish | 0.15 | Makes the player sick |
| Cooked fish | 0.3 | None |

- Hunger runs from 0 to 1. A full stomach lasts 48 game hours, so one cooked fish lasts about 14 game hours.
- The player eats fish from the backpack, like berries. Each one is a backpack content that the hotbar shows.
- Eating raw fish gives the same **sickness** as unboiled river water.
- Raw fish and cooked fish each weigh 0.5 kg.
- Fish never rot.

## Dropping and storing

- The fishing line, the fishing rod, raw fish, and cooked fish can be dropped. They form **piles** like other things.
- All four can go in a **chest**.

## Saving

- The fishing line, the fishing rod, raw and cooked fish, and the fish on each campfire with their progress are saved.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `fishing-icons` | Backpack icons for the fishing line, the fishing rod, raw fish, and cooked fish, drawn in the same style as `backpack-icons` |
| `fishing-rod` | The rod in the player's hands: a thin stick with the line tied to its tip |
| `fishing-animation` | The player casts, waits with the rod held out, then reels in and lifts the fish |
| `fish-on-fire` | Up to 3 fish on sticks leaning over the campfire. They darken as they cook. |
| `fishing-piles` | How the fishing line, the fishing rod, raw fish, and cooked fish look lying on the ground |

`campfire` and `pile` are approved assets. So the fish on the fire and the fishing piles go in their own draft entries. Merging them into `campfire` or `pile` needs the owner's approval.

## Not in this feature

- Meat, snares, and the bow
- A fishing minigame, bait, or kinds of fish
- Fish that run out, or better and worse spots on the river
- Food that rots
- Fish that burn
- Cooking anything other than fish
- Cooking with the pot, such as soup
