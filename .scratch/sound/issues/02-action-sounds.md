# 02: Action sounds

**What to build:** The player's work and movement make sound. Chopping, sawing, debarking, digging up, building, and walking each play their own action sound. See `.scratch/sound/spec.md`.

**Blocked by:** 01 (Sound engine, Volume, and river, forest, and fire ambience)

**Status:** resolved

**Assets:** Reuse the sound engine from ticket 01. Add the drafts `sound-chop` (axe striking wood), `sound-saw` (saw stroke), `sound-debark` (bark scraping off a log), `sound-dig` (digging into soil), `sound-build` (knocking and fitting wood during construction), `sound-place` (short, quiet click), and `sound-footstep` (one footstep), all made in code. Decided with the owner on 2026-11-22.

- [x] Chopping a tree plays the chop sound in time with the axe strikes.
- [x] Sawing plays the saw sound in time with the strokes.
- [x] Debarking a log plays the debark sound.
- [x] Digging up plays the dig sound.
- [x] Working on a blueprint's timed construction plays the build sound (ADR 0002).
- [x] Placing a blueprint and taking a piece down each play the short, quiet place sound.
- [x] Each work sound stops as soon as the work stops or is cancelled.
- [x] Walking plays footsteps in time with the player's steps. There is one footstep sound for every ground type.
- [x] Action sounds come from the player's spot and follow Volume and mute.
- [x] No action sound plays during skipped time or while the player sleeps.
- [x] The dev build's sound state lists the action sounds that play.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover which activity plays which sound, and that each sound stops when its work stops.
