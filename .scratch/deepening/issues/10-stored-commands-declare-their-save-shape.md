# 10: Each stored command declares its own save shape, so every save loads

**What to build:** Each command that a rule stores for a walk-first approach declares its stored shape next to its rule. The save check builds its list of stored commands from those declarations. A rule with an approach can no longer exist without a stored shape.

**Status:** idea

**Blocked by:** None

**Assets:** None. This ticket changes no asset.

## Why

Under ADR 0010, a pending approach stores its command. The save check in `src/sim/save-schema.ts` keeps its own hand-written list of stored commands. Nothing links that list to the rules, at compile time or in a test.

This causes a live bug. `openChest` has an approach rule in `src/sim/chests.ts`, but it is missing from the save check's list. If the autosave runs while the player walks to a chest, the save fails to load. `continueOrStartGame` in `src/sim/save.ts` then starts a fresh game with a "saveBroken" notice, so the player loses their progress. The architecture review on 2026-11-27 reproduced this with a throwaway test: place a chest, send `openChest`, step once, then `readSave(writeSave(game))` returns `notASave`.

Every new walk-first command repeats this risk. The wood box and the drying rack each added lines to the list by hand.

A related problem: many save versions exist only because a feature added a kind, and their upgrade does nothing (`nothingToUpgrade`). About 51 test files import a feature's own save version constant. Merges have hit conflicts over the order of these upgrades.

## Acceptance criteria

- [ ] A save written while the player walks to a chest loads again.
- [ ] One table-driven test runs every command rule that has an approach through `writeSave` and `readSave`.
- [ ] Adding a rule with an approach but no stored shape fails the type check or that test.
- [ ] Every older save still loads (ADR 0011).
- [ ] `bun test` and `make check` pass.

Questions for grilling:

- Fix the `openChest` bug first as its own small change, or only as part of this ticket?
- Does a stored shape live in the rule's own module, or in one list that the rules import?
- Should this ticket also stop adding save versions that only add a kind? If so, how do feature tests stop asserting their own version?
- When a save holds a stored command the game no longer knows, should it drop the approach and keep the rest of the save, instead of refusing the whole save?
