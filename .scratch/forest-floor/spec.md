# Forest floor: spec

The valley's ground is one grass-and-dirt tile repeated everywhere. The ground looks the same under the trees, in the open, and at the river. Nothing grows out of it. This feature makes the ground look alive. The ground changes by place, and **undergrowth** grows on it.

Terms in **bold** are defined in `GLOSSARY.md`. The `game design spec` in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Ground types

- The valley has three ground types: **forest floor**, **clearing**, and **river bank**.
- Forest floor lies within a few metres of trees. It is brown needle and leaf litter, darker than a clearing.
- A clearing is open ground away from trees. It is brighter grass.
- A river bank is the sloped strip beside the river's water. It is mud and pebbles.
- Each ground type blends softly into the next. No hard edges.
- Ground types are fixed when the valley is made. They come from where trees stand at the start and where the river runs. Felling trees does not change them.

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

## Later

These ideas are in the backlog. They are not part of this feature.

- Felled ground slowly turns into a clearing. See ticket 04.
- Undergrowth and trees sway in the wind. See ticket 05.
