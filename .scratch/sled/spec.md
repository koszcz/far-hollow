# Sled: spec

The player carries logs on their shoulder, one at a time. Moving the logs from a felled tree back to camp takes many slow trips. This feature adds the **sled**: a cheap object the player builds and **drags** to move up to 6 logs at once.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets. The sled builds on Storage. See `.scratch/storage/spec.md`.

## Goals

- The player can move a felled tree's logs to camp in one or two trips instead of six or more.
- The shoulder stays useful for a single log, because dragging is slower than walking.
- The player can work at a sawhorse or fill a woodpile straight from the sled.

## Building a sled

- The sled is a structure in the build menu. It is placed freely and does not snap to the building grid, like a chest. R rotates it.
- It costs 2 logs and 4 sticks and needs the axe.
- Building it works like building any other structure. The player places a blueprint, delivers the materials, and holds the build action. See ADR 0002.
- The player can build as many sleds as they like.

## What a sled holds

- A sled holds up to 6 logs and debarked logs, in any mix.
- Nothing else goes on a sled: no firewood, sticks, or backpack things.
- The logs on a sled show on it, from empty to full.

## Loading and unloading

The player uses E, the main action, on the nearest sled. Other actions are in the sled's action list.

| The player… | E does | Also in the action list |
| --- | --- | --- |
| has a log on their shoulder, and the sled has room | Puts the log on the sled | Drag the sled |
| has nothing on their shoulder | Drags the sled | Take one log onto the shoulder; tip out every log |
| is dragging the sled | Lets go of the sled | None |

- Taking one log puts one log or debarked log on the player's shoulder. When the sled holds both kinds, the action list offers each kind, as the woodpile does.
- Tipping out lays every log on the ground beside the sled. Logs never form piles, so each lies on its own, as now.
- Tipping out next to a woodpile puts the logs on the woodpile instead. Logs that do not fit are laid on the ground beside the sled.

## Dragging

- The player drags one sled at a time. The sled follows behind them.
- While dragging, the player walks at 70% of their normal speed. This slowdown stacks with the slowdown from neglected needs.
- While dragging, the player's hands are busy. They cannot shoulder a log, gather, chop, build, or craft. They let go first.
- The sled goes anywhere the player can walk. Slopes and the river have no extra rules.
- If the player collapses while dragging, they let go. The sled stays where they fell, with its load.
- The hotbar shows a sled cell while the player drags, such as "Sled 4/6". It sits where the shoulder cell goes.

## Work stations

- A station recipe can use logs and debarked logs on a sled parked next to the station, the same as logs lying next to it.

## Taking down

- The player can take down a parked sled and get back its 2 logs and 4 sticks, as with other structures.
- Any logs on the sled are laid on the ground beside it first.

## Saving

- Sleds, where they stand, which way they face, and what each one holds are saved.
- Whether the player is dragging a sled is saved.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `sled` | A low sled of two log runners and cross pieces, with build stages, and with 0 to 6 logs or debarked logs lying on it |
| `sled-icon` | The hotbar icon for the sled cell |

Reuse the `logs` and `debarked-log` entries for the logs on the sled.

## Not in this feature

- Blueprints taking logs straight from a parked sled
- Carts, wheels, and axles
- Sleds that carry firewood, stone, or backpack things
- Terrain that slows or blocks a sled, such as steep slopes or the river
- A journal goal for the sled
