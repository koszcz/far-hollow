# 02: Hang a door in a door frame

**What to build:** The player can hang a plank door in a door frame. The door opens by itself as the player walks through, and closes behind them.

**Status:** needs-triage

**Assets:** Reuse `door-frame`. Add the drafts `door`, `door-animation`, and `floor-and-door-icons` (door icon).

- [ ] The build menu lists the door with its cost of 3 planks, and shows its icon.
- [ ] The blueprint snaps to a finished door frame that has no door. A click places it. Esc cancels.
- [ ] Planks reach the blueprint from the backpack, a parked sled next to it, and plank piles within 2 m, over several trips.
- [ ] The player holds the build action for 6 seconds to build it. Building needs no tool.
- [ ] The door shows its build stages.
- [ ] A door opens when the player comes within 1 m of it on a path through the frame, and closes once they are through.
- [ ] A door does not change where the player can walk, or the paths they take.
- [ ] The player can take down a door or its blueprint and get back every plank.
- [ ] The player cannot take down a door frame that has a door. The action shows greyed with the reason.
- [ ] Doors and their blueprints are saved. Whether a door stands open is not saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] In the playground, a door spends no planks.
- [ ] `GLOSSARY.md` defines the door as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover placement, plank delivery, building, opening and closing, and taking down a door and its frame.
