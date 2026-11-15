# 07: Sleds carry planks, and blueprints take planks from nearby

**What to build:** A sled can carry planks as well as logs. Sawing next to a parked sled puts extra planks on it. A blueprint that costs planks also takes them from a parked sled next to it and from plank piles within 2 m.

**Blocked by:** 01 (The chest costs planks), 06 (Planks that do not fit drop beside the sawhorse)

**Status:** ready-for-agent

**Assets:** Reuse `sled` unchanged and the plank shape in `pile`. Add the draft `sled-planks`.

- [ ] One log space on a sled holds 4 planks. A sled with no logs holds 24 planks. Logs and planks can share a sled.
- [ ] "Load planks" moves every plank from the backpack onto a parked sled, as far as it has room.
- [ ] "Take planks" moves as many planks from a parked sled into the backpack as fit.
- [ ] The hotbar's sled cell counts planks as a quarter of a log space each.
- [ ] Tipping out a sled drops its planks in one pile beside it. A woodpile never takes planks.
- [ ] Taking down a sled drops its planks in one pile beside it.
- [ ] When cutting planks at a sawhorse, planks that do not fit in the backpack go onto a sled parked next to the sawhorse first. Any left after that drop in a pile.
- [ ] A blueprint that costs planks takes them from the backpack first, then from a parked sled next to it, then from plank piles within 2 m.
- [ ] The planks on a sled show on it, from none to 24.
- [ ] The planks on each sled are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover sled capacity with mixed loads, loading and taking planks, tipping out, sawing into a sled, and a blueprint taking planks from each place.
