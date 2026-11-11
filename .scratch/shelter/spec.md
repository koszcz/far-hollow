# Shelter: spec

The player can survive a night by a campfire, but they have nowhere to live. This feature gives them a roof. They start with a quick **lean-to**, then build the first walls and roof of a log cabin.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- The player can keep dry in the rain and sleep better under a roof.
- The player can build a small cabin they can walk into, and heat it with a campfire.
- Building feels calm. Mistakes cost nothing.

## Debarking

- A new game's starting kit gains a drawknife. Older saves get one when they load.
- The player debarks a **log** that lies on the ground. They right-click it and choose "Debark".
- Debarking takes a few seconds, like chopping.
- It turns the log into one **debarked log** and adds **bark** to the backpack.
- To debark a log they carry, the player drops it first.
- The player carries debarked logs on their shoulder, one at a time, like logs.
- Bark is **fuel**. It burns in a campfire like sticks.

## Build menu

- The player presses B to open the build menu. It lists every structure they can build, with its cost.
- When the player picks one, its **blueprint** follows the mouse.
- R rotates the blueprint by 90°. A click places it. Esc cancels.
- The build menu replaces the HUD button that places a campfire.
- Building works as before: the player holds the build action on a blueprint. See ADR 0002.

## Lean-to

- A lean-to is one structure, not a set of **building pieces**. It is a sloped roof of sticks and bark on a frame, open at the front.
- It costs sticks and bark from the backpack.
- It gives a roof overhead. It is not a **room**.

## Cabin pieces

| Building piece | Cost | Rule |
| --- | --- | --- |
| Foundation | Debarked logs | Grows legs down to sloped ground. |
| Log wall | Debarked logs | Stands on the edge of a foundation. |
| Door frame | Debarked logs | Stands on the edge of a foundation. The player walks through it. |
| Roof | Debarked logs and bark | Needs walls or door frames under it. |

- Pieces snap to the building grid. A foundation covers one grid square.
- Log walls block walking. Door frames do not.
- The player delivers debarked logs to a blueprint. They carry one to it and click the blueprint to add it. Bark comes from the backpack.
- Construction spends delivered materials stage by stage, as the spec already says.
- A blueprint cannot overlap a standing tree. The player fells it first.
- Placing a foundation removes any **stump** under it for good.
- When the player is inside, the roof above them hides. Walls between the camera and the player fade out.

## What shelter does

- **Roof overhead**: rain does not drain the player's warmth. A lean-to roof and a cabin roof both count.
- **Sleeping under a roof**: fatigue comes back faster than in the open.
- **Rooms**: a room is a set of foundation squares closed in on every side by log walls or door frames, with a roof over every square. A door frame counts as closed.
- A lit campfire inside a room warms the player anywhere in that room.
- The player can place a campfire inside a room.

## Taking down

- The player can take down any blueprint or finished piece, including a lean-to.
- They get back every material spent or delivered.
- A piece cannot be taken down while another piece stands on it. For example, a wall under a roof stays until the roof is gone.

## Saving

- Debarked logs, bark, blueprints, delivered materials, and finished pieces are saved.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `debarked-log` | A pale log with no bark |
| `bark` | Curled strips of bark, shown on the ground and in the HUD |
| `lean-to` | The lean-to, with build stages |
| `foundation` | The foundation, with legs and build stages |
| `log-wall` | The log wall, with build stages |
| `door-frame` | The door frame, with build stages |
| `roof` | The roof section, with build stages |

## Not in this feature

- Floors, windows, stairs, and a second storey
- Planks, the sawhorse, stone, and clay
- Doors that open and close
- Fireplaces and furniture
