# 08: Each furniture piece lives in one place

**What to build:** A refactor with no change the player can see. Adding a furniture piece today means editing the same 17 shared files. Tickets 04 (table) and 05 (stool) changed the same lines in all of them, so whichever landed second had to resolve conflicts in each file. After this ticket, a new piece is its own files plus one line in a shared list.

**Blocked by:** none

**Status:** needs-triage

**Assets:** none. The ticket moves code and adds no asset.

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

## Direction

Design it first with the `codebase-design` skill. One possible shape:

- One `furniture: { kind: FurnitureKind }` part on the entity replaces the per-piece flags. Pieces with their own state, such as chest and shelf contents, keep it in a separate part.
- One furniture list, built from the pieces' own definitions, drives reach, taking down, the mesh lists, hit tests, and outlines. Shared code loops over that list and names no piece.
- The save schema accepts any `FurnitureKind`. A new piece needs no save upgrade, because older saves simply have none.
- Each piece has its own files for its rules, mesh, icon drawing, and showcase. The shared list imports them.
- Comments describe the shared rule and do not list the pieces that use it.

What each piece does, such as sleeping in the bed or sitting on the stool, stays in that piece's own module.

## Done when

- [ ] Saves from before this ticket load and keep every piece of furniture. A save upgrade turns the old per-piece flags into the new form.
- [ ] Shared files no longer name single furniture pieces, except for the one list of pieces and the strings file.
- [ ] A short note in the furniture code says which files a new piece adds and which line it adds to the list.
- [ ] The existing furniture tests and e2e tests pass without changes to what they check.
- [ ] `make check` passes.
