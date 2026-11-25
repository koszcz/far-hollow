# 02: Winter cold and long nights

**What to build:** Autumn nights get colder. In winter, warmth drains even by day, and the nights are long. A player without a heated room collapses on a winter night. A player with a snug room and a lit fireplace gets through. Summer nights are short.

**Blocked by:** 01 (the season clock)

**Status:** ready-for-agent

**Assets:** Reuse `terrain` and `hud`. The sun path and daylight change in code only. No new assets. Settled with the owner on 2026-11-25.

## Warmth by season

- [ ] Warmth drains at these rates, in warmth per game hour:

  | Season | Day | Night |
  |---|---|---|
  | Spring, summer | 0 | 0.25 |
  | Autumn | 0 | 0.375 |
  | Winter | 0.1 | 0.5 |

- [ ] A snug room still halves the drain, by day and by night.
- [ ] Rain still adds 0.25 per hour outdoors. Sickness still doubles every drain.
- [ ] Being warmed by a campfire or a heated fireplace still restores warmth as today, in every season.

## Night hours by season

- [ ] Night runs at these hours:

  | Season | Night starts | Morning |
  |---|---|---|
  | Spring, autumn | 20:00 | 6:00 |
  | Summer | 21:00 | 5:00 |
  | Winter | 17:00 | 8:00 |

- [ ] The night hours follow the season of the current day. They change only when a season starts.
- [ ] Everything that reads night follows these hours: warmth, the sun path, daylight with its dawn and dusk, the HUD time-of-day words, and the time of the next morning (used by sleeping).
- [ ] The night hours per season live with the season value object (ADR 0009).

## The rest

- [ ] Ticket 01's autumn and winter banners mention the colder nights, if they do not already.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover the drain rates in each season by day and by night, with and without a snug room, and the night hours in each season, including the night that spans the change from autumn to winter.
