# 02: Indoor shadow and the window's night glow

**What to build:** A roof that hides over the player keeps casting its shadow, so a room is dark by day except where daylight comes in through an open window or a doorway. At night, an open window glows warm from outside when a fire or torch burns in the room. See `.scratch/windows/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

**Assets:** Change the approved `roof`, `roof-frame`, and `roof-corners` so they keep casting shadows while hidden over the player. The owner approved this change on 2026-11-22. Add the draft `window-glow` (the warm glow in an open window at night). Decided with the owner on 2026-11-22.

## Indoor shadow

- [ ] A roof section that hides over the player still casts its shadow. So does every roof frame that hides with it.
- [ ] A hidden roof or frame still cannot be picked, as today.
- [ ] By day, a room is dark inside except where sunlight falls through an open window or a doorway.
- [ ] Closing the shutters shuts out the window's sunlight.
- [ ] A lit campfire, fireplace, or torch inside still lights the room.
- [ ] The asset catalogue entries for `roof`, `roof-frame`, and `roof-corners` describe the change and record the owner's approval with the date.

## Night glow

- [ ] At night, an open window shows a warm glow from outside when a lit campfire, fireplace, or torch is in its room.
- [ ] A window with closed shutters, or with no lit fire or torch in its room, shows no glow.
- [ ] The glow fades in at dusk and out at dawn with the daylight.
- [ ] The glow has no effect on play.

## The rest

- [ ] Every asset under **Assets** is in the asset catalogue, reused, changed with approval, or added as a draft (ADR 0006).
- [ ] Unit tests cover when a window glows. Check the indoor shadow in the browser, following `docs/agents/game-testing.md`.
