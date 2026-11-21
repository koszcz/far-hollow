# 01: Export a saved game to a file

**What to build:** The player can export the saved game in a filled or broken save slot to a JSON file from the start screen.

**Status:** resolved

**Assets:** None. Reuse the existing button style.

- [x] Each filled or broken save slot on the start screen has an "Export" button. An empty slot has none.
- [x] Export writes the slot's saved game, exactly as stored, to a readable JSON file on the player's computer.
- [x] A filled slot's file is named like `far-hollow-slot-1-day-12.json`.
- [x] A broken slot's file is named like `far-hollow-slot-2-broken.json` and holds the raw data as stored.
- [x] Slot 1 still exports the old single save if slot 1 has not been saved since save slots came in.
- [x] Export leaves the slot unchanged.
- [x] When the browser cannot save games, the start screen shows no "Export" button.
- [x] All player-facing text is in the strings file.
- [x] Tests cover the file name for filled and broken slots, and check that the file holds the stored saved game.

## Comments
