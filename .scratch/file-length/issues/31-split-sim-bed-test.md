# 31: Split `src/sim/bed.test.ts` into files under 500 lines

**What to build:** Split `src/sim/bed.test.ts` along its real seams, so that no file is over 500 lines. See `.scratch/file-length/spec.md`.

**Blocked by:** None

**Status:** resolved

**Assets:** None. This ticket changes code layout only.

## Acceptance

- [ ] Every file the split creates is 500 lines or fewer. `src/sim/bed.test.ts` is gone, or it is 500 lines or fewer.
- [ ] Each new module holds one area of behaviour and is named for what it does. Read the `mattpocock-skills:codebase-design` skill before you choose the seams.
- [ ] Callers import from the new modules directly. No file re-exports the old path.
- [ ] No behaviour changes. `bun test` reports the same number of tests before and after.
- [ ] No `oxlint-disable` comment for `max-lines`.
- [ ] After you merge `main`, set the `max` of `max-lines` in `.oxlintrc.json` to the length of the longest file that oxlint checks. Update the comment above the rule to name that file and the date.
- [ ] Any cleanup you notice is a new `idea` ticket in the feature folder it belongs to, not part of this split.
