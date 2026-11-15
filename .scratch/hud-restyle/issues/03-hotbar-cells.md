# 03: Smaller hotbar cells with names on point

**Status:** ready-for-agent

**Blocked by:** 01

**Assets:** changes the approved `hud`. The owner chose variant C, with names on point only, in chat on 2026-11-15. Reuses the approved `backpack-icons`, `build-icons`, and `sled-icon`.

**What to build:** See decision 3 and the "Hotbar cells" and "Build and Craft" rows in `../spec.md`. Hotbar cells drop their always-on names. Build and Craft become square buttons side by side.

- [ ] Each hotbar cell is 58 px square, with a 12 px radius, a faint light fill, and a 38 px icon.
- [ ] The number key sits bottom left at 50% opacity. The count sits top right.
- [ ] A cell shows no name until the player points at it or focuses it. Then a pill label above the cell shows its name, and the cell gets an amber outline.
- [ ] The shoulder and sled cells keep their gap from the backpack contents.
- [ ] Build and Craft are 58 px square buttons, side by side. Each shows its icon over its name, with its key in the top right corner and an amber tint.
- [ ] Each cell's screen-reader name is unchanged.
- [ ] On a small screen, the cells narrow and scroll sideways, as today.
- [ ] Tests cover the name label on point and on keyboard focus.
