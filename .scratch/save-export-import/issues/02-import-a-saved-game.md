# 02: Import a saved game from a file

**What to build:** The player can import a saved game from a file into any save slot on the start screen. The game checks the file first and says why it refuses a bad one.

**Status:** resolved

**Assets:** None. Reuse the existing button style.

- [x] Every save slot on the start screen has an "Import" button, whether it is empty, filled, or broken.
- [x] Import asks the player to pick a file.
- [x] Before import replaces a filled or broken slot, the game warns the player, as "New game" does. An empty slot needs no warning.
- [x] The game checks the file before it writes to the slot. If the check fails, the slot keeps what it held.
- [x] The game refuses the file and shows the reason under the slot when the file:
  - is not JSON, or is not a Far Hollow saved game;
  - was made in the 1 km valley;
  - was made by a newer version of the game.
- [x] Each of those cases has its own reason (ADR 0008). Today `readSave` in `src/sim/save.ts` only reports that a save cannot be loaded. It must say which case applies.
- [x] The reason clears on the player's next action on the start screen.
- [x] The game upgrades an older saved game on import, like any stored saved game (ADR 0011).
- [x] Import does not start the game. The slot then shows the imported day and seed.
- [x] A file exported by ticket 01 imports back and continues to the same game.
- [x] When the browser cannot save games, the start screen shows no "Import" button.
- [x] All player-facing text is in the strings file.
- [x] Tests cover each refusal reason, the upgrade of an older saved game, and a round trip from export to import.

## Comments
