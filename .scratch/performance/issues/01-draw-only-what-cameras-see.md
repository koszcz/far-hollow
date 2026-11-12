# 01: Draw only the plants and trees that a camera can see

**What to build:** The game draws trees, berry bushes, mushroom patches, and undergrowth only where the player's camera or the sun's shadow box can see them. The picture looks the same as before.

**Status:** resolved

**Assets:** Reuses `trees`, `berry-bush`, `mushrooms`, `grass`, `ferns`, `flowers`, `pebbles`, and `sky-lighting`. The owner approved changing how `sky-lighting` draws shadows, in chat on 2026-11-12. No asset changes how it looks.

## Why

On the owner's M3 Pro, a frame at Retina density took about 29 ms (about 34 frames a second). The GPU was the bottleneck. Each frame drew about 18.8 million vertices:

- Undergrowth: 6.4 million. It draws every plant within 80 m of the focus, even behind the camera.
- Trees: 3.4 million. Each tree type is one batch that covers the whole valley, so no tree is ever skipped.
- Berry bushes and mushroom patches: 2.6 million, for the same reason.
- The sun's shadow pass draws the trees, bushes, and mushrooms again: about 6 million.

Shadow map size and shadow filtering made no measurable difference.

## Acceptance criteria

- [x] Trees, bushes, berries, and mushroom patches outside the camera's view are not drawn in the main pass.
- [x] Only trees, bushes, and mushroom patches inside the sun's shadow box are drawn in the shadow pass.
- [x] Undergrowth patches outside the camera's view are not drawn.
- [x] Picking and hover outlines work as before. Falling trees reuse the same hide-and-show path, but nobody has felled a tree by hand since the change.
- [x] Vertices per frame drop sharply at the starting view, measured with `bun .scratch/performance/measure.ts`.

## How to measure

Run the dev server on port 5174, then run `bun .scratch/performance/measure.ts`. It starts seed 12345 in headless Chrome on the real GPU. It prints frame time, draw calls, and thousands of vertices per frame, at pixel ratios 1 and 2.

## Comments

### 2026-11-12: Result

What changed:

- Trees, berry bushes, berries, and mushroom patches draw through `src/render/culled-batch.ts`. Each batch keeps two copies: one for the screen, culled to the camera's view, and one on a shadow-only layer, culled to the sun's shadow box.
- Undergrowth keeps growing patches within 80 m of the focus, but draws only the patches inside the camera's view.
- The game draws at most 3 million pixels per frame (`src/render/pixel-budget.ts`). Large Retina and ultrawide screens draw a slightly smaller picture that the browser stretches.

Measured with `measure.ts` on the owner's M3 Pro, seed 12345, starting view:

| | Before | After |
| --- | --- | --- |
| Vertices per frame | 18.8 million | 3.4 million |
| Frame time at pixel ratio 1 | about 15 ms | about 8 ms |
| Frame time at pixel ratio 2 | about 29 ms | about 10 ms |

Screenshots before and after match, at the starting view and fully zoomed out. Zoomed fully out, the camera sees the whole valley, so culling saves little in the main pass there. The shadow pass still only draws inside the shadow box.
