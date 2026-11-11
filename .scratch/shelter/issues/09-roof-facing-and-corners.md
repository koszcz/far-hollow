# 09: Roofs face a direction, and corners shape themselves

**What to build:** The player turns a roof section while placing it, the same way they turn a wall. The turn sets which way the roof slopes down. Where two roofs that slope different ways meet at a corner, each one changes shape on its own to join the other, like stair blocks in block-building games do. An outside corner becomes a hip, where two slopes meet at a ridge. An inside corner becomes a valley, where two slopes meet in a gutter. Then an L-shaped or U-shaped cabin can have its roof slope out to every outside wall.

**Blocked by:** 06 (Roof)

**Status:** resolved

**Assets:** Reuse `player`, `debarked-log`, `bark`, and `roof`. Add the hip and valley corner pieces to the `roof` entry as a draft (ADR 0006). The straight section stays approved as it is.

## How the approved roof works now

- Every roof section slopes 12 degrees down to +z. A roof has no direction. `roof.finish` in `src/sim/structures.ts` ignores the placement turn.
- Sections one behind another share one slope. Each section sits higher by one rise for every section in front of it. `slopePlaces` in `src/render/roof-meshes.ts` works this out when drawing. The game rules know nothing about it.
- Logs cut to the slope fill the gap between the walls and the roof on open sides and backs.
- Sections in odd columns sit 12 mm higher, so the bark of neighbours side by side does not flicker.

## Tasks

- [x] The roof blueprint under the mouse turns with the same key as walls. Its preview shows which way it slopes down.
- [x] A finished roof keeps its turn, and saved games keep it. The game rules store the turn only, not heights or corner shapes. Roofs saved before this change load sloping to +z, as they do now.
- [x] Each roof slopes down in its own direction. Sections one behind another in that direction share one slope, as they do now.
- [x] Each slope rises from its own downhill wall. A section's height is one rise for each roof section between it and that wall, in its own slope direction.
- [x] Where two roofs that slope at right angles to each other meet at a corner, the corner section becomes a hip (outside corner) or a valley (inside corner). The rule only looks at a section's neighbours, the same way stair corners do.
- [x] Where two roof runs of different depth sit side by side, logs fill the step between them, up to the higher roof's bark.
- [x] The hip and valley pieces cover the corner with no gap. Their bark laps so water runs down and off, never in.
- [x] Taking down a roof reshapes the corners next to it.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover the corner rule, the turn kept in saves, and old saves loading.

## Decisions

- **Slope heights at a corner** (owner, 2026-11-11): Each slope rises from its own downhill wall. A section's height comes from its distance to that wall, in its own slope direction. Then two slopes that meet at a corner reach the same height there, and the hip or valley lines up.
- **Where heights live** (owner, 2026-11-11): Drawing only. The game rules store each roof's turn, and nothing more. `src/render/roof-meshes.ts` works out each section's height and corner shape when it draws, as it does now.
- **Steps between runs** (owner, 2026-11-11): Logs fill the step. Where two roof runs of different depth sit side by side, the higher roof's side gets logs stacked on the lower roof, cut to the slope, up to the higher roof's bark. This uses the same fill logs as the open sides and backs.

## Notes from the implementation

- The corner rule and heights live in `src/render/roof-layout.ts`, with unit tests beside it. `src/render/roof-meshes.ts` draws from it.
- A section's height counts only the sections in front of it that slope the same way. Otherwise the corner of an L whose roofs slope into the L would sit a rise too high.
- The hip and valley pieces are their own draft entry, `roof-corners`, in `asset-manifest.json`. An entry has one approval status, so this keeps the straight section approved. See them with `?asset=roof-corners`.
- Save version 9 turns every roof saved before this change to slope down to +z, as it showed then.
- No new player-facing text: the placing hint already says R turns a blueprint.
- Known limit: where a hip meets a run more than one square deep, the hip sits lower than the run beside it, and logs fill the step.
