# 01: Pull a sled

**What to build:** While dragging a sled, the player leans forward and pulls it by a short rope, instead of walking with both arms swinging. See `.scratch/player-motions/spec.md`.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** Reuse `player`, `walk-animation`, and `sled`. Add draft `sled-drag-animation` and draft `sled-rope`.

- [ ] While dragging, the player leans forward from the hips. One hand holds the rope over the shoulder. The other arm swings as in the walk.
- [ ] The legs keep the walk's stride, so the feet stay planted at the slower dragging speed.
- [ ] Standing still while dragging shows the same lean, with the legs at rest.
- [ ] A rope runs from the player's hand to the front of the sled. It sags a little and follows both as they move.
- [ ] Letting go ends the lean and hides the rope at once.
- [ ] The asset showcase shows the player dragging a loaded sled.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
