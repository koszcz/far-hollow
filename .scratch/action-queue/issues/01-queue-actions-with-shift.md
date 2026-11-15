# 01: Queue actions with Shift and do them in order

**What to build:** The player can add up to 4 actions to a queue with Shift, and the player does them one after another. A plain action still replaces everything, as today.

**Status:** needs-triage

**Assets:** None.

- [ ] A Shift-click on an action in an action menu adds it to the end of the queue.
- [ ] Shift+E queues the main action of the nearest thing in reach. Shift with a number key queues that backpack content's main action.
- [ ] The queue holds at most 4 actions, counting the one under way. When it is full, Shift does nothing and the game says why.
- [ ] Greyed actions cannot be queued.
- [ ] Pausing, skipping time, placing a blueprint, opening a menu, and the chest and shelf panels never queue.
- [ ] With an empty queue, a queued action starts at once.
- [ ] When the action under way is finished, the next one starts.
- [ ] If the next action cannot be done when its turn comes, the game shows why, drops it, and starts the one after.
- [ ] Fishing and sitting stop as soon as another action waits behind them. Sleeping runs until the player wakes, then the queue carries on.
- [ ] A plain click, E, or number key empties the queue and starts that action at once.
- [ ] Walking with the movement keys, and a plain click on the ground, empty the queue.
- [ ] A collapse empties the queue.
- [ ] The game view lists the queued actions, so the UI and tests can read them.
- [ ] The queue is not saved.
- [ ] `GLOSSARY.md` defines the action queue as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover adding, the limit of 4, running in order, dropping a refused action, endless actions, and emptying the queue.
