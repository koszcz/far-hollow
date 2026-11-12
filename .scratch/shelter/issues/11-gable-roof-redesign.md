# 11: Gable roof that looks like a real log cabin's

**What to build:** Rework the cabin roof so it looks like the roof of a real log cabin. The roof becomes a steep gable: two slopes that meet at a ridge, with log gable ends that fill the triangle under the roof. Split boards cover it in thick, overlapping rows, and it reaches well past the walls.

**Blocked by:** 10 (Roof frame)

**Status:** needs-triage

**Assets:** Change the approved `roof` and `roof-frame`, and the draft `roof-corners`, only with the owner's approval in chat. Add a draft asset for the gable ends. Reuse `debarked-log`, `log-wall`, and `player`. Add a draft for split boards if the roof cover changes from bark (see Open questions).

## Why

The owner compared the roof with a photo of a real log cabin on 2026-11-12. The roof does not look right, and polishing the hip and valley seams did not fix it. The photo shows five differences:

| | Real log cabin | Our roof now |
| --- | --- | --- |
| Slope | About 30 to 35 degrees | 12 degrees, so it reads as a flat lid |
| Shape | A plain gable: two slopes and a ridge | A hip at every outside corner |
| Ends | Log courses that get shorter up to the ridge fill the triangle under the roof | No gable ends |
| Cover | Long, grey, weathered split boards in about seven rows. Each row throws a deep shadow line, and the board ends are staggered and ragged | Flat, dark-brown bark with faint row lines |
| Overhang | Well past the gable ends and the eaves | About 0.3 m past the walls |

The boards on one slope also reach past the ridge, over the other slope. The roof does this already.

## Open questions for the owner

1. **Cover:** Should the roof stay bark, but laid in thick, staggered rows? Or should it change to split boards, with a new material and recipe?
2. **Hips and valleys:** Should every roof become a gable, with hips gone? Or should hips and valleys stay only where an L-shaped or U-shaped cabin needs them?
3. **Gable ends:** Should the player build gable ends as their own piece? Or should they appear on their own under each end of a roof run, like the fill logs do now?
4. **Slope:** Which slope do you want? At 30 degrees, each 1 m square of roof rises about 0.58 m, so a roof two squares deep stands about 1.2 m above the walls.
5. **Overhang:** How far should the roof reach past the gable ends and the eaves? The photo shows about 0.4 to 0.6 m.

## Tasks

Settle the open questions first. Then:

- [ ] Set the new slope. Sections one behind another still share one slope. Two runs that slope away from each other meet at a ridge.
- [ ] Change the corner rule in `src/render/roof-layout.ts` to fit the decision on hips and valleys. The rule still looks only at a section's neighbours, and saves still store only each section's turn.
- [ ] Log gable ends fill the triangle between the wall top and the roof at each end of a run, with no gap. They replace the fill logs where they do the same job.
- [ ] Lay the cover in thick, overlapping rows with staggered, ragged ends, so each row casts a clear shadow line. The boards on one slope reach past the ridge over the other.
- [ ] The roof reaches past the gable ends and the eaves by the agreed overhang.
- [ ] Construction stages, taking down, and the hiding of a roof over the player work as they do now.
- [ ] Saves from before this change load with the new look. Bump the save version if the stored data changes.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused, changed, or added as a draft (ADR 0006).
- [ ] Unit tests cover the changed corner rule and loading old saves.

## Notes

- The shapes and heights live in `src/render/roof-layout.ts` and `src/render/roof-parts.ts`. The frame is drawn in `src/render/roof-frame-meshes.ts`, and the bark in `src/render/roof-meshes.ts`.
- The branch `asset/roof-corners` holds older, unfinished work on hip and valley pieces: a split log along each hip and a gutter in each valley. The owner did not like the same idea when it was rebuilt on 2026-11-12, so do not reuse it.
- The owner's reference is a photo of a reconstructed soldiers' log hut with a board roof and log gable ends. Ask the owner for it if you need it.

## Comments
