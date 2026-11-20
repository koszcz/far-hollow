# 02: Saw at the sawhorse, and craft by hand

**What to build:** Crafting stops reusing the axe chop. Cutting planks at the sawhorse shows a sawing motion. A hand recipe, such as making the saw, shows the player working with both hands. See `.scratch/player-motions/spec.md`.

**Blocked by:** None

**Status:** resolved

**Assets:** Reuse `player`, `sawhorse`, `debarked-log`, and the approved `sawing-animation` and `saw-model` unchanged. Add draft `hand-craft-animation`. Update the "Crafting reuses chop-animation" line in `.scratch/crafting/spec.md`.

- [x] At a sawhorse, the player faces it, bends a little, and pushes and pulls a saw back and forth along the log, about once a second. Covered by the approved `sawing-animation`.
- [x] The saw shows in the right hand while sawing, and the axe is not in the hand. Reuse the saw shape from `crafting-icons` if it helps, or draw a simple blade and handle. Covered by the approved `sawing-animation` and `saw-model`.
- [x] For a hand recipe, the player stands still with both hands at waist height and works at something small, with a slow, steady motion.
- [x] Stopping the work returns the player to standing at once, and the axe returns to the hand. Sawing keeps the short step back of the approved `sawing-animation`.
- [x] Chopping a tree still uses `chop-animation`.
- [x] The asset showcase shows both motions.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).

## Comments

- The sawhorse part reuses the approved `sawing-animation` and `saw-model`, which already existed. No `saw-animation` entry was added. This ticket built only the hand-recipe motion, the draft `hand-craft-animation`, and stopped hand recipes from reusing the chop.
