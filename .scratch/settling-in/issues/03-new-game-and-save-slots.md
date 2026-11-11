# 03: New game with a seed and three save slots

**What to build:** When the game opens, the player sees three save slots. They can continue a saved game or start a new one in an empty slot. When starting a new game, they pick a random seed or type one in.

**Blocked by:** 02 (Autosave and continue)

**Status:** ready-for-agent

- [ ] The start screen lists three save slots. Each filled slot shows its seed and the day it reached.
- [ ] The player can continue a filled slot.
- [ ] The player can start a new game in any slot. Starting over a filled slot asks the player to confirm first.
- [ ] A new game uses a random seed by default. The player can type in a seed instead.
- [ ] The game autosaves to the slot the player chose.
- [ ] The start screen is Preact UI. It only reads state and sends commands.
- [ ] All player-facing text lives in the strings file.
- [ ] The Playwright test still loads the game and walks the player.
