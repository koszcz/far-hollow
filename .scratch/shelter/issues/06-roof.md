# 06: Roof

**What to build:** The player builds roof sections over foundation squares that have walls under them. A cabin roof keeps the rain off like a lean-to. The roof above the player hides when they are inside.

**Blocked by:** 03 (Lean-to), 05 (Log walls and door frames)

**Status:** resolved

**Assets:** Reuse `player`, `debarked-log`, and `bark`. Add the draft `roof`, with build stages.

- [ ] The build menu lists the roof with its cost in debarked logs and bark.
- [ ] A roof covers one foundation square. It needs at least one wall or door frame on that square's edges.
- [ ] It is built by delivering debarked logs and spending bark from the backpack.
- [ ] A finished cabin roof counts as a roof overhead, using the roof check from ticket 03.
- [ ] When the player stands under a roof, the roof above them hides.
- [ ] Blueprints and finished roofs are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover the wall rule, the roof check, and costs.
