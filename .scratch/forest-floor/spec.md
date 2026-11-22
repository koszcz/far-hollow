# Forest floor: spec

The valley's ground is one grass-and-dirt tile repeated everywhere. The ground looks the same under the trees, in the open, and at the river. Nothing grows out of it. This feature makes the ground look alive. The ground changes by place, and **undergrowth** grows on it.

Terms in **bold** are defined in `GLOSSARY.md`. The `game design spec` in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Ground types

- The valley has three ground types: **forest floor**, **clearing**, and **river bank**.
- Forest floor lies within a few metres of trees. It is brown needle and leaf litter, darker than a clearing.
- A clearing is open ground away from trees. It is brighter grass.
- A river bank is the sloped strip beside the river's water. It is mud and pebbles.
- Each ground type blends softly into the next. No hard edges.
- When the valley is made, ground types come from where trees stand and where the river runs.
- After that, the ground follows the trees that stand for good:
  - Where no tree, stump, or sapling is left, forest floor slowly turns into clearing. This happens where the player digs up a sapling.
  - A stump that is growing back still counts as a tree. Felling a tree alone does not change the ground.
  - Around a planted tree that has become a full tree, clearing slowly turns into forest floor. Saplings and young trees do not change the ground.
  - Each change takes 3 game days.
- The river bank never changes.

## Undergrowth

- Undergrowth is grass, ferns, flowers, and pebbles.
- The player cannot pick up undergrowth. It does not block walking or pathfinding. It is not saved, and the game logic never sees it.
- The same seed always grows the same undergrowth in the same spots.
- What grows depends on the ground type:

| Ground type | Undergrowth |
| --- | --- |
| Forest floor | Ferns, small rocks, sparse grass |
| Clearing | Grass tufts, flowers, rare stones |
| River bank | Tall grass, flat pebbles |

- Undergrowth draws only within about 80 m of where the camera looks. It fades out at that edge, so it never pops in.
- Undergrowth hides under anything the player places: campfires, bedrolls, building pieces, and blueprints.
- When the ground type changes, the undergrowth changes with it. Ferns thin out as grass and flowers move in, or the reverse.

## Wind

- **Wind** sways grass, ferns, flowers, saplings, young trees, and treetops. Tree trunks, pebbles, stumps, sticks, and berry bushes stay still.
- The wind is a gentle breeze with slow gusts. It blows harder in the rain. It does not follow the time of day.
- The wind blows the same way across the whole valley. Its direction drifts slowly over game hours. The same seed always gives the same wind.
- Wind is only for looks. It is not saved. It does not affect the player, the camp, or the campfire's smoke.

## Assets

All new assets go in as drafts. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is | Source |
| --- | --- | --- |
| `terrain` | The reworked ground with three ground types. Goes back to draft. | Built in code |
| `grass` | Grass tufts and tall grass | Kenney Nature Kit: `grass`, `grass_large`, `grass_leafs`, `grass_leafsLarge` |
| `ferns` | Ferns | Kenney Nature Kit: `plant_flatShort`, `plant_flatTall` |
| `flowers` | Purple, red, and yellow flowers | Kenney Nature Kit: `flower_purpleA`–`C`, `flower_redA`–`C`, `flower_yellowA`–`C` |
| `pebbles` | Small rocks and stones | Kenney Nature Kit: `rock_small*`, `stone_small*`, `stone_smallFlat*` |

The owner approved copying these Kenney files into `public/assets/<id>/` as drafts on 2026-11-11.

The owner approved adding sway to the approved `trees` asset in chat on 2026-11-22.

## Not part of this feature

- Birds, fireflies, and other animals. See `.scratch/valley-life/issues/01-birds-and-fireflies.md`.
- Berry bushes swaying in the wind.
