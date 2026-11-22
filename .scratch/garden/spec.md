# Garden: spec

Today all food grows wild, often far from camp. This feature lets the player grow food close to home. The player digs up a wild **berry bush** and **plants** it near camp. The player also plants a mushroom on a **log** to make a **mushroom log**. Both bear food on the same cycle as their wild versions.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies. This feature builds on planting saplings in `.scratch/regrowth/spec.md`.

"Garden" is only the name of this feature. The game has no garden area, plot, or boundary.

## Goals

- The player can grow enough food near camp to stop foraging far away, once they have put in the work.
- The early game still needs foraging and fishing, because nothing planted bears food for 2 days.

## Food balance

- A planted berry bush gives the same food as a wild one: 3 berries, then 3 days to grow back.
- A mushroom log gives the same food as a wild mushroom patch: 2 mushrooms, then 3 days to grow back.
- Hunger drains 0.5 a day, so about 5 bushes or mushroom logs feed the player for good. Digging, carrying, and planting them is the cost.
- Nothing needs watering. Rain has no effect.

## Berry bushes

### Digging up a berry bush

- The player can dig up any berry bush, wild or planted, with no tool. It takes a few seconds.
- "Dig up" sits in the bush's action menu. Foraging stays the main action while the bush has berries.
- If the bush has berries, digging it up also puts them in the backpack.
- A dug-up bush is gone from its spot for good.
- A berry bush goes in the backpack. It weighs 1 kg. Berry bushes stack.
- If the backpack has no room, the game refuses and says why (ADR 0008).

### Planting a berry bush

- The player plants a berry bush from its hotbar cell, as with a sapling. A see-through bush shows where it will go. Planting takes a few seconds.
- A berry bush can be planted only:
  - on forest floor or a clearing, not on the river bank or in the river
  - at least 1 m from any tree, stump, sapling, or other berry bush
  - at least 1 m from any structure, blueprint, foundation square, or mushroom log
- If the spot is not allowed, the see-through bush turns red and the game says why.
- A planted bush has no berries at first. It bears its first berries 2 days after planting.
- After that, it works exactly like a wild bush.
- A berry bush does not block walking.

## Mushroom logs

### Planting a mushroom on a log

- "Plant mushroom" sits in the action menu of a log lying loose on the ground, when the backpack holds a mushroom. The log's main action does not change.
- Only a plain log works. A debarked log does not. Neither does a log on a sled, on a woodpile, or on the player's shoulder.
- Planting uses 1 mushroom and takes a few seconds. It needs no tool and no shade.
- The log becomes a mushroom log where it lies.

### How a mushroom log works

- A mushroom log bears its first mushrooms 2 days after planting.
- The player forages it like a mushroom patch. It grows mushrooms back 3 days after each forage.
- A mushroom log stays where it lies. It never rots. The player cannot pick it up, put it on a sled or a woodpile, or build with it.
- The player can take down a mushroom log. It vanishes and gives nothing back, not even the log.
- A mushroom log does not block walking, like a loose log.

## Building near garden things

- The game refuses a blueprint or foundation that would cover a berry bush or mushroom log, and says why (ADR 0008).

## Saving

- Planted berry bushes, mushroom logs, and the time left until each bears food are saved.
- Berry bushes in the backpack are saved like other backpack contents.
- A dug-up wild bush stays gone after loading.
- The save version goes up. Older saves are upgraded when loaded (ADR 0011).

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `berry-bush-icon` | The hotbar and backpack icon for a berry bush |
| `mushroom-log` | The log model with the mushrooms model on top. It shows bare while mushrooms grow back |

Reuse `berry-bush` for planted bushes and the see-through preview. Reuse `mushrooms` and the log model for the mushroom log.

## Not in this feature

- Seeds, or new bushes spreading on their own
- Digging up a wild mushroom patch
- Watering, seasons, or anything that speeds up or stops growth
- Mushroom logs rotting, or moving a mushroom log
- Garden plots, beds, or fences
- A journal goal for planting
