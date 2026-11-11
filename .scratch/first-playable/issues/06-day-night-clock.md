# 06: Day and night clock with a debug overlay

**What to build:** Time passes in the valley. A day lasts 24 real minutes. Nights are dark, with faint moonlight that keeps shapes visible. A debug overlay helps developers check the game and skip time forward.

**Blocked by:** 02 (Seeded valley with a river and trees)

**Status:** ready-for-agent

- [ ] One game hour is one real minute. A day is 24 real minutes.
- [ ] Light changes smoothly from day to night and back.
- [ ] At night, the valley is dark enough that the player needs fire. Faint moonlight keeps shapes visible.
- [ ] The game logic owns the clock. Rendering only reads it.
- [ ] A debug overlay is off by default. A key toggles it.
- [ ] The overlay shows fps, entity count, the seed, and the game time.
- [ ] The overlay can skip time forward by sending a command to the game logic.
- [ ] Unit tests cover the clock and the time skip.
