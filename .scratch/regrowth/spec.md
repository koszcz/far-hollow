# Regrowth: spec

Felled trees never come back. A grove the player cuts for a cabin stays a field of stumps for the rest of the game. This feature lets the forest heal. A **stump** slowly grows back into a tree. The player can also dig up a **sapling** and plant it somewhere else, such as near camp.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- A cut grove visibly heals over a few game days.
- The player can grow trees where they want them, so later logs can come from near camp.
- The player can clear a spot for good by digging up the sapling on a stump.

## How a tree grows back

A growing tree passes through these stages:

| Stage | How it looks | How long it lasts |
| --- | --- | --- |
| Stump | The stump, as now | 1 game day after the tree is felled |
| Sapling | A small sapling growing from the stump, or from the ground if planted | 2 game days |
| Young tree | A thin tree about half the full height | 3 game days |
| Tree | A full tree, as before it was felled | Until chopped again |

- A stump becomes a full tree 6 game days after it was felled. A planted sapling becomes a full tree 5 game days after it was planted.
- Time counts while the player sleeps, like any other game time.
- A regrown tree is the same kind and size as a tree would be at that spot. It gives the same number of logs.
- The stump disappears when the sapling becomes a young tree.

## What the player can do at each stage

| Stage | Chop | Dig up the sapling | Blocks walking |
| --- | --- | --- | --- |
| Stump | No | No | Yes |
| Sapling on a stump | No | Yes | Yes |
| Planted sapling | No | Yes | No |
| Young tree | No. The game says the tree is too young to chop. | No | Yes |
| Tree | Yes | No | Yes |

- The game says why it refuses, as in ADR 0008.
- If the player stands where a planted sapling would become a young tree, the sapling waits until they step away.

## Saplings

- The player digs up a sapling with E, the main action, on a sapling. No tool is needed. It takes a few seconds.
- Digging up the sapling on a stump removes the stump too. The ground is then bare and free to walk on and build on.
- A sapling goes in the backpack. It weighs 1 kg. Saplings stack.
- The player plants a sapling from its hotbar cell. A see-through sapling shows where it will go, as when placing a blueprint. Planting takes a few seconds.
- A sapling can be planted only:
  - on forest floor or clearing, not on the river bank or in the river
  - at least 3 metres from any tree, stump, or other sapling, the same spacing the valley uses for trees
  - away from any structure, blueprint, or foundation square
- If the spot is not allowed, the see-through sapling turns red and the game says why.

## Saving

- Each growing tree's stage and the time left until its next stage are saved.
- Saplings in the backpack are saved like other backpack things.
- The save version goes up. Older saves are upgraded when loaded. A stump in an older save starts growing as if it had just been felled.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `saplings` | A small sapling, and a young tree about half the full height, for each tree kind in `trees` |
| `sapling-icon` | The hotbar and backpack icon for a sapling |

Reuse `trees` for full-grown trees and `stumps` for stumps.

## Not in this feature

- Felled ground turning into a clearing. That is `.scratch/forest-floor/issues/04-felled-ground-becomes-clearing.md`.
- Pine cones or seeds
- New saplings appearing on their own in the forest
- Watering, seasons, or anything that speeds up or stops growth
- Digging up a bare stump without a sapling
- A journal goal for planting
