# 03: Swap a standing log wall for a window or a door frame

**What to build:** The player can place a window or a door frame on an edge that already holds a finished log wall, and the new piece takes the wall's place. Today the player must take the wall down first, which the windows spec settled on purpose ("A window cannot replace a finished log wall"). This idea reverses that rule for windows and door frames, so the player can add light and doorways to a cabin they have already built. It builds on `.scratch/windows/` and `.scratch/shelter/issues/05-log-walls-and-door-frames.md`.

**Status:** idea

**Assets:** None yet. Decide during grilling. The swap may reuse `log-wall`, `window`, `door-frame`, and `debarked-log`.

Questions for grilling:

- What happens to the wall's debarked logs? Do they count toward the new piece, so the swap costs nothing, or does the wall give them back on the ground as when it is taken down?
- Is the swap one timed job, or does the wall come down first and the new blueprint wait for its logs as usual? How long does it take?
- What does the player see before the swap finishes? Does the wall stand until the new piece is built, or does the edge open at once?
- What if a roof frame rests on the wall? The window holds up a roof frame and the door frame may too, so can the swap go ahead while the roof stays up?
- Can the swap also go the other way, or between pieces: a window or door frame back to a wall, a window to a door frame? Can it go on a wall blueprint, not only a finished wall?
