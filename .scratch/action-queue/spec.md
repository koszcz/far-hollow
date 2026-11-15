# Action queue: spec

Today every action the player picks stops what they were doing. This feature adds the **action queue**: the player can line up to 4 actions, and the player does them in order. The queue shows in the top left corner, and a click on an action there cancels it.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies.

## Goals

- The player can plan a short run of work, such as "chop this tree, pick up that stick, add fuel to the fire", and watch it happen.
- The player can always see what is lined up, and cancel any part of it.
- Playing without the queue works exactly as it does today.

## Adding actions to the queue

- A Shift-click on an action in an **action menu** adds that action to the end of the queue.
- Shift+E adds the **main action** of the nearest thing in **reach** to the queue.
- Shift with a hotbar number key adds that backpack content's main action to the queue.
- The queue holds at most 4 actions, counting the one under way. When it is full, a Shift-click does nothing and the game says why.
- An action that is greyed out cannot be queued.
- With an empty queue, a queued action starts at once, as a plain click would.

These keep working as today, and are never queued:

- Pausing, skipping time, and the speed controls.
- Placing a blueprint in build mode.
- Opening a menu, such as a work station's menu or a chest.
- Moving contents in the chest or shelf panel. Shift-click there still moves all that fit.

## Running the queue

- The player does the first action in the queue. When it is finished, it leaves the queue and the next one starts.
- An action is finished when the player has nothing left to do for it: the work is done, they have arrived, or the thing is gone.
- If the next action cannot be done when its turn comes, the game shows why, drops it, and starts the one after.
- Actions with no end, such as fishing or sitting on a stool, stop as soon as another action waits behind them.
- Sleeping runs until the player wakes, then the queue carries on.
- A collapse empties the queue.

## Replacing the queue

- A plain click on an action, E, or a number key empties the queue and starts that action at once, as today.
- Walking with the movement keys empties the queue.
- A plain click on the ground empties the queue and walks there.

## Showing and cancelling the queue

- The queue shows as a row of up to 4 icons in the top left corner, beside the clock.
- The action under way comes first, and is a little larger than the rest.
- Each icon shows what the action works on, such as a tree, a log, or a campfire. Hovering an icon shows the action's name, such as "Chop".
- A click on an icon cancels that action. Cancelling the action under way stops it and starts the next one.
- With an empty queue, the row shows nothing.

## Saving

- The queue is not saved. A loaded game starts with only the action that was under way, as today.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `action-queue-icons` | Icons for queued actions on things that have no icon yet, such as a tree, the river, a campfire, or the ground |

Actions on backpack contents, structures, furniture, and the sled reuse `backpack-icons`, `build-icons`, `furniture-icons`, and `sled-icon`.

## Tickets

1. Queue actions with Shift and do them in order.
2. Show the queue in the top left corner and cancel by click. Blocked by 01.

## Not in this feature

- Reordering queued actions.
- Repeating an action, such as "chop every tree here".
- Saving the queue.
