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

## Skip the waiting with `advance`

The game runs in real time, so a walk, a chop, or a growing tree takes as long to test as it takes to play. Do not wait for it. Call `window.farHollow.advance(seconds)` instead:

- It runs that many seconds of play at once. The player walks, work goes on, and the clock moves.
- One real second of play is one game minute. `advance(60)` runs one game hour, and `advance(1440)` runs one game day.
- It returns the seconds of play that ran. That is fewer while the sleep animation plays, because the game holds its logic then.
- One game day takes about a second. Advance a few days at a time, so each call stays short.
- The interface is `DevHooks` in `src/app/dev-hooks.ts`.

For example, send a command, then advance, then read the result:

```js
const { client, advance } = window.farHollow;
client.send({ type: "walkTo", x: 10, z: 4 });
advance(30);
client.getView().playerPosition;
```

`e2e/advance.spec.ts` does the same from Playwright, after a real click.

For logic with no input or HUD part, write a `bun test` instead. `createGame({ seed: 42 })` and `game.step()` run the game with no browser. See `src/sim/bed.test.ts`.

Open the game with these address options:

- `?seed=42` starts a new, unsaved game in a fixed valley, so every run is the same.
- `?playground` starts a game where building costs nothing.

## Check sound by reading it

Do not try to listen. Call `window.farHollow.sound()` instead. It returns what the sound engine plays now:

- `started` is false until the page gets its first click or key press, because browsers block sound until then. A Playwright click on the canvas starts it.
- `volume` and `muted` are the player's Volume and mute. The M key toggles `muted`.
- `hidden` is true while the tab is hidden. All sound stops then.
- `overall` is how loud all sound plays, from 0 to 1, after the Volume, mute, and the sleep fade. It is 0 while the sleep animation shows black.
- `playing` lists every sound that plays, loudest first, at most 16. Each one has a `key`, such as `river`, `forest`, or `fire-12` (the campfire or fireplace with entity id 12), its asset in `sound`, its `loudness` from 0 to 1 before the Volume, and its `pan` from -1 (left) to 1 (right).
- `frameMs` is how long the last frame's sound work took, in milliseconds. It should stay under 0.5.

The list fills even before `started` is true, so you can check which sounds would play without a click. The sounds follow the next drawn frame, so after `advance`, wait for one animation frame before you read `sound()`.

For example, check that a lit campfire crackles:

```js
const { client, advance, sound } = window.farHollow;
client.send({ type: "lightCampfire", campfireId: 12 });
advance(10);
await new Promise(requestAnimationFrame);
sound().playing.find((playing) => playing.key === "fire-12");
```

## How to check a bug

1. Reproduce it in state: send the commands, then read `getView()` and confirm the result is wrong.
2. If the bug is in input or the HUD, click the real control once. Then read state again to see whether the click reached the game.
3. Take one screenshot only when the bug is visual.
4. Write the reproduction as a Playwright test in `e2e/`, following `e2e/advance.spec.ts`, so the bug stays fixed. Use `advance` instead of polling while time passes. Run it with `bun run test:e2e`.

## Take a screenshot

When you need to see something, run `bun scripts/shot.ts <path> <out.png>`. It starts its own dev server, waits until the page is ready, and prints any page errors. Read its header for options:

- `--hover`, `--click`, and `--press` set up the scene before the shot.
- `--element` saves only one part of the page, such as the hotbar.
- `--at 0,0.5,1` takes several shots over time, to show an animation.

Examples:

- `bun scripts/shot.ts "/?asset=bed" /tmp/bed.png` shows an asset's showcase.
- `bun scripts/shot.ts "/?seed=42" /tmp/hotbar.png --hover ".hud-hotbar-cell" --element ".hud-hotbar"` shows part of the HUD in a running game.

For any setup the options do not cover, write a Playwright test in `e2e/` instead.

## Check that a change leaves a page looking the same

After a refactor, compare the page with an older commit instead of reading two screenshots:

`bun scripts/shot.ts "/?asset=fire-effect" /tmp/fire.png --compare HEAD`

- The script takes the shot on your current code, including uncommitted changes, and again on the commit you name.
- It prints the share of pixels that changed and the box around them. You do not need to open either image.
- It exits with code 1 when more than 0.1% of the pixels changed. Set another limit with `--tolerance 0.01`.
- It saves the old shot as `fire-old.png` and a diff image as `fire-diff.png`, next to the output file. The diff image shows changed pixels in red. Both are for the owner. You do not need to open them.
- All other options work the same way. With `--at`, it compares each time on its own.
- It builds the old shot in a temporary worktree and removes it afterwards, even when the run fails. Do not set up a worktree or write a compare script by hand.

## Splitting QA work

Give each QA agent one suspected bug. A short agent per bug stays small. One agent told to find every bug grows its context with each step, so its cost grows faster than the work it does.
