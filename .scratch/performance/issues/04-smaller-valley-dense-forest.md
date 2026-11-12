# 04: A smaller valley with dense forest

**What to build:** The valley shrinks from 1 km to 300 m on each side. Trees pack into dense groves, about 4 to 5 m apart, with open clearings between them and around the player's start.

**Status:** resolved

**Assets:** Reuses `trees`, `terrain`, `river`, `sticks`, `berry-bush`, and `mushrooms`. No asset changes how it looks.

## Why

The owner does not need a large map, and prefers a smaller one with denser forest. The old valley spread 4,000 trees about 16 m apart over 1 km², which drew a lot and felt sparse.

## Decisions

The owner chose these in chat on 2026-11-12:

- The valley is 300 m × 300 m.
- Forest grows in dense groves broken by clearings, so there is room to build a camp.
- Saves from the 1 km valley are dropped: their trees, sticks, and buildings stand where the new valley has other ground.

## Acceptance criteria

- [x] The valley is 300 m on each side. Hills, river wander, and valley sides are scaled down to fit.
- [x] 2,600 trees grow in groves, about 4 to 5 m apart. About a third of the land away from the river is clearing.
- [x] No tree grows within 16 m of where the player starts.
- [x] Sticks (700), berry bushes (60), and mushroom patches (80) scale down with the valley.
- [x] The camera zooms out to at most 400 m.
- [x] A save from before the change shows as broken in its slot and cannot be loaded. Continuing one starts a new game.

## Comments

### 2026-11-12: Result

- `src/sim/valley.ts` holds the new size, the grove noise, and the start clearing. `startSpotBeside` is now the one place that says where the player starts, used by both tree placement and `playerStartSpot`.
- The save upgrade `turnAwayLargeValley` (version 21 to 22) empties an older save, so the shape check turns it away. Older upgrades stay in the list, as the rules for upgrades require.
- Tests that check an older upgrade now load their save through `LARGE_VALLEY_UPGRADES`, the upgrades before the valley shrank. `readSave` takes an upgrade list for this, like `upgradeSave` already did.

Measured with `measure.ts` on the owner's M3 Pro, seed 12345, pixel ratio 2:

| View | Frame time, GPU waited on |
| --- | --- |
| Starting view | about 12 ms (2.5 million vertices) |
| Zoomed out halfway | about 16 ms |
| Zoomed fully out | about 10.5 ms |

Halfway zoomed out is the busiest view: many trees are within 150 m of the camera, so they draw at full detail. Lowering `FAR_TREE_METRES` would help there, at the cost of far shapes showing nearer.
