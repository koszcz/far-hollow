# Crafting: spec

The player can build a cabin, but they cannot make anything new to carry. Many later ideas, such as the sled, the bow, and furniture, wait on a way to turn materials into new things. This feature adds **crafting**. It proves the system with one thin chain: the player makes a **saw**, builds a **sawhorse**, and cuts **planks**.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- The player can make new things from materials, through one menu.
- Later features can add a recipe without changing how crafting works.
- The player can make planks, ready for floors and furniture later.

## Crafting and construction

- Crafting makes something that goes into the **backpack**.
- **Construction** makes something that stands in the world, through the **build menu**. Work stations and furniture come from construction.

## How crafting works

- Every **recipe** is a **hand recipe** or a **station recipe**.
- A recipe is available as soon as the player has the tool or **work station** it needs. A tool counts when it is in the backpack.
- Crafting is timed work, like chopping. It drains fatigue like other timed work.
- The materials leave the backpack only when the work finishes.
- If the player stops partway, they lose nothing. The work starts again from the beginning next time.
- The player crafts one thing per click. There is no queue.
- The player cannot craft while carrying a log on their shoulder. The menu says to put the log down first.
- If the result would not fit in the backpack, crafting does not start. The weight of the materials it uses up counts as freed first. A short message says why.

## Craft menu

- The player presses C to open and close the **craft menu**.
- It lists every recipe in the game, with its materials and its time.
- A recipe the player cannot follow yet shows the tool or work station it is missing.
- Choosing a hand recipe starts crafting where the player stands.
- Choosing a station recipe walks the player to the nearest finished station of the right kind, then starts crafting.

## Station recipes

- The player can also right-click a work station and choose one of its recipes. The player walks to it first.
- Only a finished station counts. A blueprint does not.
- Besides the backpack, a station recipe can use logs or debarked logs that lie within 2 m of the station. The player carries them there and drops them.

## The saw

- A new game's starting kit gains a **saw blade**. Older saves gain one when they load, unless they already hold a saw.
- The saw blade is a material. It weighs 0.5 kg.
- The saw is a hand recipe: one saw blade and three sticks, five seconds.
- The saw is a **tool**. It weighs 1 kg and never wears out.

## Sawhorse and planks

- The sawhorse is a new entry in the build menu. It costs two debarked logs. No tool is needed.
- The sawhorse is a work station. It is not a building piece, so it does not need a foundation.
- The player can take down a sawhorse and get back every material, like other structures.
- Cutting planks is a station recipe at the sawhorse. It needs the saw in the backpack.
- One debarked log next to the sawhorse becomes four planks. It takes eight seconds.
- Planks go in the backpack. Each weighs 2 kg.

## Saving

- The saw blade, the saw, planks, and sawhorses are saved.
- The save version goes up. Older saves are upgraded when loaded.
- Crafting in progress is not saved.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `crafting-icons` | Backpack icons for the saw blade, the saw, and planks, drawn in the same style as `backpack-icons` |
| `sawhorse` | The sawhorse, with build stages |

Crafting reuses `chop-animation` for the player's timed work. Planks stay in the backpack, so they need no model yet.

`backpack-icons` is an approved asset, so new icons go in the separate draft `crafting-icons`. Merging them into `backpack-icons` needs the owner's approval.

## Not in this feature

- Floors, stone, and clay
- The sled, the bow, the fishing rod, the snare, and the torch
- Furniture
- A crafting queue or crafting several at once
