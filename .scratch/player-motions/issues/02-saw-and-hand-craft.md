# 02: Saw at the sawhorse, and craft by hand

**What to build:** Crafting stops reusing the axe chop. Cutting planks at the sawhorse shows a sawing motion. A hand recipe, such as making the saw, shows the player working with both hands. See `.scratch/player-motions/spec.md`.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** Reuse `player`, `sawhorse`, and `debarked-log`. Add draft `saw-animation` and draft `hand-craft-animation`. Update the "Crafting reuses chop-animation" line in `.scratch/crafting/spec.md`.

- [ ] At a sawhorse, the player faces it, bends a little, and pushes and pulls a saw back and forth along the log, about once a second.
- [ ] The saw shows in the right hand while sawing, and the axe is not in the hand. Reuse the saw shape from `crafting-icons` if it helps, or draw a simple blade and handle.
- [ ] For a hand recipe, the player stands still with both hands at waist height and works at something small, with a slow, steady motion.
- [ ] Stopping the work returns the player to standing at once, and the axe returns to the hand.
- [ ] Chopping a tree still uses `chop-animation`.
- [ ] The asset showcase shows both motions.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
