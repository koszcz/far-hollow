# Export and import saved games: spec

A saved game lives only in the browser's own storage. If the browser clears that storage, the camp is gone. A camp also cannot move to another browser or computer. This feature lets the player **export** the saved game in a **save slot** to a file, and **import** a file into a save slot.

Terms in **bold** are defined in `GLOSSARY.md`.

## Goals

- The player can keep a copy of a camp outside the browser, in case the browser loses it.
- The player can move a camp to another browser or computer.
- The player can send a saved game to the developer with a bug report.

Sharing camps between players is not a goal.

## Export

- Each filled or broken save slot on the start screen has an "Export" button. An empty slot has none.
- Export copies the slot's saved game into a file on the player's computer. The slot keeps its saved game.
- The file holds the saved game as readable JSON, exactly as stored.
- The file name gives the slot and the day, such as `far-hollow-slot-1-day-12.json`.
- A broken slot exports its data as it is, in a file such as `far-hollow-slot-2-broken.json`.
- Export is only on the start screen, because the game has no in-game menu. Autosave runs when the page closes, so after a reload the slot is up to date.

## Import

- Every save slot on the start screen has an "Import" button, whether it is empty, filled, or broken.
- Import asks the player to pick a file.
- Before import replaces a filled or broken slot, the game warns the player, as "New game" does. An empty slot needs no warning.
- The game checks the file before it touches the slot. If the check fails, the slot keeps what it held.
- The game refuses the file, and says why under the slot, when the file:
  - is not JSON, or is not a Far Hollow saved game;
  - was made in the 1 km valley;
  - was made by a newer version of the game.
- The reason clears on the player's next action on the start screen.
- The game upgrades an older saved game on import, like any stored saved game (ADR 0011).
- Import does not start the game. The slot then shows the imported day and seed, and the player continues it.
- The player can import the same file into two slots. The two games then go their own ways.

## Games that are never saved

- A playground game and a game started from `?seed=` have no save slot, so they have nothing to export.

## When the browser cannot save

- The start screen already warns that games cannot be saved. In that case it shows neither "Export" nor "Import".

## Assets

None. The buttons reuse the existing button style.
