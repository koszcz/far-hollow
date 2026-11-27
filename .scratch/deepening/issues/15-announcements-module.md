# 15: One announcements module decides which notice shows

**What to build:** One module takes notice requests and the clock, and returns what shows now. It holds the timing rules, such as "wait until no other notice is on screen" and "spoiled food joins the notice already shown".

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

`src/sim/game.ts` has 66 references to notices. These state variables interact: `notice`, `goalNotice`, `seasonBanner`, `goalsToAnnounce`, `spoiledToTell`, and `snugRoomNoticeShown`. Their timing rules live in 6 functions, such as `noticeSnugRoom`, `noticeSpoiledFood`, and `noteGoals`. Only whole-game runs test them.

This is also a meaningful seam for file-length ticket 07, which splits `game.ts`. The per-system wiring in `game.ts` should stay explicit, because the order matters ("food dries before it spoils, after fires burn").

## Acceptance criteria

- [ ] Tests check the timing rules directly with a fake clock.
- [ ] Every notice shows at the same time and in the same order as before.
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Is this worth doing now, or only when the next notice is added?
- Should this ticket replace part of file-length ticket 07, or land first?
- Do the season banner and goal notices share one queue with the other notices, or stay separate?
