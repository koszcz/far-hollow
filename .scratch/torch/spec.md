# Torch: spec

Night in the valley is dark, and the only light is a fire the player cannot move. This feature adds the **torch**: a light the player carries, or plants in the ground to light a spot.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- The player can see to work and walk at night, away from a fire.
- The player can light a spot in the camp, such as the path to the woodpile.
- Bark has one more use.

## Making a torch

- The torch is a **hand recipe**: 1 stick and 1 bark. It needs no tool.
- A torch weighs 0.8 kg. The player carries unlit torches in the backpack.
- Unlit torches can be dropped, form **piles**, and can go in a **chest** or on a **shelf**.

## Carrying a lit torch

- "Light" is the **main action** of a torch in the backpack. It needs the steel and flint.
- Lighting takes one torch out of the backpack and puts it in the player's hand, lit.
- A lit torch lights the ground within about 6 m of the player.
- A lit torch burns for 3 game hours. Then it is gone.
- The player holds one lit torch at a time.
- The hotbar shows the lit torch with a gauge of how much burning is left.
- The player keeps the lit torch while they walk, work, carry a log on the shoulder, and drag a sled.
- "Put out" throws the torch away. A torch cannot be lit twice.
- The player puts out the torch before they sleep.
- A torch gives no warmth.
- Rain does not put out a torch.

## Planting a torch

- "Plant" stands the lit torch in the ground at the player's feet. It also works on a foundation.
- A planted torch keeps burning for the time it had left, and lights the ground around it.
- The player cannot plant a torch within 1 m of another planted torch.
- "Pick up" is the main action of a planted torch. It puts the torch back in the player's hand, if the hand holds no torch.
- A planted torch does not block walking.
- When a planted torch burns out, it is gone.

## Light and frame rate

- At most 4 torches cast real light at once: the one in the player's hand, then the planted torches nearest the camera.
- Every other planted torch still shows its flame and a glow, but does not light the ground.
- Torches cast no shadows.

## Saving

- Unlit torches, the lit torch in the player's hand, planted torches, and the burning time each has left are saved.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `torch` | The torch in the player's hand, planted in the ground, and lying in a pile, lit and unlit |
| `torch-icons` | The backpack icon and the craft menu icon for the torch |

The flame reuses `fire-effect` at a small size. `backpack-icons` and `crafting-icons` are approved assets, so the torch icons go in their own draft entry.

## Tickets

1. Craft a torch, light it, and carry it.
2. Plant a lit torch and pick it up again. Blocked by 01.

## Later

- A torch mounted on a log wall.
- Lighting a torch from a fire instead of the steel and flint.
- Lighting a campfire or fireplace with a torch.

## Not in this feature

- Lanterns, candles, and oil
- Torches that scare animals
- Darkness that slows the player or stops work
