# 03: Rain, birds, and crickets

**What to build:** The player hears rain while it falls, and a muffled drumming when standing under a roof. Birds sing by day and crickets chirp at night, crossfading at dawn and dusk. See `.scratch/sound/spec.md`.

**Blocked by:** 01 (Sound engine, Volume, and river, forest, and fire ambience)

**Status:** resolved

**Assets:** Reuse the sound engine from ticket 01. Add the drafts `sound-rain` (rain loop), `sound-rain-roof` (muffled rain drumming on a roof), `sound-birds` (daytime birdsong), and `sound-crickets` (night crickets), all made in code. In the approved `rain` asset's description, remove "It has no sound." The owner approved this wording change on 2026-11-22.

## Rain

- [x] Rain plays while rain falls. It eases in and out as rain starts and stops.
- [x] Under a roof, where rain would not fall on the player, rain switches to the muffled roof sound. It uses the same rule as the player's shelter from rain.
- [x] Walking in or out from under a roof crossfades between the two rain sounds.

## Birds and crickets

- [x] Birds sing by day. Crickets chirp at night.
- [x] They crossfade at dawn and dusk, following the same clock as the daylight.
- [x] Birdsong does not depend on the visible birds of `.scratch/valley-life/`.
- [x] While the player sleeps or time is skipped, birds and crickets keep following the clock and crossfade quickly.

## The rest

- [x] A room changes only the rain. The river, forest, birds, and crickets sound the same indoors.
- [x] The dev build's sound state lists the rain, birds, and crickets and how loud each one is.
- [x] The day and night crossfade and the choice between rain and rain on a roof are value objects (ADR 0009).
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover rain loudness as rain starts and stops, the choice between rain and rain on a roof, and the day and night crossfade.
