# 01: Cap the length of CSS files

**What to build:** A check that fails `make check` when a CSS file is longer than its cap. Oxlint does not read CSS, so this needs its own script. See `.scratch/file-length/spec.md`.

**Blocked by:** None

**Status:** resolved

**Assets:** None. This ticket changes tooling only.

## Acceptance

- [ ] `scripts/check-file-length.ts` checks every tracked CSS file, except files under `.scratch/`.
- [ ] The script holds one CSS cap, set to 1619, the length of `src/app/style.css` today. It fails and names each file that is over the cap.
- [ ] A comment next to the cap says: lower this cap whenever a split brings the longest file down. Never raise it.
- [ ] `package.json` runs the script as `check:lengths`. `make check` runs `check:lengths`.
- [ ] The script has a test. The test shows that a file one line over the cap fails, and a file at the cap passes.
- [ ] `make check` passes on `main`.
