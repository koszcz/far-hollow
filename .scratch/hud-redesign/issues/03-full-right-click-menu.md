# 03: A right-click menu with every action

**Status:** ready-for-agent

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Right-click menu" in `../spec.md`. The right-click menu lists every action a thing offers, with icons. The player walks to the thing first when needed.

- [ ] The menu lists the main action first, then the rest, for each thing in the spec's table.
- [ ] Each entry shows an icon and a name.
- [ ] An entry the player cannot do yet is greyed, says why, and does nothing on a click.
- [ ] Picking an entry when the thing is out of reach walks the player to it, then does the action. This works for every entry, including fuel, stack, and take.
- [ ] Shift-click actions have their own entries, such as "Stack all firewood".
- [ ] Escape, or a click elsewhere, closes the menu.
- [ ] Tests cover the entries for the campfire and the woodpile, and the walk-then-act path.
