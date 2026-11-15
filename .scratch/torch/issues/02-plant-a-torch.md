# 02: Plant a lit torch and pick it up again

**What to build:** The player can stand a lit torch in the ground to light a spot, and pick it up again. Only the nearest few torches cast real light, so the frame rate holds.

**Blocked by:** 01 (Craft and carry a torch)

**Status:** needs-triage

**Assets:** Reuse `torch` and `fire-effect`.

- [ ] "Plant" stands the lit torch at the player's feet, on the ground or on a foundation.
- [ ] The player cannot plant a torch within 1 m of another planted torch. The action shows greyed with the reason.
- [ ] A planted torch keeps burning for the time it had left. When it burns out, it is gone.
- [ ] A planted torch lights the ground around it and does not block walking.
- [ ] "Pick up" is the main action of a planted torch. It puts the torch in the player's hand with its time left.
- [ ] With a lit torch already in hand, "Pick up" shows greyed with the reason.
- [ ] At most 4 torches cast real light at once: the one in hand, then the planted torches nearest the camera.
- [ ] Every other planted torch shows its flame and a glow, but does not light the ground.
- [ ] With 20 planted torches in view, the game meets the frame-rate targets in `.scratch/first-playable/spec.md`.
- [ ] Planted torches and their burning time left are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover planting, the spacing rule, burning out, picking up, and which torches cast light.
