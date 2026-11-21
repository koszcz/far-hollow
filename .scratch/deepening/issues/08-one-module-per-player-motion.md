# 08: Give each player motion its own module, so asset sessions stop colliding

**What to build:** Each player motion, such as hand crafting, sled dragging, or eating, lives in its own module. The module owns the motion's pose, its props, and its per-frame update. `src/render/player-mesh.ts` only lists the motions and runs the active one. A new motion or a polished one touches its own file, not `player-mesh.ts`.

**Status:** needs-triage

**Assets:** None. This ticket changes no asset. Every animation must look the same before and after.

## Why

On 2026-11-21, six asset branches changed `src/render/player-mesh.ts` (1072 lines) in one afternoon. Landing two of them hit merge conflicts in it: the hand-craft animation and the sled rope. `src/render/showcases/animations.ts` (664 lines) conflicted as well.

The pose maths is already split out, into files such as `player-hand-craft-pose.ts` and `player-sled-drag-pose.ts`. The wiring is not. For each motion, `player-mesh.ts` still holds its constants, its props (the saw, the rod, the pot, the torch), the bones it turns, and its branch in the per-frame update. Polishing any one motion edits the same lines as every other.

## What to do

1. Read `createWorkMotion` in `src/render/work-motion.ts` and `createHandCraftMotion` in `src/render/player-hand-craft-pose.ts`. Decide whether one of them can become the shared motion interface.
2. Define that interface: what a motion needs from the player mesh (bones, hand slots, the clip mixer) and what it gives back (when it is active, its pose for this frame, its props).
3. Move the motions out of `player-mesh.ts` one at a time. Keep the tests passing after each move.
4. Give each animation showcase its own entry file, or another shape where two new showcases do not edit the same lines of `animations.ts`.

## Acceptance criteria

- [ ] Adding a new player motion needs at most a one-line change to `player-mesh.ts`.
- [ ] `player-mesh.ts` holds no constants or props that belong to one motion.
- [ ] Two new animation showcases can be added on separate branches and merged without a conflict.
- [ ] Every animation showcase looks the same before and after. Check this with screenshots of `/?asset=<id>` on both commits.
- [ ] Existing tests pass.
