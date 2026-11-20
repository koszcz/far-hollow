# Floors and doors: spec

A cabin has bare foundations underfoot and open door frames. This feature adds the **floor** and the **door**, the last two pieces of a finished cabin. A room with both keeps the cold out better.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- Planks have a use in the building itself, not only in furniture.
- The player has a reason to finish a cabin after the roof is on.
- A finished cabin looks finished.

## Floor

- A floor is a **building piece** that covers one foundation square. It costs 2 planks.
- The blueprint snaps to a finished foundation square. A click places it. Esc cancels.
- The player can hold Shift and drag across squares to place several blueprints. A plain drag still pans the camera.
- A square holds one floor.
- A floor can go under furniture or a campfire that already stands on the square. Nothing has to move.
- Once fireplaces exist, a floor can also go under a fireplace, and a fireplace can stand on a floor.
- Planks reach the blueprint the way they reach furniture: from the backpack, a parked sled next to it, and plank piles within 2 m, over several trips.
- The player holds the build action to build it. Building takes 4 seconds and needs no tool.
- The player walks on a floor as on a bare foundation.
- The player can take down a floor and get back both planks, whatever stands on it.
- The player cannot take down a foundation that has a floor.

## Door

- A door hangs in a finished door frame. It costs 3 planks.
- The blueprint snaps to a door frame that has no door. A click places it. Esc cancels.
- Planks reach the blueprint the way they reach furniture.
- The player holds the build action to build it. Building takes 6 seconds and needs no tool.
- A door opens by itself when the player walks through, and closes behind them. The player never has to click it.
- A door does not change where the player can walk.
- The player can take down a door and get back its planks.
- The player cannot take down a door frame that has a door.

## Snug rooms

- A **room** is **snug** when every square has a floor and every door frame has a door.
- In a snug room, the player's warmth drains at half the usual rate at night.
- A lit fire in the room still warms the player as before.
- Whether a room is snug is worked out from its pieces, as rooms are. It is not saved.
- The debug overlay shows which rooms are snug.
- The first time the player stands in a snug room, a banner says the room now keeps out the cold. Whether the banner has shown is saved, so it shows once in each game.

## Saving

- Floors, doors, their blueprints, and whether the snug-room banner has shown are saved.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `floor` | Planks laid across one foundation square, with build stages |
| `door` | A plank door in a door frame, with build stages, shut and open |
| `door-animation` | The door swings open and shut |
| `floor-and-door-icons` | Build menu icons for the floor and the door, drawn in the same style as `build-icons` |

`foundation`, `door-frame`, and `build-icons` are approved assets. So the floor, the door, and their icons go in their own draft entries.

## Tickets

1. Lay a floor on a foundation.
2. Hang a door in a door frame.
3. Snug rooms keep out the cold. Blocked by 01 and 02.

## Later

- Windows.
- A second storey and stairs.
- Doors the player bars or leaves open.

## Not in this feature

- Animals that enter a cabin
- A floor on bare ground
- Changes to what makes a room
