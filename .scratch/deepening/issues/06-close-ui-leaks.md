# 06: Stop the UI copying sim rules or skipping refusals

**What to build:** The HUD reads day and night from the game view. The chest panel and the craft menu grey out actions the game would refuse, with the reason. The app no longer imports a type from the renderer.

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

ADR 0005 says the UI only reads state and sends commands. ADR 0008 says the UI asks the game why it would refuse a command. A few places do not:

- `src/ui/hud.tsx:624` works out daylight as hour 6 to 20. That copies `isNight` and its hours in `src/sim/clock.ts`. If the sim's hours change, the clock icon will be wrong.
- The craft menu (`src/ui/hud.tsx:716`) and the chest panel (`src/ui/hud.tsx:750`) send `craft` and `takeFromChest` without asking `client.refusal`. So they are never greyed out.
- `src/app/thing-actions.ts:6` imports `ScenePick` from `src/render/scene-renderer.ts`. The app's action logic then depends on the renderer. `src/sim/reach.ts` has a matching `ThingInReach` type.

## What to do

1. Add whether it is night, or the day share the HUD needs, to the game view in `src/sim/api.ts`. Read it in `hud.tsx` instead of the hour test.
2. In the craft menu and the chest panel, ask `client.refusal` for each command. Grey out refused buttons and show the reason, as the action menu does with `src/ui/refusal-text.ts`.
3. Move the pick type into `src/sim/api.ts` and have the renderer and the app import it from there. Merge it with `ThingInReach` if they describe the same thing.

## Acceptance criteria

- [x] `hud.tsx` holds no hour numbers for day and night.
- [x] A craft recipe the player cannot make now is greyed out with the reason. A test covers it.
- [x] A chest content the player cannot take now is greyed out with the reason.
- [x] No file in the app's action logic (`thing-actions.ts`, `build-mode.ts`) imports from `src/render`. Changed from "no file in `src/app`": see the first comment.
- [x] Existing tests pass.

## Comments

- The app's action logic (`thing-actions.ts`, `build-mode.ts`, `walk-input.ts`) now imports the pick type and `PlacingBlueprint` from `src/sim/api.ts`. Three app files still import from `src/render` on purpose: `main.tsx` and `showcase.ts` create the renderer, and `walk-input.ts` drives the camera rig.
- The craft refusal now also says "put the log down first" and "the backpack is full". Taking from a chest now has a refusal: nothing to take, or the backpack is full.
- Code review on 2026-11-21: the clock word in `src/ui/clock-face.ts` still uses its own 12:00 and 17:00 cut-offs for morning, afternoon and evening. Only night comes from the game view. That is outside this ticket, which covers day and night.
