# 01: Sound engine, Volume, and river, forest, and fire ambience

**What to build:** The valley makes sound. The player hears the river, the forest rustling in the wind, and lit fires crackling. Each fades with distance from the player and pans with the camera. The player sets one Volume slider and mutes with M. See `.scratch/sound/spec.md`.

**Status:** resolved

**Assets:** Add the drafts `sound-river` (flowing water loop), `sound-forest` (leaf rustle loop that follows the wind), and `sound-fire` (fire crackle loop), all made in code. Decided with the owner on 2026-11-22.

## Sound engine

- [x] Sound is a render-side layer that reads sim state. The sim gains no sound code (ADR 0001).
- [x] Sound starts on the player's first click, as browsers require.
- [x] The game hears from the player's spot, facing the way the camera looks.
- [x] Point sounds get quieter with distance from the player and fade to silence at about 30 m.
- [x] Point sounds pan left or right by where they are relative to the camera's view.
- [x] At most 16 sounds play at once. When more want to play, the quietest ones stop.
- [x] Sound costs under 0.5 ms per frame.
- [x] All sound stops when the browser tab is hidden. It fades back in when the tab is shown.
- [x] All sound is silent while the sleep animation fades to black.
- [x] Distance fade and panning are value objects (ADR 0009).

## Volume

- [x] The start screen has a Volume slider.
- [x] A small sound button on the HUD opens the same Volume slider.
- [x] The M key mutes and unmutes all sound. The sound button shows when sound is muted.
- [x] Volume and mute are stored in the browser, not in the saved game. They apply to every save slot and survive a reload.

## Ambience

- [x] The river plays as a point sound, loudest at the nearest bit of water.
- [x] The forest rustles. It gets louder as the wind blows harder.
- [x] Each lit campfire and fireplace crackles. A bigger flame crackles louder.
- [x] Unlit fires and planted torches are silent.
- [x] While the player sleeps or time is skipped, ambience keeps following the game state.

## Testing and the rest

- [x] The dev build exposes which sounds play and how loud each one is, on `window.farHollow`.
- [x] `docs/agents/game-testing.md` describes how to read that sound state.
- [x] `GLOSSARY.md` defines ambience, action sound, and Volume. This is done already.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover distance fade, panning, the 16-sound limit, forest loudness from the wind, fire loudness from the flame, and storing Volume and mute.
