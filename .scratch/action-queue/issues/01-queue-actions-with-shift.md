# 01: Queue actions with Shift and do them in order

**What to build:** The player can add up to 4 actions to a queue with Shift, and the player does them one after another. A plain action still replaces everything, as today.

**Status:** resolved

**Assets:** None.

- [x] A Shift-click on an action in an action menu adds it to the end of the queue.
- [x] Shift+E queues the main action of the nearest thing in reach. Shift with a number key queues that backpack content's main action.
- [x] The queue holds at most 4 actions, counting the one under way. When it is full, Shift does nothing and the game says why.
- [x] Greyed actions cannot be queued.
- [x] Pausing, skipping time, placing a blueprint, opening a menu, and the chest and shelf panels never queue.
- [x] With an empty queue, a queued action starts at once.
- [x] When the action under way is finished, the next one starts.
- [x] If the next action cannot be done when its turn comes, the game shows why, drops it, and starts the one after.
- [x] Sitting stops as soon as another action waits behind it. Fishing stops once a fish bites, so each queued fishing trip catches one fish. Sleeping runs until the player wakes, then the queue carries on.
- [x] A plain click, E, or number key empties the queue and starts that action at once.
- [x] Walking with the movement keys, and a plain click on the ground, empty the queue.
- [x] A collapse empties the queue.
- [x] The game view lists the queued actions, so the UI and tests can read them.
- [x] The queue is not saved.
- [x] `GLOSSARY.md` defines the action queue as the spec does.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover adding, the limit of 4, running in order, dropping a refused action, endless actions, and emptying the queue.

## Comments

- The game has no movement keys for walking. WASD pans the camera. Walking is a click on the ground, and that empties the queue.
- The game view lists the queue as `actionQueue`: a list of commands, with the action under way first. Ticket 02 can pick each icon from its command.
- A plain action that does not stop the work under way, such as eating, drops the actions waiting, but the work under way stays first in the queue.
- After loading a game, the work under way is not in the queue. A Shift action then starts at once and stops that work.
- The owner changed the fishing rule after the first landing: with an action waiting, fishing catches one fish, then stops. Queueing fishing 3 times catches 3 fish.
