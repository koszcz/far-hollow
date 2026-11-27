# 11: The player posing module returns a pose instead of moving the mesh

**What to build:** The player posing module decides each frame which motion the player plays, where they stand, and which way they face. It takes the player's sim state and the time, and returns plain data. The player mesh applies that data. Tests can then check the pose without three.js.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset. Every pose must look the same before and after.

## Why

File-length ticket 11 moved the pose code out of `src/render/scene-renderer.ts` into `src/render/player-posing.ts` (392 lines). The move gave the code its own file, but its interface is still shallow:

- `PlayerPosing` has 9 members, and callers must call them in a set order. For example, `startSleepIfNew` must run before the player is placed, and `startEatOrDrinkIfNew` must run before `pose`.
- `pose` returns nothing. It moves the player mesh directly, so a test needs a real mesh to see what it did.
- The module keeps many mutable flags between frames, such as `reachDrawn`, `seated`, `rising`, `castDrawn`, and `sawingStep`.
- The order of priority (sleep, then sit, then eat over walking, then the sawing stance, then reach, then walk) is hidden in early returns.

No test covers this choice. ADR 0012 gave each motion its own module, and the per-motion pose tests (such as `player-eat-drink-pose.test.ts`) test single motions. Nothing tests which motion wins. Before the split, `scene-renderer.ts` changed 51 times in the last 200 commits.

## Acceptance criteria

- [ ] The pose decision runs without three.js.
- [ ] Callers no longer need to call members in a set order.
- [ ] Frame-sequence tests cover cases that are now checked only by eye, such as "a bite plays over walking but stops when work starts" and "the player rises from a stool, then steps back".
- [ ] Every pose looks the same before and after. Compare shots with `bun scripts/shot.ts` and a script, as `docs/agents/game-testing.md` describes.
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Does the posing module keep its memory between frames itself, or does the caller pass the last decision back in?
- Does the walk distance belong to the posing module or to the player mesh?
- Should the sleep and eat-or-drink start-up fold into one call per frame?
