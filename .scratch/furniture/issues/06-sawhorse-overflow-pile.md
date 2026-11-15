# 06: Planks that do not fit drop beside the sawhorse

**What to build:** Cutting planks at the sawhorse no longer stops when the backpack is full. The planks that fit go into the backpack. The rest drop in a pile beside the sawhorse.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `sawhorse`, `sawing-animation`, and the plank shape in `pile`.

- [x] Cutting planks starts even when the four planks would not fit in the backpack.
- [x] When the cut finishes, planks go into the backpack as far as it has room.
- [x] The planks left over drop in one pile beside the sawhorse. They join a plank pile already within 1 m, as dropped things do.
- [x] A short message says how many planks dropped beside the sawhorse.
- [x] The craft menu no longer warns that the planks will not fit.
- [x] Other recipes still refuse to start when the result would not fit.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover a cut with room for all, some, and none of the planks.
