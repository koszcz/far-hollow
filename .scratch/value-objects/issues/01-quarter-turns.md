# 01: Give quarter turns one module that owns their rules

**What to build:** Move `QuarterTurns` into its own value object module in `src/sim/quarter-turns.ts`, following ADR 0009. Every rule about quarter turns lives there. Callers stop doing the arithmetic themselves. The game behaves exactly as before.

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

The same rules about quarter turns are written out by hand in several files:

- Turning one step and wrapping 3 back to 0: `src/app/build-mode.ts:36` and `src/sim/structures.ts:212`.
- Wrapping any whole number into 0 to 3: `src/render/roof-layout.ts:58` and `src/sim/sleds.ts:315`.
- Checking whether two facings point opposite ways: `src/render/roof-meshes.ts:294` and `src/render/roof-frame-meshes.ts:221`.
- Converting quarter turns to radians: `facingRadians` in `src/render/structure-look.ts:12`. Game logic cannot import from render, so `src/sim/sleds.ts:130` writes the same conversion again.
- Converting a heading in radians back to the nearest quarter turn: `src/sim/sleds.ts:315`.
- Turning an offset the way a structure faces: `turnOffset` in `src/sim/structure-kind.ts:64`.

If one copy changes, for example the sign of the radians, the copies disagree and the drawn shape no longer matches the game's rules.

## What the module holds

Choose the exact names. The module needs at least these functions:

- turn by a number of steps, wrapping around
- wrap any whole number into a quarter turn
- whether two quarter turns point opposite ways
- convert to radians, with the sign the renderer uses today
- convert a heading in radians to the nearest quarter turn
- turn a ground offset the way a quarter turn faces (move `turnOffset` here)

## Acceptance criteria

- [x] `QuarterTurns` and its functions live in `src/sim/quarter-turns.ts`. Render and app code import them from there.
- [x] No file outside the module wraps quarter turns with `% 4` or converts them to or from radians by hand.
- [x] `facingRadians` in `src/render/structure-look.ts` is gone, or only calls the module.
- [x] The `facing` component and saved games keep the same shape. Old saves still load.
- [x] Unit tests cover each function, including wrapping negative numbers and headings near a half turn.
- [x] `make check` passes. Structures, roofs, and dragged sleds face the same way as before in the playground.
