# 02: Click the fish trap reliably

**What to build:** Clicking a fish trap often misses it, so the player cannot open its action menu. The player should hit the trap every time they click on it. This fixes the fish trap from ticket 01.

**Status:** resolved

**Assets:** Reuses `fish-trap` with no change. The pick shape is invisible, so the approved look stays the same. Settled with the owner on 2026-11-26.

## Why clicks miss

The trap is built from sticks 7 mm thick and withies 5 mm thick, with wide gaps between them. A click counts only when the camera's ray hits one of those thin parts. Most rays pass through a gap to the riverbed, so the click lands on the river instead. Campfires, chests, piles, torches, and bedrolls each have an invisible pick shape that catches clicks. The trap has none. See `src/render/fish-trap-meshes.ts` (`pick`) and the pick shape in `src/render/campfire-meshes.ts`.

## Acceptance criteria

- [ ] Each set fish trap has an invisible solid pick shape that wraps the whole basket, with no gaps.
- [ ] The pick shape reaches about 5 cm past the basket on every side.
- [ ] The trap's stake on the bank also has a pick shape. A click on the stake counts as a click on the trap. The cord line gets no pick shape of its own.
- [ ] A click anywhere on the basket, inside the margin, or on the stake opens the trap's action menu, whether or not the trap holds a fish.
- [ ] The pick shape is never drawn. The hover outline still traces the trap's real shapes.
- [ ] Only the fish trap changes. Other things keep their current picking.
- [ ] A unit test checks that a ray through a gap between the sticks hits the trap, not the river.
- [ ] A unit test checks that a ray just past the basket, inside the margin, hits the trap.
