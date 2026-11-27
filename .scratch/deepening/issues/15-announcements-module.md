# 15: Test the notice timing rules through the game notices module

**What to build:** Tests that check the notice timing rules directly through `createGameNotices`, with a fake clock. Examples are "wait until no other notice is on screen" and "spoiled food joins the notice already shown".

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

The review on 2026-11-27 found the notice state and timing rules spread through `src/sim/game.ts`. File-length ticket 07 has since moved them into `src/sim/game-notices.ts`. That module now holds `notice`, `goalNotice`, `seasonBanner`, `goalsToAnnounce`, `spoiledToTell`, and `snugRoomNoticeShown`.

The module has no test file of its own. Only whole-game runs test the timing rules. `createGameNotices` takes its clock and other inputs as plain values, so a direct test needs no running game.

## Acceptance criteria

- [ ] A test file for `game-notices.ts` checks each timing rule with a fake clock.
- [ ] No notice changes when or in what order it shows.
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Is this worth doing now, or only when the next notice is added?
- Does `GameNoticesDeps` need fewer inputs before it is easy to test? It takes the whole entity store today.
- Should whole-game notice tests move to this file, or stay where they are?
