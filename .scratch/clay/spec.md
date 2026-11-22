# Clay: spec

The metal pot holds only one drink of boiled water, so the player must boil water again every time they get thirsty. This feature adds **clay** and the **jug**. The player digs clay on the river bank, shapes it into an **unfired jug**, and **fires** it on a campfire or fireplace. A jug holds 3 drinks of boiled water.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies.

## Goals

- The player can carry more than one drink of safe water away from the fire.
- Clay, which the design spec lists as a material, gets its first use.

## Digging clay

- The player digs clay by hand anywhere on the river bank. It needs no tool.
- "Dig clay" sits in the action menu of river bank ground and of river water, just below "Gather stone". Neither menu's main action changes.
- Digging one clay takes longer than gathering one stone. It reuses the player's stone-gathering motion.
- One clay weighs 2 kg. The player carries it in the backpack.
- The river bank never runs out of clay.
- Clay can be dropped, forms piles, and can go in a chest or on a shelf.

## Shaping an unfired jug

- The unfired jug is a hand recipe: 2 clay. It needs no tool.
- An unfired jug goes into the backpack. It cannot hold water.
- Unfired jugs can be dropped, form piles, and can go in a chest or on a shelf.

## Firing a jug

- The player puts an unfired jug from the backpack on a lit campfire or fireplace. It sits there with the pot and the fish.
- A campfire or fireplace fires one jug at a time.
- Firing takes 20 game minutes on a lit fire.
- If the fire goes out, the jug keeps its progress. Firing carries on when the fire is lit again.
- The campfire or fireplace panel shows how far the firing has gone.
- Taking an unfired jug off the fire early sets its progress back to zero.
- A finished jug can stay on the fire for as long as the player likes. It never breaks. The player takes it off by hand into the backpack.

## Filling and drinking from a jug

- A jug holds up to 3 drinks of boiled water.
- The player fills it only by pouring in a pot of boiled water. Each pour adds 1 drink and empties the pot. A jug never holds unboiled river water.
- "Pour in boiled water" is offered on a jug that is not full, when the backpack holds a pot of boiled water.
- "Drink" is the main action of a jug that holds water. Each drink fills thirst completely.
- Each fill level is its own backpack content: empty, 1, 2, or 3 drinks. The pot works the same way.
- Pouring goes into the fullest jug that still has room. Drinking comes from the emptiest jug that holds water.
- An empty jug weighs 1 kg. Each drink adds 2 kg, so a full jug weighs 7 kg.
- The player can have as many jugs as the backpack's weight limit allows.
- A jug never breaks. Jugs can be dropped, form piles, and can go in a chest or on a shelf. A dropped or stored jug keeps its water.

## Saving

- Clay, unfired jugs, jugs with their water, and a jug on a fire with its firing progress are saved.
- The save version goes up. Older saves are upgraded when loaded (ADR 0011).

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `clay` | Clay lying in a pile, in the player's hands while digging, and its backpack icon |
| `jug` | The unfired jug and the jug, lying in a pile and sitting on a fire |
| `jug-icons` | The backpack icons for the unfired jug and each jug fill level, and the craft menu icon |

`backpack-icons` and `crafting-icons` are approved assets, so the jug icons go in their own draft entry. Digging reuses the player's stone-gathering motion. Nothing comes from third-party packs.

## Tickets

1. Dig clay on the river bank.
2. Shape an unfired jug with a hand recipe. Blocked by 01.
3. Fire a jug on a campfire or fireplace. Blocked by 02.
4. Pour boiled water into a jug, then drink from it. Blocked by 03.

## Not in this feature

- Crocks or other food storage. Food does not spoil yet.
- A kiln, a potter's wheel, or any other new work station
- A clay oven or a clay chimney
- A shovel or any other new tool
- Filling a jug at the river. Filling a jug from a rain barrel is `.scratch/rain-barrel/issues/02-fill-a-jug-from-a-rain-barrel.md`.
- A journal goal for clay or jugs
