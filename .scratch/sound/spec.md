# Sound: spec

The valley is silent today. This feature gives it **ambience**, such as the river, the forest, fires, rain, birds, and crickets. It also adds **action sounds** for the player's work and footsteps. The game has no music.

## Goals

- Make the valley feel alive and tell the player what is near without looking.
- Keep sound cheap: under 0.5 ms per frame, at most 16 sounds at once, and no added download while every sound is a draft.
- Keep sound out of the game logic.

## How sound works

- Sound only reflects what the game already shows. No sound is the only sign of anything, and sound never changes play.
- Sound is a render-side layer that reads sim state, like the meshes do (ADR 0001). The sim gains no sound code.
- Every sound starts as a draft asset made in code with the browser's sound synthesis (ADR 0006). The owner can later swap in an approved recording with the `make-asset` skill.
- Browsers block sound until the player clicks something. Sound starts on the first click, such as the Continue button on the start screen.

## Hearing from the player

- The game hears from the player's spot, facing the way the camera looks.
- Point sounds, such as the river, a fire, or chopping, get quieter with distance from the player. They fade to silence at about 30 m.
- Point sounds pan left or right by where they are relative to the camera's view.

## Volume and muting

- The player has one **Volume** slider. It sits on the start screen and behind a small sound button on the HUD.
- The M key mutes and unmutes all sound.
- Volume and mute are stored in the browser, not in the saved game. They apply to every save slot.
- All sound stops when the browser tab is hidden. It fades back in when the tab is shown.

## Ambience

- **River**: a point sound along the river. It is loudest at the nearest bit of water.
- **Forest**: a rustle of leaves. It gets louder as the wind blows harder, so it is louder in rain.
- **Fire**: a crackle from each lit campfire and fireplace. A bigger flame crackles louder. Unlit fires and planted torches are silent.
- **Rain**: plays while rain falls and eases in and out with it. Under a roof, where rain would not fall on the player, it switches to a muffled drumming on the roof.
- **Birds and crickets**: birdsong by day and crickets at night. They crossfade at dawn and dusk. Birdsong does not depend on the visible birds of `.scratch/valley-life/`.
- A room changes only the rain. The river, the forest, birds, and crickets sound the same indoors.
- While the player sleeps or time is skipped, ambience keeps following the clock and crossfades quickly. All sound is silent while the sleep animation fades to black.

## Action sounds

- Chopping, sawing, debarking, digging up, and building each play while the player does that work. They stop when the work stops.
- The building sound plays while the player works on a blueprint's timed construction (ADR 0002). Placing a blueprint and taking a piece down each play a short, quiet click.
- Footsteps play while the player walks. There is one footstep sound for every ground type.

## Testing sound

- The dev build exposes which sounds play and how loud each one is, on `window.farHollow`. A QA agent checks sound by reading this state, not by listening.
- `docs/agents/game-testing.md` describes that state.
- Unit tests cover the pure rules: distance fade, panning, the day and night crossfade, the wind-to-forest loudness, the choice between rain and rain on a roof, and the 16-sound limit.

## Assets

Every sound is a draft made in code, with `"kind": "code"`. Nothing comes from third-party packs.

| Ticket | Asset | What it is |
| --- | --- | --- |
| 01 | `sound-river` | Flowing water loop |
| 01 | `sound-forest` | Leaf rustle loop that follows the wind |
| 01 | `sound-fire` | Fire crackle loop |
| 02 | `sound-chop` | Axe striking wood |
| 02 | `sound-saw` | Saw stroke |
| 02 | `sound-debark` | Bark scraping off a log |
| 02 | `sound-dig` | Digging into soil |
| 02 | `sound-build` | Knocking and fitting wood during construction |
| 02 | `sound-place` | Short, quiet click for placing a blueprint or taking a piece down |
| 02 | `sound-footstep` | One footstep |
| 03 | `sound-rain` | Rain loop |
| 03 | `sound-rain-roof` | Muffled rain drumming on a roof |
| 03 | `sound-birds` | Daytime birdsong |
| 03 | `sound-crickets` | Night crickets |

The approved `rain` asset's description says "It has no sound." Ticket 03 removes that sentence. The owner approved this wording change on 2026-11-22.

## Tickets

1. Sound engine, Volume, and river, forest, and fire ambience.
2. Action sounds. Blocked by 01.
3. Rain, birds, and crickets. Blocked by 01.

## Not in this feature

- Music
- Separate sliders for ambience and action sounds
- Different footsteps for each ground type
- Sounds for fishing, eating, drinking, doors, crafting, and other actions
- Muffling the river, forest, birds, or crickets indoors
- Third-party sound files
