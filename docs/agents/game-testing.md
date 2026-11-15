# Testing the game in a browser

Read this before you play the game to check a change or hunt a bug. Test through game state first. Use screenshots only to show the owner what something looks like.

## Why state comes first

Every screenshot stays in your context for the rest of the session, and every later call pays for it again. One QA run took 88 screenshots, grew to 271k tokens, and cost more than any whole session that week. A state read costs a few hundred tokens.

## Read and drive the game from the page

The dev build puts the game client on `window.farHollow.client`. Its interface is `GameClient` in `src/sim/api.ts`. Call it with `javascript_tool`:

- `getView()` returns what the player sees: position, carried items, HUD state, and more.
- `nearestInReach()` returns the thing the E key would act on.
- `describeCampfire(id)`, `describeSled(id)`, `describeWoodpile(id)`, and `describeBlueprint(id)` return one thing's state.
- `send({ type: ... })` runs a command, such as `walkTo`, `chopTree`, `debarkLog`, or `placeBlueprint`. The `Command` type in `src/sim/api.ts` lists them all.
- `subscribe(listener)` calls the listener after each logic step.

Open the game with these address options:

- `?seed=42` starts a new, unsaved game in a fixed valley, so every run is the same.
- `?playground` starts a game where building costs nothing.

## How to check a bug

1. Reproduce it in state: send the commands, then read `getView()` and confirm the result is wrong.
2. If the bug is in input or the HUD, click the real control once. Then read state again to see whether the click reached the game.
3. Take one screenshot only when the bug is visual.
4. Write the reproduction as a Playwright test in `e2e/`, following `e2e/walk.spec.ts`, so the bug stays fixed. Run it with `bun run test:e2e`.

## Take a screenshot

When you need to see something, run `bun scripts/shot.ts <path> <out.png>`. It starts its own dev server, waits until the page is ready, and prints any page errors. Read its header for options:

- `--hover`, `--click`, and `--press` set up the scene before the shot.
- `--element` saves only one part of the page, such as the hotbar.
- `--at 0,0.5,1` takes several shots over time, to show an animation.

Examples:

- `bun scripts/shot.ts "/?asset=bed" /tmp/bed.png` shows an asset's showcase.
- `bun scripts/shot.ts "/?seed=42" /tmp/hotbar.png --hover ".hud-hotbar-cell" --element ".hud-hotbar"` shows part of the HUD in a running game.

For any setup the options do not cover, write a Playwright test in `e2e/` instead.

## Splitting QA work

Give each QA agent one suspected bug. A short agent per bug stays small. One agent told to find every bug grows its context with each step, so its cost grows faster than the work it does.
