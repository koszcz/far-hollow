# Player motions: spec

Several things the player does show no motion of their own. Dragging a sled uses the plain walk. Sawing planks uses the axe chop. Picking up, dropping, foraging, eating, drinking, filling the pot, and sleeping happen with no motion at all. This feature gives each one a short motion, so the player can see what their character is doing.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- Every player action that takes time, or changes what the player holds, shows a motion that fits it.
- Motions never change game rules. Game logic stays as it is. Only drawing changes, unless a ticket says otherwise.

## How the motions work

- Motions are posed in code, like `debarking-animation` and `player-build-animation`. They may start from a KayKit clip in the player model.
- A motion for an instant action, such as picking up a stick, plays once after the action happens. It takes no game time. The player can walk or act again while it plays. A new motion, or walking, cuts it short.
- The renderer learns that an instant action happened from game logic, the same way the HUD learns it. If game logic does not report it yet, the ticket adds a report, with no change to rules.
- The asset showcase shows each new motion, as it shows the others.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `sled-drag-animation` | The player leaning forward, pulling a sled by a short rope over the shoulder |
| `sled-rope` | The short rope from the player's hand to the front of a dragged sled |
| `saw-animation` | The player sawing a debarked log at the sawhorse |
| `hand-craft-animation` | The player working with both hands at waist height, for a hand recipe |
| `pick-up-animation` | The player bending down to pick something up or put it down |
| `forage-eat-drink-animation` | The player picking from a bush or patch, eating, drinking from the river, filling the pot, and drinking from the pot |
| `sleep-animation` | The player lying down on the bedroll, sleeping, and getting up |

## Not in this feature

- A motion for taking down a structure
- New sounds for any motion
- Changes to how long any action takes
