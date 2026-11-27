# 16: A save made while the player walks to a chest loads again

**What to build:** Add the `openChest` command to the stored commands that the save check accepts. A save made while the player walks to a chest then loads.

**Status:** resolved

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

`openChest` has an approach rule in `src/sim/chests.ts`, so a pending approach can store it. The save check in `src/sim/save-schema.ts` does not list it in `approachCommand`. A save made during that walk fails the check, so `readSave` returns `notASave`.

The autosave runs every 30 seconds. If it runs during the walk, the start screen shows the slot as broken. If the player then picks that slot, a fresh game starts, and the next autosave overwrites the old game.

`openChest` is the only rule with an approach that the save check is missing. The grilling session on 2026-11-27 checked all 63 of them.

Ticket 10 replaces the hand-written list with a record that TypeScript checks. This ticket is the small fix that lands first.

## Acceptance criteria

- [x] `approachCommand` in `src/sim/save-schema.ts` accepts `{ type: "openChest", chestId }`.
- [x] A test places a chest away from the player, sends `openChest`, and steps once so the approach starts. It then writes the save, reads it back, and checks that the read succeeds and the approach still holds `openChest`.
- [x] `bun test` and `make check` pass.

## Out of scope

- The record of command shapes and dropping a bad approach on load. Ticket 10 does those.
