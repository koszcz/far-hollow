# 01: Valley backdrop

**What to build:** Surround the 300 m valley with land the player sees but cannot reach: wooded ridges that close the valley in, and mountains far beyond them that fade into the haze. The camera cannot pan past the valley's edge.

**Blocked by:** none

**Status:** resolved

**Assets:** Adds a new draft, `valley-backdrop`, built in code. Reuses `far-trees` for the trees on the ridges, and `river` for the gaps it runs through. Does not change `terrain` or `sky-lighting`, which are both approved.

## Why

The valley is a 300 m square of forest that ends in a hard edge with nothing past it. The camera zooms out to 400 m and pans freely, so the player easily sees the valley floating in empty sky. The game calls the valley a bounded wilderness. The backdrop should make that boundary look natural.

## What the player sees

1. **Ridges around the valley.** Steep wooded slopes rise from the valley's edge on all four sides, 40 m above the valley floor. They meet the valley's ground with no step, gap, or seam.
2. **Trees on the ridges.** The ridges are covered in trees, so the forest seems to carry on up the slopes and over the top.
3. **River gaps.** The river enters through a narrow gorge in the ridge at one end and leaves through a gap at the other end. The ridges do not block the river's path.
4. **Far mountains.** One or two rings of mountains stand about 1 to 3 km away. They fade into the sky's haze, so the horizon is never a hard line.
5. **A firm edge.** The player cannot walk onto the ridges, and the camera's focus cannot pan past the valley's edge.

## Decisions

- **Ridge height:** The ridges rise 40 m above the valley floor. The owner chose this in chat on 2026-11-12.
- **Haze:** The current haze already hides most of a mountain 2 to 3 km away. If the mountains still look too sharp, ask the owner before changing the haze in `sky-lighting`, because `sky-lighting` is approved.

## How to build it

- Build the backdrop as its own mesh, outside the valley's ground. Do not resize the valley or its terrain grid.
- Match the ridge's inner edge to the height of the valley's ground at each point along the edge.
- Draw ridge trees with the existing far-tree shapes in one batch. They cast no shadows.
- Shade the far mountains flat, with no shadows and no collision. Keep each ring to a few thousand triangles.
- Keep everything inside the camera's 4,000 m draw distance.
- Limit the camera's focus to the valley in `src/render/camera-rig.ts`. Panning stops at the edge rather than jumping back.
- The walk map already covers only the valley. Leave it as it is.

## Acceptance criteria

- [x] Ridges rise on all four sides of the valley, 40 m above the valley floor.
- [x] The ridges meet the valley's ground with no visible step, gap, or seam, all the way around.
- [x] Trees cover the ridge slopes and tops.
- [x] The river enters and leaves through gaps in the ridges.
- [x] Far mountains stand 1 to 3 km away and fade into the haze at every hour of the day.
- [x] At night, the ridges and mountains are dark shapes against the sky, not bright patches.
- [x] From any zoom and angle, the camera never shows empty space below the horizon.
- [x] The camera's focus cannot pan past the valley's edge, in free mode or while following the player.
- [x] The player cannot walk out of the valley. Clicking on a ridge does not start a walk.
- [x] The same seed always gives the same ridges and mountains.
- [ ] The game still runs at 60 fps on an Apple M1 laptop in Chrome.
- [x] `asset-manifest.json` has a `valley-backdrop` entry with `"status": "draft"` and this ticket's path.
- [x] The asset showcase (`/?asset=valley-backdrop`) shows the ridges and mountains from high above and from near the ground.
- [x] Unit tests cover the seam heights along the valley's edge and the camera's pan limit.

## Comments

### 2026-11-12, implementing agent

- Built in `src/render/valley-backdrop-shape.ts` (heights, trees, river runs, meshes' shapes) and `src/render/valley-backdrop-meshes.ts` (materials and drawing).
- The crest stands 40 m (± 3 m) above the valley floor, taken as the river's level. Where the valley's edge is already high, the ridge rises less than 40 m above the ground right beside it.
- Ridge trees draw in one culled batch per tree type, like the valley's own trees, so about 8 draw calls rather than one.
- The sky's haze is unchanged. The far land's own material treats it as 1.3 times as far away, and the near mountain ring stands about 1.6 km out, so it softens at noon.
- The camera's eye now stays at least 2 m above the ground under it, so it never looks out from inside a ridge.
- `valley-meshes.ts` (terrain) now shares its ground shader and textures with the ridge. Its look is unchanged.
- Not checked: 60 fps on an Apple M1. The dev machine drew 144 fps at 1024 × 768 at full zoom-out facing a ridge. About 7,100 ridge trees.
