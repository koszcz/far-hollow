# 09: Measure the frame rate of ground types and undergrowth

**What to build:** Measure whether the game still runs at 60 fps on an Apple M1 laptop in Chrome with the ground types and the undergrowth. Tickets 01 and 02 asked for this, but nobody measured it.

**Blocked by:** none

**Status:** resolved

**Assets:** None.

- [x] Measure the mean frame time with a script like `.scratch/regrowth/measure.ts`. Record the seed, the screen size, and the pixel ratio.
- [x] Measure a dense forest view and an open view by the river.
- [x] Record the results as a comment in this ticket.
- [x] Tick the frame-rate boxes in tickets 01 and 02 if they pass.
  Ticked on 2026-11-23. The owner accepted the M3 Pro result in place of an M1 measurement.
- [x] If they fail, open a new ticket for the fix. Do not fix it in this ticket.
  Nothing failed, so there is no new ticket.

## Comment: frame-rate check, 2026-11-22

Measured with `.scratch/forest-floor/measure.ts`, which walks the player to each spot with the dev hooks and then times 600 frames.

- Machine: Apple M3 Pro laptop, Chrome on the real GPU (ANGLE Metal), no frame cap.
- Seed 12345, 2,600 trees, a 1512 by 900 window at pixel ratio 2.
- Each spot was measured in two runs. The table shows both.

| Spot | Mean frame time | 95th percentile | Draw calls per frame |
| --- | --- | --- | --- |
| Start spot (1.5, 0.5) | 3.98 ms, 4.19 ms | 6.20 ms, 6.70 ms | 139 |
| Dense forest, 103 trees within 25 m (-80, 70) | 3.89 ms, 3.77 ms | 8.00 ms, 4.70 ms | 83 |
| Open river bank, no tree within 25 m (-1.5, 22.5) | 4.07 ms, 3.96 ms | 6.90 ms, 5.10 ms | 144 |

What this means:

- On the M3 Pro, the game runs at about 250 fps with ground types and undergrowth. That is well inside the 8.3 ms that the spec's 120 fps target for this laptop allows.
- The regrowth check on 2026-11-16 measured 3.4 ms on the same machine and seed, before ground types and undergrowth. The new ground adds about 0.5 ms per frame.
- On an M1, the 60 fps target allows 16.7 ms per frame. The M1's GPU is about a third as fast as the M3 Pro's, so the mean should land near 12 ms. That is an estimate, not a measurement.
