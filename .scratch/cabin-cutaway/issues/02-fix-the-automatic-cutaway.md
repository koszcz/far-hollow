# 02: Choose a wall mode: walls up, cutaway, or walls down

**What to build:** The cutaway button becomes a wall mode button with three wall modes: walls up, cutaway, and walls down. What hides and fades depends only on the wall mode and the camera, never on where the player stands. The owner reported on 2026-11-25 that the automatic cutaway, which followed the player into a cabin, was "out of sync" in play. In grilling the same day, the owner chose wall modes like other building games use. The rule for being inside a cabin goes away. See ADR 0013.

**Status:** ready-for-agent

**Assets:** Change the draft `cutaway-button` (approved for change by the owner on 2026-11-25, still a draft). It gets one icon per wall mode: a cabin with its roof for walls up, a cabin with its roof lifted off for cutaway (today's icon), and low walls with no roof for walls down. It no longer shows amber. Update its catalogue entry and its showcase to show all three icons.

## Wall modes

- [ ] Walls up: no cabin roof or roof frame hides, and no cabin side fades.
- [ ] Cutaway: every cabin roof section and roof frame hides. Every cabin side whose outside faces the camera fades: its walls, door frames, windows, doors, shutters, and window glow. This is what the button's "on" setting does today.
- [ ] Walls down: every cabin roof section and roof frame hides. Every cabin side fades, whichever way it faces.
- [ ] In every wall mode, a wall, door frame, window, door, or set of shutters between the camera and the player fades, as it does today.
- [ ] Where the player stands changes nothing else. Walking into or out of a cabin never shows or hides a roof.

## The button

- [ ] The button sits where the cutaway button sits now, left of the sound button.
- [ ] Each click moves to the next wall mode: walls up, then cutaway, then walls down, then walls up again.
- [ ] The icon shows the current wall mode.
- [ ] The label and tooltip name the wall mode the next click switches to: "Show cutaway" in walls up, "Show walls down" in cutaway, and "Show walls up" in walls down.
- [ ] The game starts in cutaway. The wall mode is not saved.
- [ ] There is no keyboard shortcut.

## Code and docs

- [ ] The wall mode is one plain type with its order and its next mode in a module of pure functions (ADR 0009).
- [ ] The code that finds the cabin around the player, `cabinCutaway` and its doorway rule, is removed with its tests. Only the cutaway uses `roofAbove` in `src/sim/roofs.ts` today. Remove it with its tests too if nothing else uses it.
- [ ] Tests cover each wall mode: which roofs hide and which sides fade for a camera at a corner of a cabin.
- [ ] Comments in `src/render/cabin-cutaway.ts` and `src/strings.ts` describe wall modes, not the old rule.
- [ ] `GLOSSARY.md` defines wall mode, walls up, cutaway, and walls down. This is done already.
- [ ] ADR 0013 records why wall modes follow the camera. This is done already.
