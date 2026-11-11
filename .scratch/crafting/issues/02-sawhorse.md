# 02: Sawhorse

**What to build:** The build menu gains a sawhorse. It costs two debarked logs. The sawhorse is the first work station. See `.scratch/crafting/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Assets:** Reuse `debarked-log` and `hud`. Add the draft `sawhorse` with build stages.

- [ ] The build menu lists the sawhorse and its cost of two debarked logs.
- [ ] The sawhorse places like other structures. R rotates it. It does not need a foundation.
- [ ] The player delivers debarked logs to its blueprint and builds it like other structures.
- [ ] The player can take down a sawhorse blueprint or a finished sawhorse and get back every material.
- [ ] The game can tell a finished sawhorse from a blueprint, so ticket 03 can treat only finished ones as work stations.
- [ ] Sawhorses are saved. The save version goes up.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placing, building, taking down, and saving a sawhorse.
