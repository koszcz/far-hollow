# Seasons and a first winter

**Status:** ready-for-agent

## Problem statement

The game has days but no seasons. Nothing changes over time, so nothing pushes the player to prepare. Firewood, stored food, and a snug cabin are nice to have, but never needed.

## Solution

The valley turns through four seasons of 7 days each: spring, summer, autumn, and winter. The year loops forever. A new game starts on day 1 of spring, so the first winter starts on day 22.

Winter is hard but fair:

- Warmth drains faster, and the nights are long.
- Food stops growing, trees stop regrowing, and the river freezes.
- Snow falls in place of rain, and snow cover slows walking a little.

A player who stocked firewood and food and has a snug room with a fireplace gets through comfortably. A player who did not will collapse and respawn, as today. Autumn is the warning: nights get colder and the leaves turn.

## User stories

1. As a player, I want to see the season and the day within it, so that I know how long I have before winter.
2. As a player, I want a short banner when a season starts, so that I know what has changed.
3. As a player, I want autumn nights to be colder, so that I feel winter coming.
4. As a player, I want winter to drain my warmth even by day, so that I need shelter and fire.
5. As a player, I want long winter nights, so that keeping a fire going overnight matters.
6. As a player, I want short summer nights, so that summer is the easy season.
7. As a player, I want berry bushes, mushroom patches, and mushroom logs to give nothing in winter, so that I have to store food.
8. As a player, I want trees to stop regrowing in winter but sticks to keep falling, so that I always have some fuel.
9. As a player, I want the river to freeze in winter, so that I have to fish before winter.
10. As a player, I want to still drink from the frozen river, so that winter does not kill me through thirst.
11. As a player, I want snowfall in winter in place of rain, so that winter looks and feels different.
12. As a player, I want snow on the ground, trees, and roofs, so that the valley looks like winter.
13. As a player, I want snow cover to slow my walking a little, so that winter trips cost more.
14. As a player, I want the leaves to turn amber in autumn, so that I see winter coming.
15. As a player, I want fireflies only in summer, so that each season feels like itself.
16. As a player with an older save, I want my game to resume on day 1 of spring, so that winter does not surprise me.
17. As a developer, I want to start the playground in any season, so that I can test winter quickly.
18. As a developer, I want a debug button that skips to the next season, so that I can test season changes.

## Implementation decisions

### The season clock

- A season lasts 7 days. The year is spring, summer, autumn, winter, and then it repeats.
- The season comes from the day number and a saved start day for the year, `yearStartDay`. New games set it to 1.
- The season and the day within it are a value object (ADR 0009).
- The save upgrade sets `yearStartDay` to the save's current day, so an older save resumes on day 1 of spring (ADR 0011).

### Warmth by season

Warmth drains at these rates, in warmth per game hour:

| Season | Day | Night |
|---|---|---|
| Spring, summer | 0 | 0.25 |
| Autumn | 0 | 0.375 |
| Winter | 0.1 | 0.5 |

- A snug room still halves the drain.
- Snowfall adds 0.25 per hour outdoors, as rain does.
- Being warmed by a fire still restores warmth as today.

### Night hours by season

| Season | Night starts | Morning |
|---|---|---|
| Spring, autumn | 20:00 | 6:00 |
| Summer | 21:00 | 5:00 |
| Winter | 17:00 | 8:00 |

- The night hours follow the season of the current day. They change only when a season starts.
- Everything that reads night today follows these hours: warmth, the sun path, daylight, the HUD time-of-day words, and the time of the next morning.

### Nature in winter

- Berry bushes, mushroom patches, planted berry bushes, and mushroom logs give nothing in winter. Their regrowth timers pause and resume in spring. Anything ripe when winter starts is lost.
- Stumps, saplings, and young trees stop growing in winter. Sticks keep falling.
- The river freezes for all of winter:
  - The player can still drink. Unboiled river water still causes sickness.
  - Fishing with a rod is refused, with the reason that the river is frozen (ADR 0008).
  - Fish traps catch nothing. A trap keeps a fish it already holds.
  - The player cannot walk on the ice.
- Fireflies appear only in summer. Birds do not change.

### Snow

- In winter, each seeded rain spell falls as snowfall instead. The schedule and the seed stay the same.
- Snowfall does not fill rain barrels.
- Snow cover follows the calendar, not the snowfall. It grows from none on winter day 1 to full by winter day 3. It melts over spring days 1 and 2. It is not saved.
- Full snow cover slows walking outdoors to 0.85×. The slowdown scales with the depth of the cover. It does not apply on floors or inside rooms. It stacks with the other slowdowns.

### HUD and the banner

- The clock text reads like "Spring · day 3 of 7 · 14:20".
- The clock ring is tinted amber in autumn and pale blue in winter.
- A short banner, like the rain banner, shows when a season starts. It says in one line what changed, such as "Winter has come. The river is frozen."

### Playground and debug

- The playground accepts `&season=<spring|summer|autumn|winter>` and starts on day 1 of that season.
- The debug overlay has a "Skip to next season" button. It sends a new `skipToSeason` command, which passes time to 6:00 on day 1 of the next season.

## Testing decisions

- Test behaviour through the game's command and view seam, as the existing sim tests do. Do not test the internals.
- Unit tests cover the season value object, warmth rates by season, night hours by season, paused growth, the frozen river, snowfall in place of rain, the walking slowdown, the save upgrade, and `skipToSeason`.
- The prior art is the clock, needs, rain, foraging, fish trap, and save upgrade tests.
- Check the visual drafts in the browser, following `docs/agents/game-testing.md`.

## Out of scope

- Food spoiling and preserving. That is the food-keeping idea, which follows this spec.
- The journal's second chapter, which leads the player through the first winter.
- Snow cover that builds up from actual snowfall.
- Walking on the frozen river.
- Fewer birds in winter.
- Clothing.

## Further notes

A heated fireplace burns one firewood every 3 hours. A winter night is 15 hours, so it needs about 5 firewood. A 7-day winter needs about 35 firewood plus daytime fires. That number can size the woodpile goal in the journal's second chapter.
