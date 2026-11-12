# 05: A click on a hotbar item uses it

**Status:** ready-for-agent

**Blocked by:** 03

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Hotbar" in `../spec.md`. Hotbar items are larger, named, and numbered. A click uses an item. A right-click offers Use and Drop.

- [ ] Each item cell is larger and shows the item's name under its icon, and a count when there is more than one.
- [ ] The first nine cells show the keys 1 to 9. A key press uses that item.
- [ ] A left-click uses the item, as the spec's table says. An item with no use does nothing.
- [ ] A right-click opens the menu from ticket 03 with Use, when the item has one, and Drop.
- [ ] Using an empty pot walks the player to the nearest river bank, then fills it.
- [ ] The Eat, Lay out bedroll, Fill the pot, and Drink buttons are gone.
- [ ] With a chest open, a left-click puts the item in the chest, as now.
- [ ] A carried log or debarked log shows as a shoulder cell at the start of the hotbar. A left-click drops it. A right-click offers Drop and Split.
- [ ] The number keys do nothing while typing in a form field.
- [ ] Tests cover the use of each item and the number keys.
