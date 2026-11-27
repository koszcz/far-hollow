# 13: A furniture definition owns its whole piece

**What to build:** `FurnitureDefinition` also answers whether a piece is empty, how its part is saved and checked, what its nearby view shows, and the label and icon of each use. Adding a furniture piece then means writing its definition, its system, its meshes, and its icon.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

Adding a furniture piece is a registration spread over many files. The wood box (95178c3) changed 26 existing files and added 6. The drying rack (39a9c12) touched 49 files. The wall swap (3c08d2c), which had no UI, touched 12.

Examples of the spread:

- `holdsSomething` in `src/sim/taking-down.ts` grows one clause per container.
- `finishedParts` is a `Pick<Entity, ...>` that grows with each piece.
- Use names live in 3 lists: the `FurnitureUse.name` union, `FURNITURE_USE_ACTIONS` in `src/app/thing-actions.ts`, and `ActionId` in `src/ui/thing-action.ts`.

Ticket 05 already made furniture one kind of pick. This ticket carries the same idea into save, take-down, and the HUD.

## Acceptance criteria

- [ ] `holdsSomething` asks each definition instead of naming each container.
- [ ] Catalogue tests run over every definition, such as "every container refuses take-down while full" and "every part round-trips through the save".
- [ ] Parts stay miniplex components (ADR 0003).
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Which of the four answers come first? Emptiness and save are the smallest.
- Can the HUD nearby panel be built from the definition, or does each piece need its own panel?
- Does this overlap with ticket 10, since both touch the save check?
