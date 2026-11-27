# 02: Mark where the player collapsed

**What to build:** After a collapse, the game marks the spot where the player fell, so they can walk back to it. The player wakes at their respawn point and may not know where they were. This builds on the collapse from the needs feature. Ticket 01 stops collapses in sleep, so this mark is for collapses while awake.

**Status:** idea

**Blocked by:** 01

**Assets:** None yet. Decide during grilling.

Questions for grilling:

- Does the player lose anything at a collapse, such as what they carried, that lies at the spot?
- Is the mark in the world, on the HUD, or both?
- How long does the mark stay: until the player reaches it, until the next collapse, or for a set time?
- Does the game show the reason for the collapse with the mark?

Notes from the first grilling, 2026-11-26, not yet answered by the owner:

- A collapse already drops what is on the shoulder or in the hands, and leaves a dragged sled at the spot. The backpack stays with the player.
- The game has no minimap, compass, or waypoint yet.
- Proposed answers: lose nothing new; a mark in the world plus an arrow at the screen edge while it is off screen; one mark at a time, removed when the player comes within about 2 m or a new collapse replaces it; the collapse notice names the need, the mark does not; no mark within about 5 m of where the player wakes.
