# 02: Show the queue in the top left corner and cancel by click

**What to build:** The queued actions show as a row of icons beside the clock. A click on an icon cancels that action.

**Blocked by:** 01 (Queue actions with Shift)

**Status:** resolved

**Assets:** Reuse `backpack-icons`, `build-icons`, `furniture-icons`, and `sled-icon`. Add the draft `action-queue-icons`.

- [x] The queue shows as a row of up to 4 icons in the top left corner, beside the clock.
- [x] The action under way comes first and is a little larger than the rest.
- [x] Each icon shows what the action works on. Hovering an icon shows the action's name.
- [x] A click on an icon cancels that action. Cancelling the action under way stops it and starts the next one.
- [x] With an empty queue, the row shows nothing.
- [x] The row matches the HUD's "smoked walnut" look.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover which icon each action gets, and cancelling the first, a middle, and the last action.

## Comments

- The game cancels a queued action with a new command, `cancelQueuedAction`, given the action's place in the queue. It never waits in the queue itself.
- A new client method, `describeThing`, says what a thing is by its entity id, so the row can show the structure a take-down works on, the food a forage spot holds, and what a pile holds.
- Logs and debarked logs reuse their approved build material icons. The draft `action-queue-icons` adds only a tree, the river, and a spot on the ground.
- See the row with `/?asset=action-queue-icons`.
