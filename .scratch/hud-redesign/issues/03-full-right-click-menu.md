# 03: A right-click menu with every action

**Status:** resolved

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Right-click menu" in `../spec.md`. The right-click menu lists every action a thing offers, with icons. The player walks to the thing first when needed.

- [x] The menu lists the main action first, then the rest, for each thing in the spec's table.
- [x] Each entry shows an icon and a name.
- [x] An entry the player cannot do yet is greyed, says why, and does nothing on a click.
- [x] Picking an entry when the thing is out of reach walks the player to it, then does the action. This works for every entry, including fuel, stack, and take.
- [x] Shift-click actions have their own entries, such as "Stack all firewood".
- [x] Escape, or a click elsewhere, closes the menu.
- [x] Tests cover the entries for the campfire and the woodpile, and the walk-then-act path.
