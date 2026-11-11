# 03: Lean-to

**What to build:** The player builds a lean-to from sticks and bark through the build menu. Under its roof, rain does not drain warmth, and sleeping restores fatigue faster.

**Blocked by:** 01 (Drawknife and debarking), 02 (Build menu)

**Status:** resolved

**Assets:** Reuse `player` and `bedroll`. Add the draft `lean-to`, with build stages.

- [ ] The build menu lists the lean-to with its cost in sticks and bark.
- [ ] The lean-to is placed and built like a campfire: a blueprint, then the held build action. It spends sticks and bark from the backpack stage by stage.
- [ ] A lean-to blueprint cannot overlap a standing tree.
- [ ] The finished lean-to blocks walking at its back and sides. The player can walk in at the open front.
- [ ] A player under the lean-to's roof is not "in the rain": rain does not drain their warmth.
- [ ] The roof check is general, so cabin roofs in ticket 06 can use it.
- [ ] Sleeping on a bedroll under a roof restores fatigue faster than in the open.
- [ ] Blueprints and finished lean-tos are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover the cost, placement rules, the roof check, and faster sleep.
