# 11: Steep plank gable roof

**What to build:** Rework the cabin roof so it looks like the roof of a real log cabin. The roof slopes at 35 degrees. Two rows of roof frames that face away from each other meet at a ridge. Plank gable ends close the triangle under each end of a ridge. Each roof section is made of planks laid in overlapping rows, and the roof reaches 0.5 m past the walls.

**Blocked by:** 10 (Roof frame), crafting 03 (Cut planks)

**Status:** ready-for-agent

**Assets:** The owner approved these changes in chat on 2026-11-12:

- Change `roof`: the bark becomes weathered grey planks in 6 rows, with ragged, staggered ends, at 35 degrees, reaching 0.5 m past the walls. It goes back to `"status": "draft"`.
- Change `roof-frame`: the rafters slope at 35 degrees. Plank gable ends and plank step fill replace the fill logs. It goes back to `"status": "draft"`.
- Change the draft `roof-corners`: remove the hips. Redraw the valleys in planks.
- Add a draft `gable-end` for the plank triangles.
- Reuse `debarked-log`, `log-wall`, and `player`.

## Why

The owner compared the roof with a photo of a real log cabin on 2026-11-12. The roof does not look right. The roof slopes 12 degrees, so it looks like a flat lid. It has a hip at every outside corner, no gable ends, flat dark bark, and only about 0.3 m of overhang. The photo shows a steep gable roof of long, grey boards with a deep overhang.

## Decisions

All made by the owner on 2026-11-12.

- **Slope:** 35 degrees. Each 1 m square of roof rises about 0.70 m.
- **Cover:** A roof section is planks, the same material the sawhorse cuts. It costs 6 planks instead of 4 bark. Construction lays one row of planks per stage, so it has 6 stages. There is no new material or recipe.
- **Frame:** The roof frame stays hewn debarked logs and still costs 5 debarked logs. Only its rafters change slope.
- **Gables only:** No roof has a hip. A ridge forms where two rows of frames face away from each other.
- **L-shaped and U-shaped cabins:** At a corner, the corner frame's own turn decides which wing's roof runs through. The wing that slopes the same way as the corner frame runs through. The other wing ends against it in valleys. The player changes this by turning the corner frame with R. Saves still store only each frame's turn.
- **Taller butted wing:** If the wing that ends in valleys is deeper, its ridge stands above the through-roof's ridge. This is allowed. A plank gable end fills the step above the through-roof.
- **Shed roofs:** If every frame in a run faces the same way, the roof is one slope with no ridge. This is allowed. A plank triangle closes each end, up to the high wall.
- **Gable ends:** They appear on their own under each end of a ridge or slope, as the fill logs do now. The frame's cost pays for them. The player never builds them on their own.
- **Overhang:** 0.5 m past the eaves and past the gable ends.
- **Old saves:** Every finished bark roof loads as a finished plank roof, at no cost. Every roof blueprint keeps its turn. Any bark already delivered to a blueprint goes back to the player's backpack.

## Tasks

- [ ] Frames and roofs slope at 35 degrees. Sections one behind another still share one slope.
- [ ] Two rows of frames that face away from each other meet at a ridge. The planks on one slope reach past the ridge, over the other slope.
- [ ] Change the corner rule in `src/render/roof-layout.ts`: no hips. At an outside corner, the corner frame's turn picks the wing that runs through, and the other wing ends in valleys. The rule still looks only at a section's neighbours.
- [ ] Plank gable ends close the triangle between the wall top and the roof at each end of a ridge or slope, with no gap. They replace the fill logs.
- [ ] Where a butted wing is taller than the through-roof, a plank gable end fills the step. Steps between runs of different depth are filled with planks, not logs.
- [ ] Lay 6 rows of planks per roof section. They overlap, and their ends are ragged and staggered, so each row casts a clear shadow line. The planks look grey and weathered.
- [ ] The roof reaches 0.5 m past the eaves and the gable ends.
- [ ] The roof section costs 6 planks, and the build menu shows this cost. Construction has 6 stages, one row each.
- [ ] Construction stages, taking down, rain cover, and the hiding of a roof over the player work as they do now. Taking down a roof section gives back its planks.
- [ ] Old saves load as described under Decisions. Bump the save version.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, changed or added as a draft (ADR 0006).
- [ ] Unit tests cover the new corner rule, the taller butted wing, shed roofs, the roof cost, and loading old saves.

## Notes

- The shapes and heights live in `src/render/roof-layout.ts` and `src/render/roof-parts.ts`. The frame is drawn in `src/render/roof-frame-meshes.ts`, and the cover in `src/render/roof-meshes.ts`.
- Do not reuse the branch `asset/roof-corners`. The owner did not like its hip and valley pieces.
- Planks become the cabin's main cost. A roof over a 2 by 3 cabin needs 36 planks, which is 9 debarked logs cut at the sawhorse. The owner may want to tune this.
- The owner's reference is a photo of a reconstructed soldiers' log hut with a board roof and log gable ends. Ask the owner for it if you need it.

## Comments
