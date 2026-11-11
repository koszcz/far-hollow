# 05: Log walls and door frames

**What to build:** The player builds log walls and door frames on the edges of foundations. Walls block walking. Door frames let the player through. Walls between the camera and the player fade out.

**Blocked by:** 04 (Foundation)

**Status:** ready-for-agent

**Assets:** Reuse `player` and `debarked-log`. Add the drafts `log-wall` and `door-frame`, with build stages.

- [ ] The build menu lists the log wall and the door frame, each with its cost in debarked logs.
- [ ] Walls and door frames snap to the edges of finished foundations. R picks which edge.
- [ ] One edge holds at most one wall or door frame, even where two foundations meet.
- [ ] They are built by delivering debarked logs, like a foundation.
- [ ] A finished log wall blocks walking and pathfinding. A door frame does not.
- [ ] Walls between the camera and the player fade out.
- [ ] Blueprints and finished pieces are saved.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover edge snapping, the one-per-edge rule, and walking around walls.
