# 04: The action queue becomes its own module

**What to build:** The action queue lives in its own sim module. It asks each command's rule whether the action under way is done, instead of guessing from the player's task components. `src/sim/game.ts` only calls it each step.

**Blocked by:** 02

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

The action queue lives in closure variables inside `createGame` (`src/sim/game.ts:262-266`): `actionQueue`, `cancelCount`, and `castsWhenFishingBegan`. Its logic is spread over `sendOnItsOwn`, `queueAction`, `moveQueueOn`, and `endlessActionDone` (`game.ts:955-1024`).

It decides that an action is done when `playerIsBusy` (`src/sim/activity.ts`) finds no task component on the player. This guess has needed fixes:

- f41bf0e added one line to `TASK_PARTS`, so walking to lay a bedroll counted as work under way.
- d3ab2ac added fishing-only code to `game.ts`, so a queued fishing trip ends after one fish.
- `endlessActionDone` special-cases sitting and fishing by name.

It also spots "this command stopped what the player was doing" by comparing `cancelCount` before and after.

## What to do

1. Design the module's interface with the owner before you write it. Settle these questions:
   - What does a command rule report so the queue knows its action is done? For example, an optional `isDone` beside `refusal` and `run`.
   - Which actions have no end, and what ends them when another action waits?
   - Does `TASK_PARTS` survive, or does each rule's answer replace it?
2. Move the queue state and its four functions into the new module.
3. Replace the sitting and fishing special cases with the rules' own answers.
4. Add a short unit test file for the module that does not need a whole game, if the interface allows it.

## Acceptance criteria

- [ ] `game.ts` holds no queue state. It calls the queue module to receive commands and to move on each step.
- [ ] Nothing in the queue module names sitting, fishing, or any other activity.
- [ ] A new action that never ends needs no edit to the queue module.
- [ ] Existing tests in `src/sim/action-queue.test.ts` pass unchanged.

## Comments
