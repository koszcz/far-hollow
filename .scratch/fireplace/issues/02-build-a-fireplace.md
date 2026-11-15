# 02: Build a fireplace from stone

**What to build:** The player can build a fireplace from 12 stone on a foundation square, and take it down again. This ticket adds only the unlit fireplace. Fuel, fire, and heat come in ticket 03.

**Blocked by:** 01 (Gather stone)

**Status:** ready-for-agent

**Assets:** Reuse `stone`. Add the drafts `fireplace` and `fireplace-icon`.

- [ ] The build menu lists the fireplace with its cost of 12 stone, and shows its icon.
- [ ] The blueprint snaps to a grid square. R turns it to face any of the four sides. A click places it. Esc cancels.
- [ ] The blueprint needs a finished foundation under it. The square must hold no campfire and no furniture.
- [ ] A fireplace can be placed with or without walls and a roof around it.
- [ ] The blueprint takes stone from the backpack and from stone piles within 2 m. It keeps what it has been given, over several trips.
- [ ] The player holds the build action for 24 seconds in all to build it. Building needs no tool.
- [ ] The fireplace shows its build stages.
- [ ] A fireplace and its blueprint block walking.
- [ ] Furniture and campfires cannot be placed on a square that holds a fireplace or its blueprint.
- [ ] The player can take down a fireplace or its blueprint and get back every stone given so far.
- [ ] Fireplaces and their blueprints are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a fireplace spends no stone.
- [ ] `GLOSSARY.md` describes the fireplace as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, stone delivered over several trips and from piles, building, and taking down.
