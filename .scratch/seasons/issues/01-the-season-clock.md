# 01: The season clock

**What to build:** The valley turns through four seasons of 7 days each, and the player can see which season it is and how many days are left. A banner marks the start of each season. Developers can start the playground in any season and skip to the next one. This ticket adds no season rules yet. Tickets 02 to 05 add them.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `hud` for the clock text, ring tint, and season banner. No new assets. Settled with the owner on 2026-11-25.

## Seasons

- [x] The year has four seasons in order: spring, summer, autumn, and winter. Each lasts 7 days. After winter, a new year starts with spring, forever.
- [x] A new game starts on day 1 of spring, so the first winter starts on day 22.
- [x] The season comes from the day number and a saved start day for the year, `yearStartDay`. New games set it to 1.
- [x] The season and the day within it are a value object with pure functions (ADR 0009). Tickets 02 to 05 read the season from it.
- [x] The game view tells the UI the season, the day within the season, and the season's length.

## HUD

- [x] The clock text reads like "Spring · day 3 of 7 · 14:20".
- [x] The clock ring is tinted amber in autumn and pale blue in winter. Spring and summer keep today's colour.
- [x] When a season starts, a short banner shows, styled like the rain banner. It says in one line what changes. For example: "Spring. The snow melts and the river thaws." "Summer." "Autumn. The nights grow colder." "Winter has come. The river is frozen." Later tickets may change the wording as they add the rules.
- [x] The debug overlay shows the season and the day within it.

## Playground and debug

- [x] The playground accepts `&season=<spring|summer|autumn|winter>` and starts at 6:00 on day 1 of that season. Without it, the playground starts in spring.
- [x] The debug overlay has a "Skip to next season" button. It sends a new `skipToSeason` command, which passes time to 6:00 on day 1 of the next season. The world moves on as it does with the other skip commands.

## Saving

- [x] `yearStartDay` is saved. The save version goes up.
- [x] The save upgrade sets `yearStartDay` to the save's current day, so an older save resumes on day 1 of spring (ADR 0011).

## The rest

- [x] `GLOSSARY.md` defines Season, Year, Winter, Snowfall, and Snow cover. This is done already.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover the season value object (start, wrap after winter, `yearStartDay` offset), `skipToSeason`, the playground season, and the save upgrade.

## Comments

- 2026-11-25, implementation: The season lives in `src/sim/season.ts`. The game view has `season` and `seasonBanner`. The banner shows for 30 game minutes from the first logic step in the new season. A player who sleeps through midnight sees it when they wake.
- `skipToSeason` keeps passing time after a collapse, so the debug button always reaches the next season. `skipTime` and `skipToRainChange` still stop at a collapse.
- The HUD amber is already the spring and summer colour, so autumn uses a deeper amber (`#e0782c`). Winter uses pale blue (`#a9d4f2`).
- Without `&season=`, the playground still starts at 8:00 on day 1, as before.
