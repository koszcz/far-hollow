# 01: Icons for the things in the backpack

**Status:** resolved

**Assets:** adds the draft `backpack-icons`.

**What to build:** The owner asked in chat on 2026-11-11 for less text in the game. Each thing in the backpack shows as an icon, not a word.

- [x] Every kind of backpack content has a filled icon in its own colour. The owner chose this style from four mockups.
- [x] A backpack chip shows the icon, and a count when there is more than one.
- [x] The item's name shows at once when the player points at its chip. Screen readers read the name and count.
- [x] The new icons are listed in `asset-manifest.json` as the draft `backpack-icons`.

## Comments

**2026-11-11.** The owner found the first line icons too subtle and too alike. They picked coloured filled icons from four mockups, then asked for a grid layout.

- The backpack is a grid of six square cells per row. A count shows in the cell's corner when there is more than one.
- The Eat buttons moved out of the grid, into the button row below it. Each one shows its food's icon.
- The backpack uses a new bark icon. The approved bark line icon still shows on buttons such as "Add bark".
