# 03: Snug rooms keep out the cold

**What to build:** A room with a floor on every square and a door in every door frame is snug. In a snug room, the player's warmth drains at half the usual rate at night.

**Blocked by:** 01 (Lay a floor), 02 (Hang a door)

**Status:** needs-triage

**Assets:** None.

- [ ] A room is snug when every square has a finished floor and every door frame on its edge has a finished door.
- [ ] A room with no door frame is snug once every square has a floor.
- [ ] In a snug room, warmth drains at half the usual rate at night.
- [ ] A lit campfire or fireplace in the room warms the player as before.
- [ ] Whether a room is snug updates when a floor or door is finished or taken down. It is not saved.
- [ ] The first time the player stands in a snug room, a banner says the room now keeps out the cold. It shows once in each game.
- [ ] The debug overlay shows which rooms are snug.
- [ ] `GLOSSARY.md` defines snug as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover what makes a room snug, a missing floor, a missing door, and the warmth drain inside and outside a snug room.
