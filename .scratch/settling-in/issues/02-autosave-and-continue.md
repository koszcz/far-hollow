# 02: Autosave and continue

**What to build:** The game saves itself to the browser's built-in storage (IndexedDB) as the player plays. When the player reloads the page, the game picks up where they left off: same valley, same clock, same player, backpack, logs, stumps, sticks, blueprints, and campfires. There is one save for now. Ticket 03 adds three save slots.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The game autosaves at a regular interval and when the page is hidden or closed.
- [x] Reloading the page restores the saved game. A restored valley matches the saved one exactly.
- [x] Each save has a version number.
- [x] Older saves are upgraded one version at a time when loaded. The upgrade path is tested, even though only one version exists yet.
- [x] A schema check rejects a broken save. The player then starts a new game and sees a short message. The message text lives in the strings file.
- [x] Saving reads game state only. It does not import three.js.
- [x] New kinds of game state can be added to the save without rewriting it. Later tickets will add their state this way.
- [x] Unit tests cover the round trip from save to load, the version upgrade, and the rejection of broken saves.
