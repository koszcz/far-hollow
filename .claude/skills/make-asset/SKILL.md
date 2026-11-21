---
name: make-asset
description: Polish one draft asset, or add one new asset, until the owner approves it.
disable-model-invocation: true
---

# Make an asset

One session makes exactly one asset in the asset catalogue, `asset-manifest.json`: a draft asset to polish, or a new asset. The owner decides at every gate. The rules behind this are in `docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md`. The terms are in the Assets section of `GLOSSARY.md`.

## Work alongside other sessions

The owner may run several make-asset sessions at once, each in its own worktree. They share a session board: one small file per running session, kept in the main checkout at `.claude/asset-sessions/`. Git ignores it, so you never push or pull to see what other sessions do. Use `sessions.sh` in this skill's folder to read and write the board. Call it by the relative path below, from the worktree root:

```sh
.claude/skills/make-asset/sessions.sh list                     # show running sessions; drops entries whose worktree is gone
.claude/skills/make-asset/sessions.sh claim <id>               # claim an asset; fails if another session holds it
.claude/skills/make-asset/sessions.sh step <id> "<n> <name>"   # record your current step, for example "5 build"
.claude/skills/make-asset/sessions.sh files <id> <file>...     # record the shared files you edit
.claude/skills/make-asset/sessions.sh release <id>             # remove your entry
.claude/skills/make-asset/sessions.sh packs                    # print the third-party packs folder and its packs
```

The session runs in an isolated worktree. Its guard refuses commands it cannot check, such as `$(git …)` inside another command, `&&` chains with git, heredocs, and loops. Send one plain command per Bash call. To run a multi-line script, save it with the Write tool, then run the file.

Record your step with `step` each time you start a new step. Other sessions see only the board, not your chat. The pipeline panel in Herdr also reads the board. It draws your session as one card, with a stepper that follows these step names. Use them exactly:

`1 pick`, `2 branch`, `3 learn`, `4 options`, `5 build`, `6 show`, `7 decision`, `8 finish`

When you go back to an earlier step, record that step again. At steps 4, 6, and 7 the card tells the owner it is their move while you wait.

All worktrees share one local `main` branch. To get another session's finished asset, merge local `main`. You do not need to fetch from `origin`.

When you change this skill itself, let running sessions finish on the version they started with. Each one picks up your change when it next runs `make land`.

## Steps

### 1. Pick the asset

Run `sessions.sh list` first. Never pick an asset that another session holds.

If the owner named an asset id, use it. If another session holds it, tell the owner which worktree holds it and stop. Otherwise run `make drafts`, leave out the drafts on the board, and ask the owner which draft to polish. For a new asset, agree its id, a one-line description, and what in the game will use it.

Do not rename the session. Herdr names sessions.

Done when one catalogue id is fixed for this session.

### 2. Open a branch

Work in a worktree on the branch `asset/<id>`. Create it with `git switch -c asset/<id>`, as a command of its own. Then, from that worktree, run `sessions.sh claim <id>`. The board records the worktree you claim from, so claim only after you are in it. If the claim fails, another session took the asset first. Tell the owner and go back to step 1.

Done when you are on that branch and hold the claim.

### 3. Learn how the asset is used

Read the entry's ticket, if it is a draft. Then read the comment at the top of each `code` file. It says which part of the file is this asset. Read whole only the files that build this asset alone, such as `stick-shape.ts`. In shared files, such as `forest-meshes.ts` and `player-mesh.ts`, search for the asset's name and read only the matching parts. Note the asset's size in metres, its pivot, the colours around it, and every animation or state the code drives.

If the asset is an animation, read `animation.md` in this skill's folder now. Plan and build the animation by its rules.

Then record the shared files you will edit with `sessions.sh files <id> ...`. A shared file builds more than this asset, such as `forest-meshes.ts`, `player-mesh.ts`, or a family file in `src/render/showcases/`. Leave out `asset-manifest.json`, because every session edits it. Run `sessions.sh list` and compare. If another session lists the same file, tell the owner which session and which file. Edit only the parts of that file that belong to your asset.

Done when you can name every place that builds, loads, or draws the asset, and the board lists your shared files.

### 4. Propose options

Offer the owner two or three options. Each option is one of:

