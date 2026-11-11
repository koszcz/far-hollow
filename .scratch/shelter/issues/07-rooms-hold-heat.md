# 07: Rooms hold heat

**What to build:** The game finds rooms: foundation squares closed in by walls or door frames, with a roof over every square. The player can build a campfire inside a room, and a lit one warms them anywhere in it.

**Blocked by:** 06 (Roof)

**Status:** ready-for-agent

**Assets:** Reuse `campfire`.

- [ ] The game finds each room. A door frame counts as closed. One missing wall or roof means no room.
- [ ] Rooms update when pieces are finished or taken down.
- [ ] The player can place a campfire on a foundation inside a room.
- [ ] A lit campfire in a room warms the player anywhere in that room, however far from the fire.
- [ ] Campfires outside rooms warm the player as before.
- [ ] The debug overlay can show rooms.
- [ ] Unit tests cover finding rooms, door frames, gaps, and warmth inside a room.
