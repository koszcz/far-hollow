# Stone and the fireplace: spec

The player heats a cabin with a campfire built on its foundation. That was a stand-in. This feature adds **stone**, the first material gathered at the river, and the **fireplace**, a stone building piece that heats the **room** it is in.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- The river bank gives the player a material, not only water and fish.
- A finished cabin has a proper fire that outlasts the night.
- The fireplace does everything a campfire does, so the player loses nothing by moving the fire indoors.

## Stone

- **Stone** is a new material. The player carries it in the backpack. One stone weighs 2 kg.
- The player gathers stone on the **river bank**. Clicking river bank ground or the river offers "Gather stone".
- Gathering one stone takes 4 seconds of held work, like other timed work. It needs no tool.
- Stone never runs out.
- If the backpack is too full for one more stone, the action shows greyed with the reason.
- Stone can be dropped. It forms **piles** like other things. It can go in a **chest** or on a **shelf**.
- A sled does not carry stone.

## Building a fireplace

- The build menu lists the fireplace with its cost of 12 stone.
- A fireplace covers one foundation square. Its blueprint snaps to the building grid. R turns it to face any of the four sides. A click places it. Esc cancels.
- It needs a finished foundation under it. The square must hold no campfire and no furniture.
- A fireplace does not need a room. The player can build it before the walls and roof.
- Stone reaches a blueprint the way planks do. The blueprint takes stone from the backpack and from stone piles within 2 m. It keeps what it has been given, so the player can bring the rest on later trips.
- The player holds the build action to build it, as with other structures. Building takes 24 seconds and needs no tool.
- A fireplace and its blueprint block walking.
- Furniture cannot overlap a fireplace.
- The player can take down a fireplace or its blueprint and get back every stone. The fireplace must be out and hold no fuel, no pot, and no fish.
- In the playground, building spends no stone.

## Fire in a fireplace

- The player fuels a fireplace with sticks, bark, and firewood, as with a campfire. Adding fuel is **tending**.
- Each piece of fuel burns twice as long in a fireplace as on a campfire.
- A fireplace holds up to 16 game hours of burning. A campfire holds 8.
- The player lights a fireplace with the steel and flint. It needs fuel.
- A lit fireplace in a room warms the player anywhere in that room.
- A lit fireplace outside a room warms the player within the same range as a campfire.
- Rain never puts out a fireplace under a roof.
- A **panel** shows the fuel left, as it does for a campfire.
- A lit fireplace gives light and shows fire and smoke.

## Cooking and boiling

- The player cooks fish on a lit fireplace as on a campfire. It holds up to 3 fish.
- The player boils water in the pot on a lit fireplace as on a campfire.
- Cooking and boiling times do not change.

## Campfires indoors

- The player can still build a campfire on a foundation. A lit one still warms its room.
- Nothing about the campfire changes.

## Saving

- Stone, stone piles, fireplaces, their blueprints, their fuel, and whether each is lit are saved.
- The pot and the fish on each fireplace are saved, with their progress.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `stone` | How stone looks lying on the ground in a pile, and its backpack icon |
| `gather-stone-animation` | The player crouches at the water's edge and lifts a stone |
| `fireplace` | A stone fireplace with a short chimney, with build stages |
| `fireplace-icon` | The build menu icon for the fireplace, drawn in the same style as `build-icons` |

`pile`, `backpack-icons`, and `build-icons` are approved assets. So the stone pile, the stone icon, and the fireplace icon go in their own draft entries. Merging them needs the owner's approval.

The fire in a fireplace reuses `fire-effect`. The fish and the pot on it reuse `fish-on-fire` and `pot`.

## Tickets

1. Gather stone on the river bank.
2. Build a fireplace from stone. Blocked by 01.
3. Fuel and light a fireplace, and let it heat its room. Blocked by 02.
4. Cook fish and boil water on a fireplace. Blocked by 03.

## Later

- Fuelling a fireplace straight from a woodpile.
- A chimney that passes through the roof.
- Other stonework, such as a stone foundation.

## Not in this feature

- Clay
- Stone on a sled
- Stone that runs out, or better and worse spots on the river
- Changes to the campfire
- Torches, floors, and doors
