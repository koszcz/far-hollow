# 01: Export a saved game to a file

**What to build:** The player can export the saved game in a filled or broken save slot to a JSON file from the start screen.

**Status:** ready-for-agent

**Assets:** None. Reuse the existing button style.

- [ ] Each filled or broken save slot on the start screen has an "Export" button. An empty slot has none.
- [ ] Export writes the slot's saved game, exactly as stored, to a readable JSON file on the player's computer.
- [ ] A filled slot's file is named like `far-hollow-slot-1-day-12.json`.
- [ ] A broken slot's file is named like `far-hollow-slot-2-broken.json` and holds the raw data as stored.
- [ ] Slot 1 still exports the old single save if slot 1 has not been saved since save slots came in.
- [ ] Export leaves the slot unchanged.
- [ ] When the browser cannot save games, the start screen shows no "Export" button.
- [ ] All player-facing text is in the strings file.
- [ ] Tests cover the file name for filled and broken slots, and check that the file holds the stored saved game.

## Comments
