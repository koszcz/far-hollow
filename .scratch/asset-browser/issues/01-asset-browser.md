# 01: Asset browser

**What to build:** One page on the dev server, `/?assets`, that lists every asset in the asset catalogue, `asset-manifest.json`, and shows the chosen asset's showcase beside the list. A sidebar lets the owner search, filter, and pick an asset. The main view loads that asset's showcase in a frame and shows its catalogue entry.

**Status:** resolved

**Assets:** None (settled 2026-11-24). The browser reuses each asset's existing showcase and adds or changes no asset.

## What exists already

- Every catalogue asset with code has a showcase at `/?asset=<id>`. A test checks this in `src/render/asset-showcase.test.ts`. See `src/render/asset-showcase.ts` and `src/app/showcase.ts`.
- `&play` plays an animation live, and `&speed=0.25` slows it down.
- `src/app/boot.ts` opens the showcase only on the dev server.
- `src/render/showcases/index.ts` merges eight family files into one map, so the family of each asset is lost there.

## The page

- [x] `/?assets` opens the asset browser on the dev server only. The production build does not include it.
- [x] `/?assets=<id>` opens the browser with that asset chosen.
- [x] The address records the chosen asset, still views or play, and the speed, for example `/?assets=bed&play&speed=0.25`. Reloading the page restores all three.

## Sidebar

- [x] The sidebar lists every catalogue asset, grouped by showcase family: nature, building, camp, interface, weather, valley life, sound, and animations. An asset with no showcase is listed in its own group.
- [x] Each asset shows its status: draft, pending, or approved.
- [x] A search box filters the list by id or description.
- [x] A "Not approved" filter shows only draft and pending assets.
- [x] The up and down arrow keys move to the previous or next asset in the list. The `/` key moves to the search box.
- [x] The sidebar shows no preview pictures.

## Main view

- [x] The main view loads `/?asset=<id>` in a frame, so each asset gets a fresh page.
- [x] Below or beside the frame, the main view shows the catalogue entry's description, source, licence, and code files.
- [x] For an asset with no showcase, the main view shows the catalogue entry and the note "No showcase" instead of the frame.
- [x] A switch chooses between the four still views and live play. Play is greyed out for an asset whose showcase has no `play` entry.
- [x] A speed control offers 0.25, 0.5, 1, and 2. It applies only to live play.
- [x] An "Open alone" link opens the bare showcase, `/?asset=<id>` with the current options, in a new tab.
- [x] The browser is read-only. It offers no way to approve or change an asset. Approval stays in chat through the `make-asset` skill.

## Showcase changes

- [x] Each family file in `src/render/showcases/` is exported with its family name, so the browser can group assets. `SHOWCASES` stays as it is for the showcase page.
- [x] `Showcase` gets an optional `overlay` field, `"hud"` or `"sound"`. It replaces the hard-coded list of HUD ids and the `sound-` prefix check in `src/app/showcase.ts`.
- [x] The showcase page at `/?asset=<id>` looks and behaves as before. The `make-asset` skill needs no change.

## Docs and tests

- [x] `GLOSSARY.md` defines asset showcase and asset browser. This is done already.
- [x] The dev server's address options are noted where `/?asset=<id>` is documented today, in the comment at the top of `src/app/boot.ts`.
- [x] Unit tests check that every showcase id is in exactly one family.
- [x] Unit tests check that search matches by id and by description.
- [x] Unit tests check the "Not approved" filter.
- [x] Unit tests check that the address is read and written correctly.
- [x] Unit tests check that the `overlay` field marks the same assets as the old HUD list and the `sound-` ids.
- [x] An e2e test opens `/?assets=bed`, picks another asset, and checks that the frame's showcase reaches `document.body.dataset.showcase === "ready"`.
