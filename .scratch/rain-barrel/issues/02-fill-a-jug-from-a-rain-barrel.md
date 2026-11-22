# 02: Fill a jug from a rain barrel

**What to build:** The player can pour clean water from a rain barrel straight into a jug, with no pot and no boiling. See `.scratch/rain-barrel/spec.md`.

**Blocked by:** 01, `.scratch/clay/issues/04-fill-and-drink-from-a-jug.md`

**Status:** ready-for-agent

**Assets:** Reuse `rain-barrel`, `jug`, and `jug-icons`. Decided with the owner on 2026-11-22.

- [ ] A barrel that holds water offers "Fill jug" when the backpack holds a jug that is not full.
- [ ] Each "Fill jug" moves 1 drink from the barrel into the fullest jug that still has room. It is a quick action.
- [ ] "Fill jug" shows greyed, with the reason, when the barrel is empty or the backpack holds no jug with room (ADR 0008).
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover filling, which jug is filled, the 3-drink jug limit, and the refusals.
