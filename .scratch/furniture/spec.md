# Furniture: spec

The player can build a cabin and cut planks, but the cabin stands empty and planks have no use. This feature adds the first set of **furniture**: a **bed**, a **shelf**, a **table**, and a **stool**. Each piece is built from planks and does one useful thing. The **chest** also changes to be built from planks.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- Planks have a use.
- The player has a reason to furnish the cabin.
- Each piece of furniture helps with one need or with storage.

## Building furniture

Every piece of furniture follows the rules the chest already uses:

- The build menu lists each piece with its cost.
- The blueprint is placed freely. It does not snap to the building grid. R rotates it. A click places it. Esc cancels.
- A piece can stand anywhere: on open ground, on a foundation, indoors, or outdoors.
- A blueprint cannot overlap a standing tree, a structure, or other furniture. Furniture never stacks on other furniture.
- Planks come straight from the backpack, as bark does for a roof. The player does not carry planks over one at a time.
- The player holds the build action to build the piece, as with other structures. See ADR 0002.
- Building furniture needs no tool.
- Every piece blocks walking. The player walks around it.
- The player can take down a piece and get back every plank. To move a piece, the player takes it down and builds it again.
- In the playground, building spends no planks.

## Costs

| Piece | Cost | Fits one backpack trip |
| --- | --- | --- |
| Bed | 8 planks | Yes |
| Table | 6 planks | Yes |
| Chest | 4 planks | Yes |
| Shelf | 4 planks | Yes |
| Stool | 2 planks | Yes |

The backpack holds 20 kg, and a plank weighs 2 kg, so the player can carry 10 planks at once.

## Chest

- A new chest costs 4 planks instead of 2 debarked logs.
- Chests in older saves stay as they are. Taking one down returns the debarked logs it was built from.
- The chest model does not change. Only the cost changes.
- Nothing else about the chest changes, including the tool it needs.

## Bed

- The player sleeps in a bed the same way as on a laid bedroll.
- A bed restores fatigue twice as fast as a bedroll.
- The roof bonus still applies. A bed under a roof restores fatigue three times as fast as a bedroll in the open.
- Sleeping in a bed makes it the **respawn point**. The respawn point is whichever bed or bedroll the player slept in last.
- The respawn point is a place on the ground, as it is for the bedroll. If the player takes down the bed, the respawn point stays where the bed stood.
- The bedroll stays in the game. The player still starts with one.
- The bed reuses `sleep-animation`.

## Shelf

- A shelf stores small materials, tools, and food, like a chest.
- A shelf holds up to 30 kg. A chest holds 60 kg.
- The player opens a shelf the same way as a chest. It uses the same panel.
- A shelf stands on the ground. It does not hang on a wall.
- The shelf model does not show what the shelf holds.
- The player cannot take down a shelf that still holds anything, as with a chest.

## Table

- Food the player eats within reach of a finished table restores 25% more hunger.
- There is no new action. The player eats as usual.
- A table blueprint gives no bonus.

## Stool

- A stool has a "Sit" action. It is the stool's **main action**.
- While the player sits, fatigue comes back at a quarter of the rate it does while asleep in the open.
- Time runs at normal speed while the player sits.
- The player stands up as soon as they walk or act.
- Sitting does not count as sleeping. It does not change the respawn point.

## Saving

- Beds, shelves, tables, stools, their blueprints, and what each shelf holds are saved.
- Plank chests are saved. Older chests keep the debarked logs they were built from.
- The save version goes up. Older saves are upgraded when loaded.
- Sitting is not saved. A loaded game starts with the player standing.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `bed` | A plank bed frame with a simple mattress, with build stages |
| `shelf` | A standing plank shelf, with build stages |
| `table` | A plank table, with build stages |
| `stool` | A small plank stool, with build stages |
| `sit-animation` | The player sits down on a stool, rests, and stands up |
| `furniture-icons` | Build menu icons for the bed, shelf, table, and stool, drawn in the same style as `build-icons` |

`build-icons` is an approved asset, so the new icons go in the separate draft `furniture-icons`. Merging them into `build-icons` needs the owner's approval.

The chest keeps its approved `chest` model.

## Tickets

Each ticket stands alone. They can be done in any order.

1. The chest costs planks.
2. Bed.
3. Shelf.
4. Table.
5. Stool and the sitting animation.

## Later

- Decorations: furniture that only makes the cabin look lived in.
- Furniture placed on top of other furniture.
- Picking up a piece and carrying it, instead of taking it down.
- A shelf that shows what it holds.
- A shelf that hangs on a wall.

## Not in this feature

- The fireplace, torches, and doors
- Floors
- A plank lean-to or any other plank building piece
