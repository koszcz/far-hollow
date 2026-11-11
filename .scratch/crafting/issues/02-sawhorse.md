# 02: Sawhorse

**What to build:** The build menu gains a sawhorse. It costs two debarked logs. The sawhorse is the first work station. See `.scratch/crafting/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `debarked-log` and `hud`. Add the draft `sawhorse` with build stages.

- [x] The build menu lists the sawhorse and its cost of two debarked logs.
- [x] The sawhorse places like other structures. R rotates it. It does not need a foundation.
- [x] The player delivers debarked logs to its blueprint and builds it like other structures.
- [x] The player can take down a sawhorse blueprint or a finished sawhorse and get back every material.
- [x] The game can tell a finished sawhorse from a blueprint, so ticket 03 can treat only finished ones as work stations.
- [x] Sawhorses are saved. The save version goes up.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover placing, building, taking down, and saving a sawhorse.
