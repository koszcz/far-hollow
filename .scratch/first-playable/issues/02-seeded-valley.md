# 02: Seeded valley with a river and trees

**What to build:** When the game starts, it generates a valley from a seed and shows it. The valley is bounded, about 1 km², has one river, and holds thousands of trees. The same seed always makes the same valley.

**Blocked by:** 01 (Project skeleton with an empty scene)

**Status:** resolved

- [x] The valley's terrain, river, and tree positions come only from the seed.
- [x] Unit tests show the same seed always gives the same valley, and different seeds give different valleys.
- [x] The valley is bounded and about 1 km².
- [x] Each valley has exactly one river.
- [x] Trees are drawn in batches, so thousands of them stay within the frame-rate targets in the spec.
- [x] All visuals use the approved code-built placeholder shapes.
- [x] A fixed camera shows the valley until camera controls exist.
