# 12: The HUD panels use the reach module, so nothing behind a wall shows its panel

**What to build:** One reach module answers three questions for every kind of thing: can the player act on it from here, which thing of a kind is nearest within reach, and where should the player walk to reach it. It always applies walls and footprints. Each kind supplies only its reach distance and its walk style.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

Ticket 01 made one reach module, and the reach-through-walls fix (4eba58f) brought approach, building, beds, chests, and the E key onto one wall rule. The HUD panels did not move. Each system's `nearby()` still uses the straight-line `nearestWithin` in `src/sim/ground-point.ts`, with no wall check. This happens in 9 files, including the wood box, rain barrel, woodpile, pile, drying rack, door, window, and chimney systems.

So a wood box or rain barrel behind a wall may show its panel even though the player cannot reach it. The review traced this in the code but did not run it.

There are also 26 separate `*_REACH_METRES` constants, and each system builds its own `{target, metres, walk}` reach result.

## Acceptance criteria

- [ ] A test shows that a wood box behind a wall does not show its panel, if the bug is confirmed.
- [ ] Every `nearby()` finds its thing through the reach module.
- [ ] The wall rules are tested in one place. Feature tests do not each repeat "behind a wall".
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Confirm the bug in the game first: does a panel show for a thing behind a wall?
- Should the reach distances stay per kind, or fall into a few shared sizes?
- Does a window count as a wall for every kind, as it does for the E key?
