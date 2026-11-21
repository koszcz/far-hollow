# 01: Compare a page's screenshots on two commits

**What to build:** `scripts/shot.ts` gets a `--compare <commit>` option. It takes the screenshot on the current code and on the given commit, then prints how many pixels differ and where. An agent can then check that a refactor left a page looking the same, without reading either image.

**Status:** needs-triage

**Assets:** None. This ticket changes no asset.

## Why

On 2026-11-21, three sessions checked that a render refactor left showcases unchanged: the fireplace fire effect, and the lean-to, log wall, and sled drag animation in the value-objects work. Each one did it by hand:

1. It added a detached git worktree at the old commit and linked `node_modules` into it.
2. It ran `shot.ts` in both folders.
3. It wrote a Python script to compare the images. Every one failed, because Python's image library (PIL) is not installed.

The fallbacks were worse:

- `cmp` only says whether two files are byte-for-byte identical. Renders that vary a little between runs showed as different, so the agent had to take the shots again to tell noise from change.
- Reading both PNGs puts two images into context for the rest of the session. `docs/agents/game-testing.md` explains why that is expensive.

## What to do

1. Add `--compare <commit>` to `scripts/shot.ts`. Build the old shot from a temporary worktree at that commit, and remove the worktree afterwards.
2. Compare the two images without new system tools. One option: load both PNGs into the Playwright page that `shot.ts` already opens, draw them on a canvas, and compare the pixel data. A small PNG package from npm is another option.
3. Print the share of pixels that differ by more than a small threshold, and the box that holds them. Exit with a non-zero code when the share is above a limit that a `--tolerance` option sets.
4. Save a diff image next to the output file, for the cases where someone needs to look.
5. Document the option in the header of `shot.ts`, in `docs/agents/game-testing.md`, and in the `shot` target of the `Makefile`.

## Acceptance criteria

- [ ] `bun scripts/shot.ts "/?asset=fire-effect" /tmp/fire.png --compare HEAD` reports no difference.
- [ ] A commit that moves a mesh reports a difference, with its box.
- [ ] Small run-to-run noise stays under the default tolerance. A test or a repeated run shows this.
- [ ] The temporary worktree is gone after the run, including when the run fails.
- [ ] No Python and no system image tools are needed.
