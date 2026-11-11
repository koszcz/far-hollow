# 01: Project skeleton with an empty scene

**What to build:** A developer can install the project, start it, and see an empty 3D scene in the browser. The game logic runs at a fixed rate, and rendering smooths motion between logic updates. All code-quality checks run before every commit. This ticket sets up the project for every later ticket.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The project uses pnpm, Vite, TypeScript in strict mode, and plain three.js (ADR 0001).
- [ ] Opening the dev server shows an empty 3D scene with a ground plane and a sky colour.
- [ ] Game logic runs on a fixed timestep. Rendering interpolates between logic updates.
- [ ] Game logic is an ECS built on `miniplex` (ADR 0003).
- [ ] A Preact UI layer sits over the 3D view. It only reads state and sends commands (ADR 0005).
- [ ] `dependency-cruiser` fails if game logic imports three.js or the UI changes game state directly.
- [ ] ESLint and Vitest run. At least one unit test covers the fixed-timestep loop.
- [ ] A pre-commit hook runs type checks, lint, and unit tests.
- [ ] All player-facing text comes from one strings file.
- [ ] An asset manifest exists. The build fails if an asset file is not approved in it.
- [ ] The manifest records the owner's approval of code-built placeholder shapes for the first playable: terrain, river, trees, stumps, sticks, the player, logs, firewood, and the campfire.
