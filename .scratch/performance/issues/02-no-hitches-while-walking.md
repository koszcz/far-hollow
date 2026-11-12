# 02: No hitches while walking

**What to build:** Walking around the valley stays smooth. Clicking to walk and crossing into new undergrowth patches never stalls a frame.

**Status:** resolved

**Assets:** Reuses `grass`, `ferns`, `flowers`, and `pebbles`. No asset changes how it looks.

## Why

The owner saw the frame rate dip while playing on an M3 Pro. Timing each slow frame showed two causes:

- The first click to walk after anything in the world changed (a tree felled, something built or placed) took about 30 ms. The pathfinder splits the 1,000 × 1,000 walk map into regions the player can walk between, and it worked this out again from scratch, one function call per cell.
- Each time the camera's focus crossed into a new 8 m undergrowth patch, the game placed every plant within 80 m again: about 4.5 ms.

## Acceptance criteria

- [x] Finding a path after a map change takes well under one frame. A benchmark with 4,000 blockers on the full-size map went from 42 ms to 6.6 ms.
- [x] Crossing into a new undergrowth patch places only the patches that come into reach: about 2 ms instead of 4.5 ms.
- [x] Pathfinding tests still pass.

## Comments

### 2026-11-12: Result

- `regionsOf` in `src/sim/pathfinding.ts` now walks the map with typed arrays, reuses its arrays between splits, and calls no function per cell. It follows the same stepping rule as `canStep`.
- `src/render/undergrowth-meshes.ts` keeps each grown patch already placed. A changed camp places every patch again, because plants under the camp are left out when a patch is placed.
- No regression test checks the timing: a timing test would be flaky. The existing pathfinding tests cover what the regions decide.
