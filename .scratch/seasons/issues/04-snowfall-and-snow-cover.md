# 04: Snowfall and snow cover

**What to build:** In winter, snow falls in place of rain. Snow cover builds up on the ground, trees, and roofs over the first days of winter and melts in early spring. Deep snow slows walking a little.

**Blocked by:** 01 (the season clock)

**Status:** resolved

**Assets:** Add the drafts `snow-cover` (a white blend in the ground shader, white tops on tree crowns, and a white tint on roofs, all in code) and `snowfall` (slow white flakes, following the pattern of the `rain` effect). Reuse `terrain`, `trees`, `far-trees`, `roof`, and `hud`. Settled with the owner on 2026-11-25.

## Snowfall

- [x] In winter, each seeded rain spell falls as snowfall instead. The schedule and the seed stay the same, so older seeds keep their weather.
- [x] Snowfall drains warmth outdoors by 0.25 per hour, as rain does.
- [x] Snowfall does not fill rain barrels.
- [x] Snowfall draws slow white flakes in place of rain streaks and splashes. It eases in and out like rain.
- [x] The rain banner says it is snowing during snowfall. The "skip to rain change" debug button also skips snowfall.
- [x] Rain sounds do not play during snowfall.

## Snow cover

- [x] Snow cover follows the calendar, not the snowfall. It grows from none at the start of winter day 1 to full by the end of winter day 3. It melts over spring days 1 and 2. It is not saved.
- [x] Snow cover shows on the ground, on tree crowns (near and far), and on roofs, in proportion to its depth.
- [x] Full snow cover slows walking outdoors to 0.85×. The slowdown scales with the depth of the cover.
- [x] Snow does not slow walking on floors or inside rooms.
- [x] The snow slowdown stacks with the low-need and sled slowdowns.
- [x] The snow cover depth is a value object with pure functions (ADR 0009).

## The rest

- [x] Both drafts are in the asset catalogue with `"status": "draft"` and this ticket's path (ADR 0006).
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover snowfall in place of rain, the warmth drain, rain barrels in snowfall, the cover depth by day, and the walking slowdown outdoors and on a floor.
- [x] Check the look in the browser with `?playground&season=winter`, following `docs/agents/game-testing.md`.
