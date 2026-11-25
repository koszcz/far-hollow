# 02: Fix the automatic cabin cutaway

**What to build:** The cutaway should again hide a cabin's roof and fade its sides facing the camera on its own, while the player is inside. The owner reported on 2026-11-25 that the automatic cutaway does not work, and asked for a manual button for now (ticket 01). Find out what goes wrong in play, and decide whether the button stays once the automatic cutaway works.

**Status:** idea

**Assets:** Reuse `cutaway-button`.

## Questions to settle

- What goes wrong in play: the roof does not hide, it hides at the wrong time, or the wrong walls fade?
- Does the button stay as a way to force the cutaway on or off, with a third "automatic" setting?
