# 06: Planks that do not fit drop beside the sawhorse

**What to build:** Cutting planks at the sawhorse no longer stops when the backpack is full. The planks that fit go into the backpack. The rest drop in a pile beside the sawhorse.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Reuse `sawhorse`, `sawing-animation`, and the plank shape in `pile`.

- [ ] Cutting planks starts even when the four planks would not fit in the backpack.
- [ ] When the cut finishes, planks go into the backpack as far as it has room.
- [ ] The planks left over drop in one pile beside the sawhorse. They join a plank pile already within 1 m, as dropped things do.
- [ ] A short message says how many planks dropped beside the sawhorse.
- [ ] The craft menu no longer warns that the planks will not fit.
- [ ] Other recipes still refuse to start when the result would not fit.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover a cut with room for all, some, and none of the planks.
