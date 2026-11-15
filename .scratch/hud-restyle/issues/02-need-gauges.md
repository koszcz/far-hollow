# 02: Round need gauges beside the hotbar

**Status:** resolved

**Blocked by:** 01

**Assets:** changes the approved `hud`. The owner chose variant C in chat on 2026-11-15. Keeps the line icons in `hud`.

**What to build:** See "Need gauges" in the table under "Each part of the HUD" in `../spec.md`, and "Small screens". The four need bars become round gauges in one glass group to the left of the hotbar.

- [x] Each need shows as a 42 px ring in its own colour. The ring fills with the need's level.
- [x] Each need's icon sits inside its ring. Its name sits below in 10 px text.
- [x] A low need pulses, at the same level as today.
- [x] The need group sits to the left of the hotbar, bottom aligned with it.
- [x] On a screen too narrow for both side by side, the need group moves above the hotbar.
- [x] Screen readers read each need's name and level, as today.
- [x] Tests cover the share of the ring each level fills, and the pulse on a low need.
