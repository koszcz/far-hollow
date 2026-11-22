# Valley life: spec

The valley has trees, a river, and weather, but nothing in it moves on its own. This feature adds **birds** by day and **fireflies** at night, so the valley feels lived in. The player cannot hunt or catch either of them.

## Goals

- Make the valley feel alive by day and by night.
- Cost nothing in the game logic and nothing in the saved game.
- Keep the game at 60 fps on an Apple M1 laptop in Chrome.

## Only for looks

- Birds and fireflies are drawn by the renderer only, like the wind. The game logic never sees them.
- They are not saved. The save version does not change.
- They start in new random places each time the game loads. They do not follow the seed.
- The playground has both.

## Birds

- Birds show only by day. They fade out at dusk and back in at dawn, following daylight.
- There is one kind of bird: a small, generic brown songbird.
- Up to 3 small flocks of 3 to 5 birds fly over the treetops.
- Up to 6 birds peck on the ground in clearings near the player.
- When the player comes within 6 m, a bird on the ground flies off. It lands in another clearing or flies away over the trees.
- Birds never land on foundations, in the river, or within 8 m of a lit fire.
- No birds fly or land while it rains. They come back gradually after the rain stops.

## Fireflies

- Fireflies show only at night. They fade in at dusk and out at dawn, following daylight.
- Up to 40 fireflies glow over clearings and the river bank, only near the player.
- Each one drifts slowly and blinks.
- A firefly is a glowing dot. It does not light the ground.
- No fireflies show while it rains.
- Fireflies ignore the camp and fire.

## Assets

| Asset | What it is |
| --- | --- |
| `birds` | Draft, built in code. A small brown songbird with a wing-flap motion for flying and a peck motion for the ground |
| `fireflies` | Draft, built in code. Small glowing dots that drift and blink |

Neither reuses a catalogue entry. Nothing comes from third-party packs. Decided with the owner on 2026-11-22.

## Tickets

1. Birds fly over the trees and land in clearings.
2. Fireflies glow at night.

Neither ticket blocks the other.

## Not in this feature

- Sound, such as birdsong or crickets. That belongs to `.scratch/sound/`.
- Wind sway. That is `.scratch/forest-floor/issues/05-wind-sway.md`.
- Any other animal, such as butterflies, jumping fish, or deer. Deer belong to `.scratch/hunting/`.
- Catching or hunting birds or fireflies.
- Saving birds or fireflies.
