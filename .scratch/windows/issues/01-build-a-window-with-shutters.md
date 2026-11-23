# 01: Build a window and hang shutters that open and close

**What to build:** The player can build a window into an empty foundation edge and hang shutters in it. The player opens and closes the shutters by hand. Closed shutters keep the room snug. See `.scratch/windows/spec.md`.

**Blocked by:** None

**Status:** resolved

**Assets:** Add the drafts `window` (a log wall with an opening, built in courses like the log wall), `shutters` (two plank shutters on hinges, open or closed), `shutter-swing` (the shutters swinging open and closed), and `window-icons` (build menu icons for the window and the shutters). Reuse `debarked-log` where it shows. Decided with the owner on 2026-11-22.

## Building a window

- [x] The build menu lists the window after the door frame. It costs 3 debarked logs and takes 10 seconds to build. It needs no tool beyond what a log wall needs.
- [x] A window is an edge piece. It snaps to an empty edge of a finished foundation square, as a log wall does, and R turns it.
- [x] A window cannot go on an edge that holds a log wall, door frame, or window, finished or as a blueprint.
- [x] The door frame's corner rule applies to windows: a window cannot meet another edge piece at a right angle at a corner. The refusal says why (ADR 0008).
- [x] A window can go on the second storey wherever a log wall can. (No second storey exists yet. The window uses the log wall's placement rule, so it follows the log wall there.)
- [x] A finished window blocks walking like a log wall.
- [x] A finished window counts as a closed side of a room. It holds up a roof frame like a log wall.
- [x] A finished window between the camera and the player fades out, like a log wall.

## Shutters

- [x] The build menu lists the shutters after the door. They cost 2 planks and take 4 seconds to build.
- [x] A shutters blueprint snaps to the nearest finished window that has no shutters, and takes its edge and facing.
- [x] Finished shutters start closed.
- [x] The main action of finished shutters is "Open shutters" when they are closed and "Close shutters" when they are open. It is quick, not timed work. The player first walks within reach.
- [x] The shutters swing open or closed when the player changes them. Nothing else opens or closes them.
- [x] Open or closed, shutters never change where the player can walk.

## Snug rooms

- [x] A room is snug only when every window on its edges has finished, closed shutters, as well as a floor on every square and a door in every door frame.
- [x] Opening the shutters makes the room stop being snug at once. Closing them makes it snug again.
- [x] Rain never falls indoors, whatever the shutters' state.

## Taking down

- [x] Shutters can come down on their own, open or closed, and give back their planks.
- [x] A window with shutters, finished or as a blueprint, cannot come down. The refusal says to take the shutters down first.
- [x] A window that holds up a roof frame cannot come down, like a log wall.
- [x] Taking down a window gives back its debarked logs.

## Saving and the rest

- [x] A window is saved with its edge and facing. Shutters are saved with their state, open or closed. The save version goes up, and older saves are upgraded when loaded (ADR 0011).
- [x] The journal gets no new goal.
- [x] `GLOSSARY.md` defines the window and the shutters, and room and snug count windows. This is done already.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover the costs, placement and the corner rule, blocking, rooms with windows, snug with open, closed, and missing shutters, opening and closing, the take-down refusals, and saving.
