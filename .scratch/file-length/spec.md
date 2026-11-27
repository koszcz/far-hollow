# File length: no file over 500 lines

## Problem

Implementer subagents use most of this repo's token spend. Much of it goes to reading big files whole (see `.scratch/token-economy/spec.md`). The token-economy work capped file length at 1175 lines, the longest file on 2026-11-27. That cap stops files from growing, but it saves nothing yet.

On 2026-11-27, 29 `.ts` and `.tsx` files in `src/` were over 500 lines. `src/app/style.css` had 1619 lines, and oxlint does not check CSS.

## Goal

No source file, test file, or CSS file is over 500 lines. After that, each cap keeps ratcheting: lower it whenever a split brings the longest file down, and never raise it.

## Rules for every split

- Every line counts toward the cap, including blank lines and comments.
- Split along real seams. Each new module holds one area of behaviour and is named for what it does. Read the `mattpocock-skills:codebase-design` skill before you choose the seams.
- Callers import from the new modules directly. No barrel file re-exports the old path.
- Do not add an `oxlint-disable` comment for `max-lines`, not even in a data file like `src/strings.ts`.
- A split is a pure move. Behaviour does not change, and `bun test` reports the same number of tests before and after. Rename only where a new module needs a better name.
- If the split reveals cleanup work, write it up as a new `idea` ticket in the feature folder it belongs to. Do not do it in the split.

## Lowering the caps

Each ticket lowers its cap when it lands, after it merges `main`:

- For `.ts` and `.tsx` files, set the `max` of `max-lines` in `.oxlintrc.json` to the length of the longest file that oxlint checks. Update the comment above the rule to name that file and the date.
- For `.css` files, set the CSS cap in `scripts/check-file-length.ts` to the length of the longest tracked CSS file outside `.scratch/`.

When two tickets land close together, they clash on the cap line. Recompute the longest file on the merged `main`, and commit that number.

## Tickets

No ticket blocks another, except that ticket 02 needs the CSS check from ticket 01. Tickets 03 to 31 are ordered by file length, longest first. Each names its file, not a line count, because the counts drift as other work lands.

- `issues/01-css-length-check.md`
- `issues/02-split-style-css.md`
- `issues/03-…` to `issues/31-…`: one split per file
