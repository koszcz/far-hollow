# 02: Split `src/app/style.css` into files under 500 lines

**What to build:** Split `src/app/style.css` by area of the interface, so that no CSS file is over 500 lines. See `.scratch/file-length/spec.md`.

**Blocked by:** 01

**Status:** resolved

**Assets:** None. This ticket changes code layout only.

## Acceptance

- [ ] Every CSS file the split creates is 500 lines or fewer. `src/app/style.css` is gone, or it is 500 lines or fewer.
- [ ] Each new file holds the styles for one area, such as the HUD, the menus, or the journal, and is named for it.
- [ ] Rules keep their order wherever order changes the result, so the game looks the same.
- [ ] A screenshot of the HUD and of each menu matches one taken before the split. Use `make shot` with `--compare`.
- [ ] After you merge `main`, set the CSS cap in `scripts/check-file-length.ts` to the length of the longest CSS file.
