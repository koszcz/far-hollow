# 03: Simple shapes for far-away trees

**What to build:** Zooming out over the whole valley stays smooth. Trees far from the camera draw with a cheap stand-in shape, and plants too small to see are skipped.

**Status:** resolved

**Assets:** Reuses `trees`, `berry-bush`, `mushrooms`, `grass`, `ferns`, `flowers`, and `pebbles`. Adds the draft asset `far-trees`. The owner approved changing how distant trees look, in chat on 2026-11-12.

## Why

Zoomed fully out, the camera sees the whole valley. On the owner's M3 Pro, that drew about 14.4 million vertices per frame, at 17 to 21 ms per frame at Retina density. The owner saw the frame rate drop to about 44. Zoomed fully out, the vertices came from:

- Undergrowth: 6.4 million. It drew every plant within 80 m of the focus, though from 1,300 m each is smaller than a pixel.
- Trees: 3.7 million, all at full detail.
- Berry bushes and mushroom patches: 3 million.

## Acceptance criteria

- [x] Trees at least 150 m from the camera draw with a cheap shape: a seven-sided trunk, and a crown turned from the real crown's outline.
- [x] The far shape keeps each tree type's height, width, and colours.
- [x] Shadows always come from the real tree shape.
- [x] Clicking a far tree still picks it.
- [x] Undergrowth shrinks away between 120 m and 160 m from the camera, and patches beyond 160 m are not drawn.
- [x] Berry bushes and mushroom patches beyond 300 m from the camera are not drawn.
- [x] Zoomed fully out, vertices per frame and frame time drop sharply.

## Comments

### 2026-11-12: Result

Measured with a headless Chrome probe on the owner's M3 Pro, seed 12345, pixel ratio 2, fully zoomed out:

| | Before | After |
| --- | --- | --- |
| Vertices per frame | 14.4 million | 4.5 million |
| Frame time, GPU waited on | 17 to 21 ms | 13 to 16 ms |

The probe waits for the GPU every frame, which adds a few milliseconds, and its timings drift between runs. The vertex counts are steady.

The first far trunk was as wide as the real trunk's widest point and as tall as the whole tree, because the real trunk mesh reaches up inside the crown with branches. Far trees looked like brown pillars. The far trunk is now measured at its foot and reaches a quarter of the way into the crown. Screenshots at about 300 m now look close to the real trees, with slightly rounder crowns.

Some tree types have crowns made of separate clumps. Their far crowns first pinched to nothing between clumps, which left floating diamonds. A band between clumps now reaches as far as the narrower of the widest bands above and below it. The asset showcase (`/?asset=far-trees`) shows every type's far shape.

The owner can polish `far-trees` with the `make-asset` skill. The distances are constants: `FAR_TREE_METRES` in `tree-far-shape.ts`, `EYE_FADE_START_METRES` and `EYE_DRAW_METRES` in `undergrowth-meshes.ts`, and `FORAGE_DRAW_METRES` in `forage-meshes.ts`.
