# 05: A click on a hotbar item uses it

**Status:** resolved

**Blocked by:** 03

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Hotbar" in `../spec.md`. Hotbar items are larger, named, and numbered. A click uses an item. A right-click offers Use and Drop.

- [x] Each item cell is larger and shows the item's name under its icon, and a count when there is more than one.
- [x] The first nine cells show the keys 1 to 9. A key press uses that item.
- [x] A left-click uses the item, as the spec's table says. An item with no use does nothing.
- [x] A right-click opens the menu from ticket 03 with Use, when the item has one, and Drop.
- [x] Using an empty pot walks the player to the nearest river bank, then fills it.
- [x] The Eat, Lay out bedroll, Fill the pot, and Drink buttons are gone.
- [x] With a chest open, a left-click puts the item in the chest, as now.
- [x] A carried log or debarked log shows as a shoulder cell at the start of the hotbar. A left-click drops it. A right-click offers Drop and Split.
- [x] The number keys do nothing while typing in a form field.
- [x] Tests cover the use of each item and the number keys.
