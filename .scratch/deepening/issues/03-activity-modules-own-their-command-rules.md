# 03: Each activity module declares its own command rule

**What to build:** Each activity module, such as `fishing.ts` or `beds.ts`, exports the command rules for its commands. `src/sim/game.ts` collects them instead of writing each rule itself. A new command needs edits in its own activity module, the UI, and strings, and nowhere else in the sim.

**Blocked by:** 01, 02

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

`commandRules` in `src/sim/game.ts` is a good seam, but most rules only forward to an activity module. One command's meaning is spread over:

- the `Command` union in `src/sim/api.ts:46-221`;
- its rule in `src/sim/game.ts:480-790`;
- for tend commands, also `TendTask` (`src/sim/entities.ts:29-35`), `TEND_REACH` (`game.ts:75-90`), the `tendNow` switch (`game.ts:372-413`), and two `placeOf` lookups (`game.ts:427` and `src/sim/tending.ts:26`);
- its task component in `src/sim/entities.ts`;
- its save check in `src/sim/save-schema.ts`;
- `TASK_PARTS` in `src/sim/activity.ts`.

A new refusal also needs `PlainRefusal` (`api.ts:454`) and `PLAIN_REFUSALS` (`save-schema.ts:156`). A new notice needs `notices.ts`, `save-schema.ts:193`, and `api.ts:344`.

Tickets 01 and 02 remove the per-kind task components and the duplicated refusals. After them, most of what is left in each rule belongs to its activity module.

## What to do

1. Design the shape with the owner before you write it. Settle these questions:
   - Does the `Command` union stay in `api.ts`, or does `api.ts` build it from the activity modules' declarations?
   - Can a save check for a command come from the same declaration as the command, so `save-schema.ts` stops mirroring it by hand?
   - Where do tend commands' reach and place lookup live?
2. Move one activity's rules first, such as fishing, and review the result with the owner.
3. Move the rest.
4. Keep `game.ts` responsible for what every command shares: hands busy with a sled, standing up from a stool, cancelling tasks, and the action queue.

## Acceptance criteria

- [ ] `commandRules` in `game.ts` lists modules' rules. It holds no per-command logic.
- [ ] Adding a command touches its activity module, `src/sim/api.ts` if the union stays there, the UI files that offer it, and `src/strings.ts`. A comment in `game.ts` lists the files.
- [ ] `TEND_REACH`, `tendNow`, and the two `placeOf` lookups are gone or live in one place.
- [ ] Existing tests pass, including `src/sim/game.test.ts` and `src/sim/action-queue.test.ts`.

## Comments
