# Every older save stays playable

Every change that would break an older save comes with a save upgrade in `SAVE_UPGRADES` in `src/sim/save.ts`. No change may make an older save unplayable. This is a hard rule, not a preference. It holds even when turning older saves away would be cheaper, or when the upgrade has to guess at data the older save does not hold.

We chose this because a save holds the player's camp, which can take many hours to build. Losing it to an update costs the player far more than writing an upgrade costs us.

## Consequences

- When an upgrade cannot carry something over exactly, it picks the nearest playable state. For example, it can drop work in progress, but it keeps the camp and the backpack.
- One exception was made before this rule existed. Saves made in the 1 km valley are turned away (`turnAwayLargeValley` in `src/sim/save.ts`), because the valley shrank to 300 m. No ticket is planned to undo it. Do not make another exception.
