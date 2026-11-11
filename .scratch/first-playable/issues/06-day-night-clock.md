# 06: Day and night clock with a debug overlay

**What to build:** Time passes in the valley. A day lasts 24 real minutes. Nights are dark, with faint moonlight that keeps shapes visible. A debug overlay helps developers check the game and skip time forward.

**Blocked by:** 02 (Seeded valley with a river and trees)

**Status:** resolved

- [x] One game hour is one real minute. A day is 24 real minutes.
- [x] Light changes smoothly from day to night and back.
- [x] At night, the valley is dark enough that the player needs fire. Faint moonlight keeps shapes visible.
- [x] The game logic owns the clock. Rendering only reads it.
- [x] A debug overlay is off by default. A key toggles it.
- [x] The overlay shows fps, entity count, the seed, and the game time.
- [x] The overlay can skip time forward by sending a command to the game logic.
- [x] Unit tests cover the clock and the time skip.
