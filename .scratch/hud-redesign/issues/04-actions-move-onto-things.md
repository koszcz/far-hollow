# 04: Actions move from the panels onto the things

**Status:** resolved

**Blocked by:** 03

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Main action for each thing" and "Context panels" in `../spec.md`. A left-click does each thing's main action. The context panels keep only status.

- [x] A left-click on each thing does the main action in the spec's table. For example, a click on a lit campfire adds firewood.
- [x] The campfire, woodpile, bedroll, and pile panels have no buttons. They still show fuel, pot progress, woodpile contents, and blueprint deliveries.
- [x] The carrying panel is gone. Ticket 05 moves its actions to the hotbar.
- [x] The open chest keeps its panel and grid.
- [x] Every action that a panel button did is still in the thing's right-click menu.
- [x] Tests cover the main action for the campfire, unlit and lit, and the woodpile, with and without a carried log.
