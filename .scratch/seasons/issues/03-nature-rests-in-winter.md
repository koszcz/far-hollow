# 03: Nature rests in winter

**What to build:** In winter, food stops growing, trees stop regrowing, and the river freezes. The player must stock food and fish before winter. Sticks keep falling, so the player always has some fuel. Fireflies come out only in summer.

**Blocked by:** 01 (the season clock)

**Status:** resolved

**Assets:** Reuse `trees`, `river`, `fireflies`, and the berry bush, mushroom, and fish trap entries. The bare winter look of bushes, if needed, is a small change to their existing draw code. The frozen river look is ticket 05. Settled with the owner on 2026-11-25.

## Food and trees

- [x] In winter, wild berry bushes, mushroom patches, planted berry bushes, and mushroom logs give nothing. Foraging them is refused with a reason (ADR 0008), such as "Nothing grows in winter."
- [x] Their regrowth timers pause in winter and resume on day 1 of spring.
- [x] Anything ripe when winter starts is lost. Each one restarts its regrowth in spring, with its full regrowth time.
- [x] A berry bush in winter shows no berries.
- [x] Stumps, saplings, and young trees stop growing in winter and resume in spring.
- [x] Sticks keep falling in winter.

## The frozen river

- [x] The river is frozen for all of winter and thaws on day 1 of spring.
- [x] The player can still drink from the river in winter. Unboiled river water still causes sickness.
- [x] Fishing with a rod is refused in winter, with the reason "The river is frozen." (ADR 0008).
- [x] Setting a fish trap is refused in winter with the same reason.
- [x] A set fish trap catches nothing in winter. Its time to the next catch pauses. A trap keeps a fish it already holds, and the player can take it.
- [x] The player cannot walk on the ice. Walking at the bank works as today.

## Fireflies

- [x] Fireflies appear only in summer.

## The rest

- [x] Ticket 01's winter and spring banners mention the frozen river and the thaw, if they do not already.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover paused regrowth and the lost ripe food, paused tree growth, falling sticks, drinking in winter, the fishing and trap refusals, a trap that keeps its fish, and the thaw.

## Comments

- 2026-11-25, implementation: The game passes "is it winter" into foraging, fishing, and fish traps. The tests are in `src/sim/winter-nature.test.ts`.
- When winter starts, every bush, mushroom patch, and mushroom log with food loses it and starts growing back with the full 3 days. That count waits until spring, so the berries on a bush hide through winter.
- A player who is fishing when winter starts stops fishing.
- The new refusals read "nothing grows in winter" and "the river is frozen".
- A collapse now moves the valley on in two parts when midnight falls before the player wakes, so a season that starts at midnight counts from then.
- Fireflies fade out when summer ends, as they do when rain starts. The scene renderer now reads the season.
- Ticket 01's spring and winter banners already mention the thaw and the frozen river, so they are unchanged.
