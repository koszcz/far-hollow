# 01: Smoked walnut glass on every HUD box

**Status:** resolved

**Assets:** changes the approved `hud`. The owner chose variant C for the restyle in chat on 2026-11-15. Update the `hud` entry's description in `asset-manifest.json` to match. Reuses the approved `backpack-icons` and `build-icons`, and the line icons in `hud`.

**What to build:** See "The look" and "Each part of the HUD" in `../spec.md`. Give every HUD box the glass look of variant C. Leave the need bars, hotbar cells, and backpack weight as they are. Tickets 02 to 04 change them.

- [x] The clock, pause button, banners, need group, hotbar, panels, open chest, and action, build, and craft menus use the glass colour, blur, edge, radius, and shadow from the spec.
- [x] Where the browser lacks `backdrop-filter`, the glass falls back to the opaque colour in the spec.
- [x] The clock is a pill. Its sun icon sits in a ring that fills as the day passes. The time of day follows as a word, such as "morning", in secondary text.
- [x] The pause button is round.
- [x] Banners are pills led by a glowing amber dot.
- [x] Menus have a small-capitals heading. The pointed or focused row gets an amber tint.
- [x] The start screen's save-slot cards use the same glass.
- [x] All HUD text uses the font stack in the spec.
- [x] Focus outlines stay visible on every control.
- [x] Tests cover the time-of-day word and the share of the day the clock ring shows.
- [x] A screenshot of the HUD at seed 42 matches variant C in `../mockups.html`, apart from the parts tickets 02 to 04 change.
