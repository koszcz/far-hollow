# 02: Click the fish trap reliably

**What to build:** Clicking a fish trap often misses it, so the player cannot open its action menu. The player should hit the trap every time they click on it. This fixes the fish trap from ticket 01.

**Status:** idea

**Assets:** None yet. Decide during grilling. Reuses `fish-trap`.

Questions for grilling:

- Where does the click fail: on the trap in the water, on the trap's pile of fish, or both?
- Does the click hit the river or the river bank instead of the trap?
- Should the clickable area be larger than the trap model?
- Do other small things in or near the water have the same problem?
