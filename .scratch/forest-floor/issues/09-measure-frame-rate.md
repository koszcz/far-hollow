# 09: Measure the frame rate of ground types and undergrowth

**What to build:** Measure whether the game still runs at 60 fps on an Apple M1 laptop in Chrome with the ground types and the undergrowth. Tickets 01 and 02 asked for this, but nobody measured it.

**Blocked by:** none

**Status:** ready-for-agent

**Assets:** None.

- [ ] Measure the mean frame time with a script like `.scratch/regrowth/measure.ts`. Record the seed, the screen size, and the pixel ratio.
- [ ] Measure a dense forest view and an open view by the river.
- [ ] Record the results as a comment in this ticket.
- [ ] Tick the frame-rate boxes in tickets 01 and 02 if they pass.
- [ ] If they fail, open a new ticket for the fix. Do not fix it in this ticket.
