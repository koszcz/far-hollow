# 02: Run play time at once in browser tests

**What to build:** The dev build's `window.farHollow` gets an `advance(seconds)` call. It runs that many seconds of play at once, so a browser test or an agent does not wait in real time for a walk, a chop, or a growing tree.

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

Headless `bun test` runs can step the game as fast as they like. Browser tests and agents in Chrome could not. They had to wait in real time, so any check that needed time to pass was slow.

## What to do

1. Add `createDevHooks` in `src/app/dev-hooks.ts`. It holds the game client and `advance`.
2. In `src/app/main.tsx`, share one step function between the frame loop and `advance`, so `advance` also holds the logic while the sleep animation plays.
3. Add `e2e/advance.spec.ts`: click a walk in the real UI, advance, then check the position and the HUD clock.
4. Document `advance` in `docs/agents/game-testing.md`.

## Acceptance criteria

- [x] `advance(60)` moves the clock one game hour and finishes a clicked walk.
- [x] It returns the seconds of play that ran, fewer while the game holds its logic.
- [x] It turns away a negative or endless number of seconds.
- [x] Only development builds have it.