- **A third-party file**: a specific CC0 file, preferably from Quaternius or Kenney. Give the file name, the page it comes from, its license, its download size, its format (prefer `.glb` for models and `.ogg` for sounds), and why it fits.
- **A code build**: describe what you will build and how it improves on the draft.

Then wait. The owner's choice is the permission to download a file. Download nothing before it.

Look for third-party files in the local packs folder first. It is `third-party/` at the root of the main checkout, and git ignores it. Each pack is unpacked as `third-party/<maker>_<pack>/`, for example `third-party/kenney_nature-kit/`. A Kenney pack has `License.txt`, models under `Models/GLTF format/`, and preview images under `Isometric/`. From a worktree, run `sessions.sh packs` to print the folder's full path and list its packs. Read inside it by that full path.

If the pack you need is not there, give the owner its page link. Ask them to download it and unpack it into `third-party/`. A scripted download from kenney.nl fails with `403 Forbidden`.

Done when the owner has picked one option.

### 5. Build it

- **For a file**: save it under `public/assets/<id>/`. Change the entry to `"kind": "file"`, set `file`, `source`, and `license`, and keep `code` pointing at the code that loads it.
- **For a code build**: change the code files in place. Keep the entry `"kind": "code"`.

Set the entry's approval to pending with `make approve ID=<id> STATUS=pending`. A pending file fails `make check` on purpose: the asset is not approved yet.

Done when the game uses the new asset everywhere step 3 found. For an animation, the pop checks in `animation.md` must also pass.

### 6. Show it

The asset showcase, `/?asset=<id>`, draws the asset with the game's own code, in four labelled views. Each asset's views live in one family file in `src/render/showcases/`. To find an asset's entry, run `grep -rnE '^  "?<id>"?:' src/render/showcases`, then read only that entry. To add a new asset, add it to the file for its family.

**Check it yourself** with `bun scripts/shot.ts "/?asset=<id>" /tmp/<id>/view.png --size 960x600`, then read the image. The script starts its own dev server and waits until the showcase is ready. Each screenshot stays in your context for the rest of the session, so take one per change you need to see, at that small size. Check sizes and positions by reading state instead, as `docs/agents/game-testing.md` describes.

**Show the owner** in their own Chrome, through the Claude in Chrome tools:

1. Start the dev server in the background: `PORT=<free port> bun --hot scripts/dev.ts`.
2. Open `http://localhost:<port>/?asset=<id>` in a new tab. For an animation, open `/?asset=<id>&play` so the owner watches the full loop live. Add `&speed=0.25` for slow motion. If the animation has no `play` entry in the showcase, add one first.
3. Tell the owner the tab's title, such as "Asset: bed". Other sessions open their own tabs in other Chrome windows, so the owner may need to switch windows.
4. After each change, navigate the tab to the same address again. Then wait for `document.body.dataset.showcase` to be `"ready"` in a separate `javascript_tool` call. A `location.reload()` inside `javascript_tool` ends that call with an error.

If no Chrome is connected, ask the owner once to run `/chrome`, then wait for them to say it is done. For a sound, describe when it plays and how loud it is.

Show the asset in the full game only if the owner asks to see it there.

Done when the owner has seen the asset in the running game.

### 7. Get the owner's decision

- **Approved**: run `make approve ID=<id> STATUS=approved`. It records the owner and today's date.
- **Changes wanted**: go back to step 5, or to step 4 for a different option.
- **Rejected**: put the draft back as it was and record nothing new. Run `sessions.sh release <id>`.

Only the owner's words in chat approve an asset.

Done when the owner has approved the asset or rejected it.

### 8. Finish

1. Update the comments at the top of the `code` files so they call the asset approved, not a draft.
2. Run `make fix`. It formats the code and fixes the lint errors that have a safe fix, so the pre-commit check passes.
3. Commit on `asset/<id>`.
4. Run `make land`. It merges local `main` into your branch, runs `make check`, moves `main` to your branch, pushes `main`, and deletes your branch. It tries again when another session lands first. If it stops on a conflict in `asset-manifest.json`, keep every entry from both sides, commit, and run `make land` again.
5. Run `sessions.sh release <id>`.

Done when `main` is pushed with the approved asset and the board no longer lists your session.
