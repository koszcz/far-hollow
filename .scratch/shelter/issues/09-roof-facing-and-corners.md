# 09: Roofs face a direction, and corners shape themselves

**What to build:** The player turns a roof section while placing it, the same way they turn a wall. The turn sets which way the roof slopes down. Where two roofs that slope different ways meet at a corner, each one changes shape on its own to join the other, like stair blocks in block-building games do. An outside corner becomes a hip, where two slopes meet at a ridge. An inside corner becomes a valley, where two slopes meet in a gutter. Then an L-shaped or U-shaped cabin can have its roof slope out to every outside wall.

**Blocked by:** 06 (Roof)

**Status:** needs-triage

**Assets:** Reuse `player`, `debarked-log`, `bark`, and `roof`. Add the hip and valley corner pieces to the `roof` entry as a draft (ADR 0006). The straight section stays approved as it is.

## How the approved roof works now

- Every roof section slopes 12 degrees down to +z. A roof has no direction. `roof.finish` in `src/sim/structures.ts` ignores the placement turn.
- Sections one behind another share one slope. Each section sits higher by one rise for every section in front of it. `slopePlaces` in `src/render/roof-meshes.ts` works this out when drawing. The game rules know nothing about it.
- Logs cut to the slope fill the gap between the walls and the roof on open sides and backs.
- Sections in odd columns sit 12 mm higher, so the bark of neighbours side by side does not flicker.

## Tasks

- [ ] The roof blueprint under the mouse turns with the same key as walls. Its preview shows which way it slopes down.
- [ ] A finished roof keeps its turn, and saved games keep it. Roofs saved before this change load sloping to +z, as they do now.
- [ ] Each roof slopes down in its own direction. Sections one behind another in that direction share one slope, as they do now.
- [ ] Where two roofs that slope at right angles to each other meet at a corner, the corner section becomes a hip (outside corner) or a valley (inside corner). The rule only looks at a section's neighbours, the same way stair corners do.
- [ ] The hip and valley pieces cover the corner with no gap. Their bark laps so water runs down and off, never in.
- [ ] Taking down a roof reshapes the corners next to it.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover the corner rule, the turn kept in saves, and old saves loading.

## Open questions for the owner

1. **Slope heights at a corner.** Today a slope keeps climbing for every section in front of it. A hip only lines up when both slopes reach the same height at the corner. One way to do that: every slope rises from its own downhill wall, and a section's height comes from its distance to that wall. Is that right, or should the corner use some other rule?
2. **Where the roof sits.** Should the turn shape the roof only, with drawing deciding the heights as now? Or should the game rules also store each section's height, for example so rain or heat can use it later?
3. **Roofs that meet at the same direction but different heights.** Where two runs of different depth sit side by side, their roofs meet at a step. Should logs fill the step, or should something else happen?
