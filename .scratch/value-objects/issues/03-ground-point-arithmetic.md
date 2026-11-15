# 03: Give ground points their own arithmetic

**What to build:** Add arithmetic for `GroundPoint` beside `groundDistance`, following ADR 0009. Callers that add, subtract, or scale ground points use it instead of writing out `x` and `z` by hand. The game behaves exactly as before.

**Status:** ready-for-agent

**Assets:** None. This ticket changes no asset.

## Why

`GroundPoint` is already half a value object. `groundDistance` and `nearestWithin` live with it in `src/sim/valley.ts`. But code adds or subtracts two ground points by hand, as `{ x: a.x + b.x, z: a.z + b.z }`, in about 38 places across 25 files. The most are in `src/sim/edge-pieces.ts` (5) and `src/sim/structures.ts` (4). It is easy to mix up `x` and `z`, or a plus and a minus, in one copy.

## What the module holds

Move `GroundPoint` and its functions into `src/sim/ground-point.ts`. Choose the exact names. It needs at least these functions:

- add two points
- subtract one point from another
- scale a point by a number
- the distance between two points (move `groundDistance` here)

## Acceptance criteria

- [ ] `GroundPoint` and its arithmetic live in `src/sim/ground-point.ts`.
- [ ] Code that adds, subtracts, or scales ground points uses the module.
- [ ] Hot loops keep raw numbers where a new object per step would slow the game. Check `src/sim/pathfinding.ts` and `src/sim/walk-map.ts` in particular, and leave a one-line comment where you keep raw numbers on purpose.
- [ ] Unit tests cover each function.
- [ ] `make check` passes.

## Comments

Ticket 01 moves `turnOffset` into the quarter turns module. If both tickets are done, `turnOffset` can use this module's arithmetic.
