# Storage: spec

The player carries everything they own in the backpack or on their shoulder. Nothing they gather can be left anywhere on purpose. This feature lets the player **drop** anything they carry, keep the camp organised in **chests**, and stack wood on a **woodpile**.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets. Storage comes right after Shelter. See `.scratch/shelter/spec.md`.

## Goals

- The player can put down anything they carry and find it again later.
- The player can keep small things in chests at camp instead of carrying them all.
- The player can stack logs and firewood in one place instead of leaving them scattered.

## Dropping

- The player can drop anything in the backpack: tools, sticks, firewood, bark, food, the pot, and the bedroll.
- The player can still drop the log or debarked log on their shoulder, as before.
- Dropping a kind drops all of that kind at once, at the player's feet, as one **pile**. For example, "7 sticks".
- Things dropped within 1 m of a pile of the same kind join that pile.
- Dropped sticks become normal sticks on the ground, the same as the sticks the player finds on the forest floor.
- Logs and debarked logs never form piles. Each one lies on the ground on its own, as now.
- A pot keeps what it holds when dropped. A pot of boiled water stays a pot of boiled water.
- A dropped bedroll lies rolled up. The player cannot sleep in it. To sleep, the player lays the bedroll instead, as now.
- Dropped things stay where they lie until the player picks them up. They do not disappear, rot, or wash away.
- Rain has no effect on dropped things.

## Picking up piles

- The player clicks a pile to walk to it and pick it up.
- The player takes as many as fit in the backpack. The rest stay in the pile.

## Chest

- The chest is the first piece of **furniture**. It is placed freely and does not snap to the building grid. R rotates it.
- The player builds it from the build menu. It costs 2 debarked logs and needs the axe.
- Building a chest works like building any other structure. The player places a blueprint, delivers the debarked logs, and holds the build action. See ADR 0002.
- A chest holds small materials, tools, and food, up to 60 kg. Logs and debarked logs do not go in a chest.
- A chest groups what it holds by kind, like the backpack. It has no slots.

### Using a chest

1. The player clicks a chest to walk to it and open it.
2. A chest panel opens beside the backpack. It shows the chest's contents as a grid of icons, like the backpack.
3. Clicking an icon moves one of that kind between the backpack and the chest.
4. Shift-clicking an icon moves all of that kind, or as many as fit.
5. The panel closes when the player walks away.

## Woodpile

- The woodpile is a structure in the build menu. It snaps to the building grid, like a campfire.
- It costs nothing and takes a short construction.
- It holds up to 20 logs, debarked logs, and pieces of firewood, in any mix.
- The player puts a log or debarked log on the woodpile from their shoulder, one at a time.
- The player puts firewood on the woodpile from the backpack. Clicking moves one. Shift-clicking moves all that fit.
- Taking a log or debarked log off the woodpile puts it on the player's shoulder.
- Taking firewood off the woodpile puts as much as fits in the backpack.
- The player cannot fuel a campfire straight from the woodpile. Firewood goes through the backpack first.
- Rain has no effect on the woodpile.

## Taking down

- The player can take down a chest or woodpile and get back every material in it, as with other structures.
- The player cannot take down a chest or woodpile that still holds anything. They empty it first.

## Saving

- Piles, chests, woodpiles, and what each one holds are saved.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `pile` | How each kind of dropped thing looks on the ground, from one to many |
| `rolled-bedroll` | The bedroll lying rolled up on the ground |
| `chest` | A rough box hewn from debarked logs, with build stages |
| `woodpile` | Logs and firewood stacked on the ground, from empty to full |

Reuse existing catalogue entries for the HUD icons in the chest panel.

## Not in this feature

- Shelves and other furniture
- Chests made from planks
- Wet firewood, and rain spoiling stored things
- Food that rots
- Fuelling a campfire straight from a woodpile
- Choosing which kinds go in which chest
