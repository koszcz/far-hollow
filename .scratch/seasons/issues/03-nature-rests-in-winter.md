# 03: Nature rests in winter

**What to build:** In winter, food stops growing, trees stop regrowing, and the river freezes. The player must stock food and fish before winter. Sticks keep falling, so the player always has some fuel. Fireflies come out only in summer.

**Blocked by:** 01 (the season clock)

**Status:** ready-for-agent

**Assets:** Reuse `trees`, `river`, `fireflies`, and the berry bush, mushroom, and fish trap entries. The bare winter look of bushes, if needed, is a small change to their existing draw code. The frozen river look is ticket 05. Settled with the owner on 2026-11-25.

## Food and trees

- [ ] In winter, wild berry bushes, mushroom patches, planted berry bushes, and mushroom logs give nothing. Foraging them is refused with a reason (ADR 0008), such as "Nothing grows in winter."
- [ ] Their regrowth timers pause in winter and resume on day 1 of spring.
- [ ] Anything ripe when winter starts is lost. Each one restarts its regrowth in spring, with its full regrowth time.
- [ ] A berry bush in winter shows no berries.
- [ ] Stumps, saplings, and young trees stop growing in winter and resume in spring.
- [ ] Sticks keep falling in winter.

## The frozen river

- [ ] The river is frozen for all of winter and thaws on day 1 of spring.
- [ ] The player can still drink from the river in winter. Unboiled river water still causes sickness.
- [ ] Fishing with a rod is refused in winter, with the reason "The river is frozen." (ADR 0008).
- [ ] Setting a fish trap is refused in winter with the same reason.
- [ ] A set fish trap catches nothing in winter. Its time to the next catch pauses. A trap keeps a fish it already holds, and the player can take it.
- [ ] The player cannot walk on the ice. Walking at the bank works as today.

## Fireflies

- [ ] Fireflies appear only in summer.

## The rest

- [ ] Ticket 01's winter and spring banners mention the frozen river and the thaw, if they do not already.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover paused regrowth and the lost ripe food, paused tree growth, falling sticks, drinking in winter, the fishing and trap refusals, a trap that keeps its fish, and the thaw.
