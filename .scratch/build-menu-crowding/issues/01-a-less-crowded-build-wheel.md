# 01: A less crowded build menu

**What to build:** The build menu lists all 22 structures in one list that scrolls. Each new spec adds more rows, so the player struggles to find a structure. Two changes fix this. Add-ons leave the build menu and become actions on the finished piece they go on. The remaining 18 structures split into three tabs: Camp, Shelter, and Furniture.

**Status:** ready-for-agent

**Assets:** Changes the approved `hud`. The owner approved this change in chat on 2026-11-25. Adds no new asset and no category icons. Reuses `build-icons` for the rows.

## Add-ons move onto their host

An add-on is a building piece built from the finished piece it goes on, its host (see `GLOSSARY.md`).

- [ ] The door, shutters, chimney, and roof section no longer show in the build menu. The floor stays.
- [ ] A finished door frame with no door or door blueprint offers "Hang a door".
- [ ] A finished window with no shutters or shutters blueprint offers "Hang shutters".
- [ ] A finished roof frame with no roof section or roof section blueprint offers "Lay the roof".
- [ ] A finished fireplace with no chimney or chimney blueprint offers "Build a chimney".
- [ ] On the door frame, window, and roof frame, the add-on is the main action, so a left-click does it.
- [ ] On the fireplace, the fire keeps the main action. "Build a chimney" is only in the right-click menu.
- [ ] One click on the add-on action places the add-on's blueprint on that host and starts building it, as clicking "Build" on a blueprint does. Fetching works as it does today.
- [ ] If the game would refuse to place the blueprint, the action shows greyed with the reason (ADR 0008). If the blueprint is placed but building cannot start, the blueprint stays and the game shows why, as "Build" does today.
- [ ] Once the add-on's blueprint exists, the host stops offering the add-on action. The blueprint offers its usual actions.
- [ ] A host that is still a blueprint offers no add-on action.

## Tabs in the build menu

- [ ] The build menu shows three text tabs above its rows: Camp, Shelter, and Furniture. It shows the rows of one tab at a time.
- [ ] Camp holds the campfire, lean-to, woodpile, sawhorse, and sled.
- [ ] Shelter holds the foundation, floor, log wall, door frame, window, roof frame, and fireplace.
- [ ] Furniture holds the chest, shelf, bed, table, stool, and rain barrel.
- [ ] The player switches tabs by clicking them. Escape and B still close the menu.
- [ ] The menu opens on Camp the first time. After that, it opens on the tab used last. This memory lasts until the page reloads and is not saved with the game.
- [ ] No tab scrolls on a 1280 by 720 screen.
- [ ] The door frame, window, roof frame, and fireplace rows each show a short detail line that names their add-on, such as "Hang a door in it once it is built."

## The rest

- [ ] The two journal hints that tell the player to press B for roofs and doors say instead to click the finished roof frame, door frame, and window. See `src/strings.ts`, the hints near line 393 and line 398.
- [ ] The HUD showcase at `/?asset=hud` shows the build menu open on one tab.
- [ ] The `hud` entry in `asset-manifest.json` describes the tabs and records the owner's approval of 2026-11-25.
- [ ] The craft menu does not change.
- [ ] Saves do not change. Add-ons placed before this ticket stay as they are.
- [ ] Tests cover the add-on actions on each host, greyed and not, and which structures each tab lists.
- [ ] `GLOSSARY.md` defines the add-on and describes the build menu tabs. This is done already.
