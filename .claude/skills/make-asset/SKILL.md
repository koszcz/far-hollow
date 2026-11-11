---
name: make-asset
description: Polish one draft asset, or add one new asset, until the owner approves it.
disable-model-invocation: true
---

# Make an asset

One session makes exactly one asset in the asset catalogue, `asset-manifest.json`: a draft asset to polish, or a new asset. The owner decides at every gate. The rules behind this are in `docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md`. The terms are in the Assets section of `GLOSSARY.md`.

## Steps

### 1. Pick the asset

If the owner named an asset id, use it. Otherwise run `make drafts` and ask the owner which draft to polish. For a new asset, agree its id, a one-line description, and what in the game will use it.

Done when one catalogue id is fixed for this session.

### 2. Open a branch

Work in a worktree on the branch `asset/<id>`.

Done when you are on that branch.

### 3. Learn how the asset is used

Read the entry's ticket, if it is a draft. Then read the comment at the top of each `code` file. It says which part of the file is this asset. Read whole only the files that build this asset alone, such as `stick-shape.ts`. In shared files, such as `forest-meshes.ts` and `player-mesh.ts`, search for the asset's name and read only the matching parts. Note the asset's size in metres, its pivot, the colours around it, and every animation or state the code drives.

If the asset is an animation, read `animation.md` in this skill's folder now. Plan and build the animation by its rules.

Done when you can name every place that builds, loads, or draws the asset.

### 4. Propose options

Offer the owner two or three options. Each option is one of:

- **A third-party file**: a specific CC0 file, preferably from Quaternius or Kenney. Give the file name, the page it comes from, its license, its download size, its format (prefer `.glb` for models and `.ogg` for sounds), and why it fits.
- **A code build**: describe what you will build and how it improves on the draft.

Then wait. The owner's choice is the permission to download a file. Download nothing before it.

Look for third-party files in the local packs folder first. It is `third-party/` at the root of the main checkout, and git ignores it. Each pack is unpacked as `third-party/<maker>_<pack>/`, for example `third-party/kenney_nature-kit/`. A Kenney pack has `License.txt`, models under `Models/GLTF format/`, and preview images under `Isometric/`. From a worktree, find the folder with this command:

```sh
echo "$(git rev-parse --path-format=absolute --git-common-dir)/../third-party"
```

If the pack you need is not there, give the owner its page link. Ask them to download it and unpack it into `third-party/`. A scripted download from kenney.nl fails with `403 Forbidden`.

Done when the owner has picked one option.

### 5. Build it

- **For a file**: save it under `public/assets/<id>/`. Change the entry to `"kind": "file"`, set `file`, `source`, and `license`, and keep `code` pointing at the code that loads it.
- **For a code build**: change the code files in place. Keep the entry `"kind": "code"`.

Set the entry's `approval` to `{ "status": "pending" }`. A pending file fails `make check` on purpose: the asset is not approved yet.

Done when the game uses the new asset everywhere step 3 found. For an animation, the pop checks in `animation.md` must also pass.

### 6. Show it

Start the `dev` preview and open `/?asset=<id>`. The asset showcase draws the asset with the game's own code, in four labelled views. When `document.body.dataset.showcase` is `"ready"`, take one screenshot and send it to the owner. For an animation, do not send stills. Open `/?asset=<id>&play` instead, so the owner watches the full animation loop in the browser pane. Add `&speed=0.25` for slow motion. If the animation has no `play` entry in the showcase, add one first. To change the views, or to add a new asset, edit `src/render/asset-showcase.ts`. For a sound, describe when it plays and how loud it is.

Show the asset in the full game only if the owner asks to see it there.

Done when the owner has seen the asset in the running game.

### 7. Get the owner's decision

- **Approved**: set `approval` to `{ "status": "approved", "by": "owner", "date": "<today, YYYY-MM-DD>" }`.
- **Changes wanted**: go back to step 5, or to step 4 for a different option.
- **Rejected**: put the draft back as it was and record nothing new.

Only the owner's words in chat approve an asset.

Done when the owner has approved the asset or rejected it.

### 8. Finish

Update the comments at the top of the `code` files so they call the asset approved, not a draft. Run `make check`. Commit, merge the branch into `main`, and push.

Done when `main` is pushed with the approved asset.
