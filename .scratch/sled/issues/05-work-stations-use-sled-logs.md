# 05: Work stations use logs on a parked sled

**What to build:** A station recipe can use logs and debarked logs on a sled parked next to the station, the same as logs lying next to it.

**Blocked by:** 02 (Load and unload a parked sled)

**Status:** ready-for-agent

**Assets:** Reuse `sled` and `sawhorse`.

- [ ] Cutting planks at a sawhorse can use a debarked log on a sled parked next to it.
- [ ] The craft menu counts logs on a parked sled next to the station as available.
- [ ] A sled the player is dragging does not count.
- [ ] Unit tests cover a recipe that uses a sled log, and one where the sled is being dragged.
