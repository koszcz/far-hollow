# 02: Icons for the build menu

**Status:** resolved

**Assets:** adds the draft `build-icons`. Reuses the approved `backpack-icons` for sticks, bark, and the axe.

**What to build:** The owner asked in chat on 2026-11-11 for the build menu to show graphics instead of text. Each structure shows as an icon, and its cost shows as material icons with counts.

- [x] The build menu is a grid of tiles, four per row. Each tile, including the sawhorse that crafting added, shows its structure's icon in the shaded style of the backpack icons.
- [x] Under the icon, each tile shows its cost as material icons with counts, and the icon of any tool it needs.
- [x] The structure's name shows when the player points at its tile. Screen readers read the name and the full cost.
- [x] The debarked log has its own material icon, because it is not a backpack content.
- [x] The new icons are listed in `asset-manifest.json` as the draft `build-icons`. The showcase is at `/?asset=build-icons`.
