# 02: Plant a mushroom on a log

**What to build:** The player can plant a mushroom on a loose log to make a mushroom log that bears mushrooms near camp. See `.scratch/garden/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `mushrooms`, the log model, and `backpack-icons`. Add the draft `mushroom-log`.

- [ ] "Plant mushroom" sits in the action menu of a plain log lying loose on the ground, when the backpack holds a mushroom. The log's main action does not change.
- [ ] A debarked log, or a log on a sled, a woodpile, or the shoulder, does not offer it.
- [ ] Planting uses 1 mushroom, takes a few seconds, and needs no tool. The log becomes a mushroom log where it lies.
- [ ] A mushroom log bears its first mushrooms 2 days after planting. The player forages it like a mushroom patch, and it grows them back 3 days after each forage.
- [ ] A mushroom log cannot be picked up, put on a sled or woodpile, or built with. It never rots and does not block walking.
- [ ] The player can take down a mushroom log. It vanishes and gives nothing back.
- [ ] A blueprint or foundation that would cover a mushroom log is refused with the reason (ADR 0008).
- [ ] If ticket 01 has landed, a berry bush cannot be planted within 1 m of a mushroom log.
- [ ] Mushroom logs and their growth are saved. The save version goes up, and older saves are upgraded when loaded (ADR 0011).
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover which logs allow planting, first mushrooms after 2 days, foraging and growing back, taking down, the build refusal, and saving.
