# 01: Lay a floor on a foundation

**What to build:** The player can lay a plank floor on a foundation square, and take it up again. The floor changes only how the square looks. Ticket 03 gives it a use.

**Status:** needs-triage

**Assets:** Reuse `foundation`. Add the drafts `floor` and `floor-and-door-icons` (floor icon).

- [ ] The build menu lists the floor with its cost of 2 planks, and shows its icon.
- [ ] The blueprint snaps to a finished foundation square. A click places it. Esc cancels.
- [ ] Holding the mouse button and sweeping across squares places a blueprint on each.
- [ ] A square holds one floor. A square with a floor or a floor blueprint takes no second one.
- [ ] A floor can go on a square that holds furniture, a campfire, or a fireplace. Nothing has to move.
- [ ] Planks reach the blueprint from the backpack, a parked sled next to it, and plank piles within 2 m, over several trips.
- [ ] The player holds the build action for 4 seconds to build it. Building needs no tool.
- [ ] The floor shows its build stages.
- [ ] The player walks on a floor as on a bare foundation. Furniture and fires sit on top of it.
- [ ] The player can take down a floor or its blueprint and get back every plank, whatever stands on it.
- [ ] The player cannot take down a foundation that has a floor. The action shows greyed with the reason.
- [ ] Floors and their blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a floor spends no planks.
- [ ] `GLOSSARY.md` describes the floor as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, sweeping, plank delivery, building, and taking down a floor and the foundation under it.
