# 03: Fuel and light a fireplace, and let it heat its room

**What to build:** The player can put fuel on a fireplace and light it. A lit fireplace warms the player anywhere in its room, and its fuel lasts twice as long as on a campfire.

**Blocked by:** 02 (Build a fireplace)

**Status:** ready-for-agent

**Assets:** Reuse `fireplace` and `fire-effect`.

- [ ] The player adds sticks, bark, and firewood to a finished fireplace within reach, as with a campfire.
- [ ] Each piece of fuel burns twice as long in a fireplace as on a campfire.
- [ ] A fireplace holds up to 16 game hours of burning. Fuel that would go past that is not taken.
- [ ] The player lights a fireplace with the steel and flint. It needs fuel. Lighting is the main action of an unlit fireplace that has fuel.
- [ ] A fireplace goes out when its fuel runs out.
- [ ] A lit fireplace in a room warms the player anywhere in that room.
- [ ] A lit fireplace outside a room warms the player within the same range as a campfire.
- [ ] Rain never puts out a fireplace under a roof.
- [ ] A panel shows the fuel left, as it does for a campfire.
- [ ] A lit fireplace shows fire and smoke, and lights the ground around it.
- [ ] The player cannot take down a fireplace that is lit or holds fuel. The action shows greyed with the reason.
- [ ] The fuel in each fireplace and whether it is lit are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] Campfires behave as before, indoors and outdoors.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover fuelling, the burn time, the fuel limit, lighting, warmth inside and outside a room, and taking down.
