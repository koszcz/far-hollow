# An approach stores the command that started it

When the player must walk to a thing or a spot before acting, one module owns that walk, the approach. The player's pending approach stores the command that started it, as plain data. When the player arrives, the game checks the command's refusal again and then carries out the command's act step. It does not send the command again.

We chose this because it gives one saved component in place of the 22 task components each activity kept for its own walk. A command is already plain data, so a save made mid-walk loads and the player carries on, as before. Checking the refusal again on arrival uses the same rule as the action menu (ADR 0008), so a thing that is gone by the time the player arrives gives its reason.

Timed work, such as chopping or debarking, still keeps its own component. That component starts on arrival and holds how far the work has got.

## Considered options

- **The approach is not saved, as the hand reach is not**: rejected. A save made mid-walk would stop the player on load, which changes how the game plays.
- **Arrival sends the command again**: rejected. The action queue would take it for a new command and could clear or reorder the queue.

## Consequences

- Older saves upgrade each walk-only task component, and each timed task saved before its work began, to an approach. The upgrade writes the command shapes as literals, so later changes to a command do not change what the upgrade does.
- A walk that ends out of reach ends the approach, and nothing retries it. There is a notice only when a wall stands between the player and the thing: "You can't get to it from here." Otherwise there is no notice.
- An approach starts only if its walk ends within reach. If no walk does, such as into a cabin with no way in, the player stays put and sees the same notice.
