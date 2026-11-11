# 01: Project skeleton with an empty scene

**What to build:** A developer can install the project, start it, and see an empty 3D scene in the browser. The game logic runs at a fixed rate, and rendering smooths motion between logic updates. All code-quality checks run before every commit. This ticket sets up the project for every later ticket.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The project uses pnpm, Vite, TypeScript in strict mode, and plain three.js (ADR 0001).
- [x] Opening the dev server shows an empty 3D scene with a ground plane and a sky colour.
- [x] Game logic runs on a fixed timestep. Rendering interpolates between logic updates.
- [x] Game logic is an ECS built on `miniplex` (ADR 0003).
- [x] A Preact UI layer sits over the 3D view. It only reads state and sends commands (ADR 0005).
- [x] `dependency-cruiser` fails if game logic imports three.js or the UI changes game state directly.
- [x] ESLint and Vitest run. At least one unit test covers the fixed-timestep loop.
- [x] A pre-commit hook runs type checks, lint, and unit tests.
- [x] All player-facing text comes from one strings file.
- [x] An asset manifest exists. The build fails if an asset file is not approved in it.
- [x] The manifest records the owner's approval of code-built placeholder shapes for the first playable: terrain, river, trees, stumps, sticks, the player, logs, firewood, and the campfire.

## Comments

**2026-11-11, done in commit 9020f12.** Every item above is in place. Notes for later tickets:

- The project runs on Node 26.13.0, pinned in `.tool-versions`. The owner asked for Node 26 LTS.
- TypeScript stays on version 6, because typescript-eslint does not support TypeScript 7 yet.
- The owner approved all nine code-built placeholder shapes in chat on 2026-11-11. `asset-manifest.json` records this.
- The owner chose two unit-test seams: the fixed-step loop and the asset manifest check.
- The UI has a Pause/Resume button. It is the smallest real command that proves the UI changes the game only by sending commands. Remove it if a later ticket replaces it.
- The asset check scans the whole repo, except `node_modules`, `dist`, and `.git`.
