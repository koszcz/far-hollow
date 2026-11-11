# 04: Foundation

**What to build:** The player places foundations through the build menu. Each covers one grid square. They deliver debarked logs to the blueprint, then build it. Foundations grow legs on slopes and clear stumps under them.

**Blocked by:** 01 (Drawknife and debarking), 02 (Build menu)

**Status:** ready-for-agent

**Assets:** Reuse `player`, `debarked-log`, and `stumps`. Add the draft `foundation`, with legs and build stages.

- [ ] The build menu lists the foundation with its cost in debarked logs.
- [ ] A foundation covers one grid square. Foundations can sit side by side.
- [ ] A foundation blueprint cannot overlap a standing tree.
- [ ] Placing a foundation removes any stump under it for good. That stump never regrows.
- [ ] The player carries a debarked log to a blueprint and clicks the blueprint to add the log. The blueprint shows how many logs it has and needs.
- [ ] Construction spends delivered logs stage by stage. It stops when the delivered logs run out.
- [ ] The finished foundation grows legs down to sloped ground.
- [ ] The player can walk onto and across a finished foundation.
- [ ] Blueprints, delivered logs, and finished foundations are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover delivery, construction, the tree rule, and stump removal.
