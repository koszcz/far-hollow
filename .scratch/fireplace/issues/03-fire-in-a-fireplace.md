# 03: Fuel and light a fireplace, and let it heat its room

**What to build:** The player can put fuel on a fireplace and light it. A lit fireplace warms the player anywhere in its room, and its fuel lasts twice as long as on a campfire.

**Blocked by:** 02 (Build a fireplace)

**Status:** resolved

**Assets:** Reuse `fireplace` and `fire-effect`.

- [x] The player adds sticks, bark, and firewood to a finished fireplace within reach, as with a campfire.
- [x] Each piece of fuel burns twice as long in a fireplace as on a campfire.
- [x] A fireplace holds up to 16 game hours of burning. Fuel that would go past that is not taken.
- [x] The player lights a fireplace with the steel and flint. It needs fuel. Lighting is the main action of an unlit fireplace that has fuel.
- [x] A fireplace goes out when its fuel runs out.
- [x] A lit fireplace in a room warms the player anywhere in that room.
- [x] A lit fireplace outside a room warms the player within the same range as a campfire.
- [x] Rain never puts out a fireplace under a roof.
- [x] A panel shows the fuel left, as it does for a campfire.
- [x] A lit fireplace shows fire and smoke, and lights the ground around it.
- [x] The player cannot take down a fireplace that is lit or holds fuel. The action shows greyed with the reason.
- [x] The fuel in each fireplace and whether it is lit are saved. The save version goes up, and older saves are upgraded when loaded.
- [x] Campfires behave as before, indoors and outdoors.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover fuelling, the burn time, the fuel limit, lighting, warmth inside and outside a room, and taking down.
