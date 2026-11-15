# 02: Show the queue in the top left corner and cancel by click

**What to build:** The queued actions show as a row of icons beside the clock. A click on an icon cancels that action.

**Blocked by:** 01 (Queue actions with Shift)

**Status:** needs-triage

**Assets:** Reuse `backpack-icons`, `build-icons`, `furniture-icons`, and `sled-icon`. Add the draft `action-queue-icons`.

- [ ] The queue shows as a row of up to 4 icons in the top left corner, beside the clock.
- [ ] The action under way comes first and is a little larger than the rest.
- [ ] Each icon shows what the action works on. Hovering an icon shows the action's name.
- [ ] A click on an icon cancels that action. Cancelling the action under way stops it and starts the next one.
- [ ] With an empty queue, the row shows nothing.
- [ ] The row matches the HUD's "smoked walnut" look.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover which icon each action gets, and cancelling the first, a middle, and the last action.
