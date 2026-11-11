# 01: Turn warmth into one of four needs

**What to build:** The player's warmth becomes one of four needs: hunger, thirst, warmth, and fatigue. Only warmth changes for now. Any need left at zero for too long causes a collapse, and any low need slows the player. The game plays exactly as it does today. This prepares the code for tickets 04, 05, and 07.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The game holds all four needs for the player. Hunger, thirst, and fatigue stay full until later tickets make them change.
- [x] A collapse happens when any one need stays at zero for too long.
- [x] The slowest need decides how much the player slows down.
- [x] The game view shows all four need levels. The HUD still shows only warmth.
- [x] Skipping time changes every need for the time skipped.
- [x] The existing warmth, collapse, and first-night tests pass without changing what they check.
- [x] Unit tests cover collapse and slowdown caused by a need other than warmth.
