# 02: Winter cold and long nights

**What to build:** Autumn nights get colder. In winter, warmth drains even by day, and the nights are long. A player without a heated room collapses on a winter night. A player with a snug room and a lit fireplace gets through. Summer nights are short.

**Blocked by:** 01 (the season clock)

**Status:** resolved

**Assets:** Reuse `terrain` and `hud`. The sun path and daylight change in code only. No new assets. Settled with the owner on 2026-11-25.

## Warmth by season

- [x] Warmth drains at these rates, in warmth per game hour:

  | Season | Day | Night |
  |---|---|---|
  | Spring, summer | 0 | 0.25 |
  | Autumn | 0 | 0.375 |
  | Winter | 0.1 | 0.5 |

- [x] A snug room still halves the drain, by day and by night.
- [x] Rain still adds 0.25 per hour outdoors. Sickness still doubles every drain.
- [x] Being warmed by a campfire or a heated fireplace still restores warmth as today, in every season.

## Night hours by season

- [x] Night runs at these hours:

  | Season | Night starts | Morning |
  |---|---|---|
  | Spring, autumn | 20:00 | 6:00 |
  | Summer | 21:00 | 5:00 |
  | Winter | 17:00 | 8:00 |

- [x] The night hours follow the season of the current day. They change only when a season starts.
- [x] Everything that reads night follows these hours: warmth, the sun path, daylight with its dawn and dusk, the HUD time-of-day words, and the time of the next morning (used by sleeping).
- [x] The night hours per season live with the season value object (ADR 0009).

## The rest

- [x] Ticket 01's autumn and winter banners mention the colder nights, if they do not already.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover the drain rates in each season by day and by night, with and without a snug room, and the night hours in each season, including the night that spans the change from autumn to winter.

## Comments

- 2026-11-25, implementation: The night hours live in `src/sim/season.ts` (`nightHoursOf`, `isNightHour`). `isNightAt` and `nextMorning` in `src/sim/clock.ts` now take `yearStartDay` and follow the season of the current day. The game view has `nightHours`, which the sky, daylight, sound, and HUD words read.
- The warmth rates live in `src/sim/needs.ts` as `WARMTH_DRAIN_PER_HOUR`, by season, by day and by night. A snug room halves both.
- The winter banner now reads "Winter has come. The nights are long and cold, and the river is frozen." The snug room notice no longer says "At night", since a snug room now halves the day's drain in winter too.
- Winter has no "evening" on the HUD clock: evening starts at 17:00, when the winter night starts.
- Owner to decide: the playground's `&season=winter` and `skipToSeason` start at 6:00, which is now two hours before the winter morning. A player starting the winter playground with no fire collapses at about 9:00. A collapse on the last autumn night wakes the player at 8:00 on winter day 1, past `skipToSeason`'s 6:00.
- 2026-11-25, review fix: The owner decided that `&season=` and `skipToSeason` start at the season's morning hour, such as 8:00 in winter.
