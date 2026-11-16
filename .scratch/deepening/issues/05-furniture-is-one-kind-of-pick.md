# 05: Furniture is one kind of pick, and each definition names its use

**What to build:** When the player points at a piece of furniture, the pick says "furniture" and names the piece. Each furniture definition says which command using it sends, if any. The action menu reads that from the definition instead of switching on each piece.

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

The comment at the top of `src/sim/furniture.ts` lists 11 places to edit for a new piece. Some of them belong apart, such as the mesh, the showcase, and the build menu icon. Two of them exist only because each piece is its own kind of pick:

- `src/sim/reach.ts:46` turns `entity.furniture` into its own pick kind, so `ScenePick` and `ThingInReach` grow by one variant per piece.
- `thingActions` in `src/app/thing-actions.ts:143-152` has one case per piece: open for a chest or shelf, sleep for a bed, nothing for a table, and sit for a stool.

`src/sim/beds.ts` and `src/sim/stools.ts` also check the piece by name when they look it up.

## What to do

1. Change the pick for furniture to one kind that names the piece and its id.
2. Add the use to each definition in `src/sim/furniture/*.ts`: the command it sends and the action id the menu shows, or none. Keep labels and order in the UI, as ADR 0008 requires. The definition names an action id, not text.
3. Replace the per-piece cases in `thingActions` with one furniture case that reads the definition.
4. Remove the two lines for the pick and the menu from the checklist in `src/sim/furniture.ts`.

## Acceptance criteria

- [ ] `ScenePick` and `ThingInReach` have one variant for furniture.
- [ ] `thingActions` has no case for a single piece of furniture.
- [ ] Each piece offers the same actions as before. The furniture cases in `src/app/thing-actions.test.ts` pass.
- [ ] Adding a piece needs no edit to `src/sim/reach.ts` or `src/app/thing-actions.ts`.
- [ ] Existing tests pass, including `src/sim/furniture.test.ts`.

## Comments
