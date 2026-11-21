# 02: Run a command only after its refusal passes

**What to build:** The game checks a command's refusal before it runs the command, for every command. A refused command shows its reason and does nothing. Activity modules stop checking the same rule a second time in their own code.

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

ADR 0008 says one rule serves both the action menu and the work. The code does not enforce this. Each command rule in `commandRules` (`src/sim/game.ts:480-790`) has a `refusal` and a `run`, and `run` checks the rule again in its own way. The two copies already disagree:

- `fishing.fish()` (`src/sim/fishing.ts:64-71`) skips a player without a fishing rod and shows nothing. `fishing.refusal()` reports that the rod is missing.
- `chopping.ts`, `debarking.ts`, and `carrying.ts` also check their rule once in the action and once in `refusal`.
- The `splitLog` rule calls `gathering.refusal` twice with different arguments, plus `splitRefusal`.
- Several rules have no `refusal`, but their `run` still refuses quietly: pick up a stick, forage, sleep, sleep in a bed, sit on a stool, drink from the river, and put in a chest.

The action queue uses refusals to skip actions (`moveQueueOn`, `src/sim/game.ts:991`). A rule whose `run` refuses quietly is still queued. It then counts as finished at once, because the player is not busy.

## What to do

1. In `applyCommand` in `src/sim/game.ts`, call `refusalOf(command)` before `rule.run`. If it returns a refusal, show it as a notice and stop.
2. Give a `refusal` to each rule whose `run` refuses quietly today. Move the check from `run` into `refusal`.
3. Remove the second copy of each check from the activity modules' actions, such as `fishing.fish()`.
4. Keep the check on arrival. A thing can change while the player walks to it, so an activity's `step` still checks the rule when the player gets there. It calls the same refusal function, not a copy.
5. Remove the sentence "`run` checks the same rule again" from the `CommandRule` comment, and say instead that `run` only receives commands whose refusal passed.

## Acceptance criteria

- [ ] `run` is never called for a command whose refusal returns a reason. A unit test sends a refused command and checks that nothing changed and the reason was shown.
- [ ] Each rule that refused quietly now has a `refusal`. A unit test in `src/sim/refusals.test.ts` covers each.
- [ ] Fishing without a rod shows the "needs a tool" reason.
- [ ] A queued action that is refused when its turn comes is skipped with a notice, not counted as done. A test in `src/sim/action-queue.test.ts` covers one of the formerly quiet rules.
- [ ] No activity module's action repeats a check that its rule's `refusal` makes.
- [ ] Existing tests pass, including `src/app/thing-actions.test.ts`.

## Comments
