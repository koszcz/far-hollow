# 09: Fix the code review findings

**Status:** resolved

**Blocked by:** 01 to 08

**Assets:** changes the approved `hud` in code only. Its look is unchanged. The owner asked for these fixes in chat on 2026-11-12.

**What to build:** A code review of this spec found four places where the code did not match the spec, and fourteen places where it broke the repo's standards. Fix them all.

## Spec fixes

- [x] A lone structure, such as a wall on plain ground, opens its right-click menu, so the player can take it down. The menu opens whenever a thing offers an action a left-click does not do. The cursor prompt uses the same rule for "Right-click: More actions".
- [x] E at a work station opens its menu in the middle of the scene, as the prompt's "E" promises.
- [x] The prompt names a finished structure by its kind, such as "Log wall", not "Building piece".
- [x] A woodpile shows "Stack the log" greyed, with the reason "carrying no log", when the player carries nothing.
- [x] Tests cover each of these four fixes.

## Standards fixes

- [x] The cursor prompt is a Preact component, as ADR 0005 asks. It moves by writing its position straight to the element, and renders again only when its words change.
- [x] Code says "backpack content", not "item", as the glossary asks. Player-facing text is unchanged.
- [x] Code comments say "such as", not "e.g.".
- [x] Repeated strings have one entry each: the count format, "needs the …", and "no firewood".
- [x] The action types live in `src/ui/thing-action.ts`, which the app and the UI both import. Hotbar targets reuse the UI's `HotbarTarget`.
- [x] Action ids have a union type, `ActionId`, so code compares them safely.
- [x] The shoulder cell marks itself with its own attribute, `data-prompt-shoulder`.
- [x] The HUD imports `PromptButton` instead of copying it.
- [x] A picked scene thing uses the same kinds as a thing E can reach.
- [x] The fuel, wood, and carried log lists live once, in `src/sim/wood-and-fuel.ts`. The save check and the menus read them from there.
- [x] Tending decides once whether a task is for a campfire or a woodpile.
- [x] The HUD decides in one place which nearby things get a panel.
- [x] The player's tend task has its own sim type, so `entities.ts` no longer imports the commands.
- [x] `takeDown` no longer takes a defaulted id.

## Comments

- The right-click menu of a finished structure with ground under it now lists only "Take down". It no longer lists "Walk here", since the prompt names no left-click action there. A left-click on it still walks.
- E opens a work station's menu in the middle of the scene, where the camera keeps the player. The view has no screen position for the station.
- Review finding 14 asked to share one component-to-kind mapping "if practical". It is not: the renderer finds a picked thing's kind from the mesh it hit, not from its components. Only the kind type is shared.
