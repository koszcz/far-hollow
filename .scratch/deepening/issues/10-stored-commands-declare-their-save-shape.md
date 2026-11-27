# 10: The save check knows the shape of every action command, and a bad approach no longer breaks a save

**What to build:**

1. The save check gets one record that gives the shape of every action command type. TypeScript reports a missing type. This record replaces the hand-written `approachCommand` and `tendCommand` lists.
2. When a saved `approach` holds a command that fails its check, loading drops that approach and keeps the rest of the save.

**Status:** resolved

**Blocked by:** 16

**Assets:** None. This ticket changes no asset.

## Why

Under ADR 0010, a pending approach stores its command. The save check in `src/sim/save-schema.ts` keeps its own hand-written list of the commands an approach may hold. Nothing links that list to the command rules, at compile time or in a test. `openChest` was missing from it, and a save made while the player walked to a chest could not load. Ticket 16 fixes that one case. This ticket stops the next one.

Every new walk-first command repeats the risk. The wood box and the drying rack each added lines to the list by hand.

## Decisions from grilling, 2026-11-27

- **One record in the save check, keyed by command type.** It sits in `src/sim/save-schema.ts` and works like `COMPONENT_CHECKS`: a record typed `{ [Type in ActionCommand["type"]]: Check }`, so TypeScript reports a missing entry. Rules do not declare their own shape, so rule modules do not import the save-check helpers.
- **The record covers every `ActionCommand` type,** about 86 of them, not only the commands that walk first. TypeScript cannot tell which rules have an approach, because that is decided when the game runs. Covering all of them is the only way the compiler can check the record is complete.
- **The approach is the one component that may be dropped on load.** If the command in a saved `approach` fails its check, the loader removes the `approach` component and keeps everything else. Every other component stays strict.
- **The player keeps walking.** The loader keeps `walkPath`. This matches an approach that ends early today: the player finishes the walk, and nothing happens on arrival (`src/sim/approach.ts`).
- **The player sees no notice.** The loader logs a `console.warn` that names the command type.
- **The start screen agrees with the loader.** `describeSave` must show a slot as filled when the only problem is a bad approach. Today it uses the same `isValidSave` check as `readSave`, so a fix in one place must reach both.
- **Saves that already broke this way load again.** A player whose save broke during a walk to a chest, and who has not started a fresh game in that slot, gets their game back.

## Acceptance criteria

- [ ] `save-schema.ts` has one record keyed by every `ActionCommand` type. `approachCommand` and `tendCommand` are gone, and the `approach` component's check uses the record.
- [ ] Leaving a command type out of the record is a type error.
- [ ] A test file holds one sample command per `ActionCommand` type, in a record that TypeScript checks is complete. A test checks that each sample passes the save check.
- [ ] A test writes a save, replaces the `approach` command with one of an unknown type, and reads it back. The read succeeds. The player has no `approach`, still has the `walkPath`, and the rest of the game matches.
- [ ] The same broken save shows as filled on the start screen. `describeSave` returns `filled`, not `broken`.
- [ ] A save that fails for any other reason is still refused.
- [ ] Every older save still loads (ADR 0011). The save version does not change, because the stored data does not change.
- [ ] `bun test` and `make check` pass.

## Out of scope

- Stopping save versions that only add a kind. Ticket 17 is about that.
- Moving command shapes into each rule's module.
- Saving the action queue.
