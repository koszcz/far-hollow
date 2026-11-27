# 32: Share one set of test helpers across the sim test helper files

**What to build:** The files `bed-`, `planks-`, `rain-barrel-`, `sled-`, `take-down-`, `window-` and `wood-box-test-helpers.ts` in `src/sim/` each copy the same helpers: `send`, `stepUntil`, `runSeconds`, `onlyPlayer`, `idOf`, `openSquareNearPlayer`, `place`, `buildFully`, and `onlyBlueprint`. `src/sim/test-steps.ts` already exports `stepUntil` and `onlyPlayer`. Move the copies into one shared set of test helpers, and have each helper file import from it. Keep each file's own helpers where they are.

**Blocked by:** None

**Status:** idea

**Assets:** None. This ticket changes test code only.

Questions for grilling:

- Does the shared set extend `src/sim/test-steps.ts` or live in a new module?
- Do the copies differ in small ways that a shared version must keep?
- Does `bun test` report the same number of tests before and after?
