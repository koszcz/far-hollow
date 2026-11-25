# 01: Turn the cabin cutaway on and off by hand

**What to build:** The automatic cutaway does not work well in play. Until it does, the player turns the cutaway on and off with a button on the HUD. With it on, every cabin roof and roof frame hides, and every cabin side whose outside faces the camera fades. With it off, nothing hides. A wall between the camera and the player still fades either way. The owner asked for this in chat on 2026-11-25.

**Status:** resolved

**Assets:** Add the draft `cutaway-button`: a small round HUD button left of the sound button, with a cabin icon whose roof is lifted off. It shows amber while the cutaway is on.

## Acceptance criteria

- [x] A round button sits left of the sound button. Its label reads "See inside cabins" while the cutaway is off, and "Show cabin roofs" while it is on.
- [x] With the cutaway on, every cabin roof section and roof frame hides, wherever the player stands.
- [x] With the cutaway on, every cabin side whose outside faces the camera fades.
- [x] With the cutaway off, no roof hides, and only a wall between the camera and the player fades.
- [x] The cutaway starts off. It is not saved.
