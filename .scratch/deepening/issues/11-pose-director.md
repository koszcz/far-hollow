# 11: Move the choice of player pose out of the scene renderer

**What to build:** One module, the pose director, decides each frame which motion the player plays, where they stand, and which way they face. It takes the player's sim state and the time, and returns plain data. The player mesh applies that data. The scene renderer only draws.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset. Every pose must look the same before and after.

## Why

About 390 of the 791 lines in `src/render/scene-renderer.ts` choose the player's pose (roughly lines 290 to 680, including `posePlayer` and `poseSitting`). That code keeps 12 mutable flags between frames, such as `sleeping`, `seated`, `rising`, `reachDrawn`, `castDrawn`, and `sawingStep`. The order of priority (sleep, then sit, then eat over walking, then the sawing stance, then reach, then walk) is hidden in early returns.

No test covers this code, because it only runs with a three.js renderer and mesh. ADR 0012 gave each motion its own module, but the choice between motions stayed in the renderer. The file changed 51 times in the last 200 commits.

This is also the natural seam for file-length ticket 11, which splits `scene-renderer.ts`.

## Acceptance criteria

- [ ] The pose director runs without three.js.
- [ ] Frame-sequence tests cover cases that are now checked only by eye, such as "a bite plays over walking but stops when work starts" and "the player rises from a stool, then steps back".
- [ ] Every pose looks the same before and after. Compare shots with `bun scripts/shot.ts` and a script, as `docs/agents/game-testing.md` describes.
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Should this ticket replace file-length ticket 11, or land first so that ticket 11 splits what is left?
- Does the pose director keep its memory between frames itself, or does the caller pass the last decision back in?
- Does the walk distance (`playerWalkedMetres`) belong to the pose director or to the player mesh?
