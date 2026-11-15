# 08: Each furniture piece lives in one place

**What to build:** A refactor with no change the player can see. Adding a furniture piece today means editing the same 17 shared files. Tickets 04 (table) and 05 (stool) changed the same lines in all of them, so whichever landed second had to resolve conflicts in each file. After this ticket, a new piece is its own files, its name in one list, and one line in each layer's furniture record. The type checker names every record the new piece is missing from.

**Blocked by:** none

**Status:** ready-for-agent

**Assets:** none. The ticket moves code and adds no asset. If a file named in an asset's `code` field moves, update that field.

## Why

The 2026-11-15 retro found that tickets 02 to 05 could not run side by side. Each one edited the same spots:

- `FurnitureKind` in `src/sim/structure-kind.ts`
- a flag per piece on the entity (`bed?: true`, `table?: true`, `stool?: true`) in `src/sim/entities.ts`, with a matching line in `src/sim/save-schema.ts`
- a save upgrade per piece in `src/sim/save.ts` that changes nothing, only so the version goes up (`addTables`, `addStools`)
- a line per piece in `src/sim/reach.ts`, `src/sim/taking-down.ts`, and `src/sim/api.ts`
- kind lists, mesh lists, hit tests, and outlines per piece in `src/render/structure-meshes.ts` and `src/render/scene-renderer.ts`
- a showcase entry in `src/render/showcases/building.ts`, an icon in `src/ui/furniture-icons.tsx`, a name in `src/strings.ts`, and a row in `src/ui/hud-showcase.tsx`
- comments and catalogue descriptions that name every piece, such as "The bed, the shelf, the table, and the stool use it"

The stool session cost about 33M tokens, twice as much as the table, mostly because of these conflicts.

## Design

The owner approved this design on 2026-11-15, after a session with the `codebase-design` skill.

### The list of pieces

`src/sim/structure-kind.ts` holds `FURNITURE_KINDS = ["chest", "shelf", "bed", "table", "stool"] as const`, next to `WORK_STATION_KINDS`. `FurnitureKind` comes from it. This is the only list that names every piece.

One list cannot reach every layer. ADR 0001 keeps game logic from importing drawing or UI code, and Bun has no `import.meta.glob` to find piece files on its own. So each layer keeps one record of its pieces, typed `Record<FurnitureKind, …>`. When a new name goes into `FURNITURE_KINDS`, the type checker reports each record that lacks it.

### Entity parts

- One part, `furniture: FurnitureKind`, replaces `chest`, `shelf`, `bed`, `table`, and `stool`. It holds a plain name, as `workStation` and `edgePiece` already do.
- One shared part, `storage: { contents: BackpackContents }`, holds what a chest or shelf holds. Any later piece that stores things uses it too.
- The finished marker for every piece is `"furniture"`. Like `edgePiece`, the part holds the kind's name.
- `furnitureEntities(store)` returns finished furniture, and code that needs one kind filters by `furniture`. It replaces `bedEntities`, `tableEntities`, and the others.

### Game logic: one definition per piece

Each piece has a definition file under `src/sim/furniture/`, such as `src/sim/furniture/stool.ts`. A definition holds only data and the piece's own rules:

- `kind`, `cost`, `buildSeconds`, and `size`
- `blocks`: either a walk-block radius, or the walk-map cells under the piece (the bed and the table block cells)
- `storage`, if it stores things: its weight limit and its "full" notice
- `reachHeight`, for the hand reach, such as "waist" for a chest

A shared helper, `freelyPlaced(definition)`, turns a definition into a `StructureDefinition`. Placement, snapping, height, the placement check, and `finish` are the same for every piece today, so they live in the helper once.

`src/sim/furniture.ts` holds `FURNITURE: Record<FurnitureKind, FurnitureDefinition>`. The following loop over it and name no piece: `STRUCTURES`, `reach.ts`, `taking-down.ts`, `save-schema.ts`, and `chests.ts`. `chests.ts` reads the weight limit and the notice from `storage`, in place of its own per-piece tables.

Keep the definition files apart from the behaviour files, such as `stools.ts` and `beds.ts`. `structures.ts` imports the definitions, and the definitions import helpers from building code. A behaviour file that both defines a piece and imports `structures.ts` makes an import loop that fails when the game loads.

### What each piece does stays with the piece

Sleeping, sitting, eating at a table, and opening a chest stay in `beds.ts`, `stools.ts`, `tables.ts`, and `chests.ts`. Their commands and views stay in `api.ts` as they are: `sleepInBed`, `sitOnStool`, `openChest`, `ChestView`, `bedTask`, `stoolTask`, and `sitting`. These are each piece's own interface, not shared plumbing. The tests in `walk-input.test.ts` and `thing-actions.test.ts` check these commands exactly.

`ThingInReach.kind` and `StructureHit.kind` include `FurnitureKind` in place of the five names. `reach.ts` returns `{ kind: entity.furniture, id }`, so tests that expect `{ kind: "stool", id }` still pass.

### Drawing

- `FurnitureMeshes` in `plank-furniture-meshes.ts` is already the interface the shelf, bed, table, and stool meshes meet. The chest gets a thin wrapper around `chest-meshes.ts` that meets it too.
- `src/render/furniture-meshes.ts` holds `Record<FurnitureKind, (entities) => FurnitureMeshes>`. `structure-meshes.ts` and `scene-renderer.ts` loop over it for updates, hit tests, outlines, and the blueprint under the mouse.
- Each piece's showcase moves to its own file, such as `src/render/showcases/furniture/stool.ts`, and one record lists them.

### Interface

- `src/ui/furniture-icons.tsx` holds `Record<FurnitureKind, …>`. The chest's entry points at its approved icon in `build-icons.tsx`.
- The build-menu rows in `hud-showcase.tsx` come from the furniture definitions, not a hand-written list.
- `src/strings.ts` keeps one name per piece. That is expected.

### Saves

Add one last save upgrade. It turns each old part into the new form, with fixed names, as every upgrade does:

- `bed: true`, `table: true`, and `stool: true` become `furniture: "bed"`, `"table"`, and `"stool"`.
- `chest: { contents }` and `shelf: { contents }` become `furniture: "chest"` or `"shelf"`, plus `storage: { contents }`.
- Blueprints and `builtCost` need no change, since they already store the structure's name.

After this, a new piece needs no save upgrade. Older saves have none of it, and older code already turns away a save that holds a name it does not know. Leave the existing `addShelves`, `addBeds`, `addTables`, and `addStools` in place, because stored saves count on each version number.

### Comments

Comments describe the shared rule. They do not list the pieces that use it. For example, write "Draws one kind of plank furniture", not "The bed, the shelf, the table, and the stool use it".

## Done when

- [ ] Saves from before this ticket load and keep every piece of furniture and everything in each chest and shelf. The save upgrade above turns the old parts into the new form.
- [ ] Shared code names no single furniture piece. The exceptions are `FURNITURE_KINDS`, each layer's furniture record, `src/strings.ts`, the save upgrades, and each piece's own commands and views in `api.ts`.
- [ ] A short note in `src/sim/furniture.ts` lists the files a new piece adds and each record it adds a line to.
- [ ] The existing furniture tests and e2e tests pass without changes to what they check. Only the test code that reads a chest's or shelf's contents changes, from `shelf.shelf.contents` to `shelf.storage.contents`.
- [ ] `make check` passes.
