# 03: Swap a standing log wall for a window or a door frame

**What to build:** The player can swap a finished log wall for a window or a door frame. They place the new piece on the wall from the build menu. The wall stands until the swap finishes, then turns into the new piece, built from the wall's own logs. The roof on the wall stays up. The player can now add light and doorways to a cabin they have already built. This reverses the windows spec's rule that a window cannot replace a finished log wall. It builds on `.scratch/windows/` and `.scratch/shelter/issues/05-log-walls-and-door-frames.md`.

**Blocked by:** None

**Status:** resolved

**Assets:** Reuse `log-wall`, `window`, `door-frame`, and `debarked-log`. Add nothing new. The swap blueprint is the usual see-through blueprint of the new piece, drawn over the standing wall. Decided with the owner on 2026-11-25.

## Placing a swap

- [x] With the window or the door frame chosen in the build menu, the player can place it on an edge that holds a finished log wall. This places a swap blueprint on the wall.
- [x] A swap follows the new piece's placement rules, apart from the taken edge. The opening corner rule still refuses a swap at a corner, with its usual reason (ADR 0008).
- [x] A swap can go only on a finished log wall. A wall blueprint, a window, a door frame, or a wall that already has a swap blueprint takes none.
- [x] A finished roof frame, roof section, or chimney on the wall does not stop a swap. They all stay up.

## Building a swap

- [x] A swap is one construction job. It takes the new piece's build time, 10 seconds, and needs no fetching, because the wall's logs pay for it.
- [x] The player can stop a swap partway and come back later, as with any construction.
- [x] Until the swap finishes, the wall stands whole. It still blocks walking, closes the room, and holds up the roof frame.
- [x] When the swap finishes, the wall turns into the new piece at once. The new piece then works like any other finished window or door frame.
- [x] The wall's 4 debarked logs pay for the new piece's 3. The spare log goes on the ground near the player, on their side of the wall, as when a piece is taken down.
- [x] In the instant playground (`?playground&instant`), a swap finishes the moment it is placed.

## Taking down

- [x] Taking down a swap blueprint leaves the wall as it was. Nothing is lost.
- [x] A wall with a swap blueprint on it cannot come down. The refusal is the usual "take down what stands on it first".

## Saving and the rest

- [x] A swap blueprint and its progress are saved. The save version goes up, and older saves are upgraded when loaded (ADR 0011).
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover placing a swap, the corner refusal, the spare log, a swap under a roof, cancelling, and the wall's take-down refusal.
- [x] `GLOSSARY.md` defines the swap. This is done already.

## Not in this ticket

- Swapping a window or door frame back to a log wall
- Swapping a window for a door frame, or a door frame for a window
- Swapping on a wall blueprint. Taking a blueprint down is already instant and loses nothing.
