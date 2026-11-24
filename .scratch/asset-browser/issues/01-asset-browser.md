# 01: Asset browser

**What to build:** One page on the dev server that lists every asset in the catalogue, `asset-manifest.json`, and shows the chosen asset beside the list. It works like Storybook: a sidebar to search and pick, and a main view that draws the asset.

**Status:** idea

**Assets:** None. The browser reuses each asset's existing showcase.

## What exists already

- Every one of the 115 catalogue assets has a showcase at `/?asset=<id>`. The showcase draws 3D objects, animations, HUD icons, UI, and sounds. See `src/render/asset-showcase.ts` and `src/app/showcase.ts`.
- `&play` plays an animation live, and `&speed=0.25` slows it down.
- What is missing is a way to browse. Today you must know an asset's id and type the address.

## Rough shape

- A sidebar groups assets by showcase family (nature, camp, building, interface, sound, and so on).
- The sidebar shows each asset's status, draft or approved, and lets you search by id or description.
- The main view loads the asset's showcase. It shows the catalogue entry's description, source, licence, and code files.
- Buttons switch between the four still views and live play, and set the speed.

Questions for grilling:

- Where does the page live: `/?assets` on the dev server, or its own page and build?
- Does the main view embed the showcase in a frame, or draw it directly? A frame keeps each showcase's WebGL context separate. Drawing directly switches faster.
- Should the sidebar show small preview pictures? If so, are they rendered live, or saved as images by `make shot`?
- Should the browser offer controls beyond play and speed, such as time of day, weather, or wind?
- Should the owner approve a draft from the browser, or keep approval in the `make-asset` skill?
- Does the `make-asset` skill link to the browser when it shows an asset to the owner?
- Does `src/app/showcase.ts` need its hard-coded list of HUD showcase ids replaced by a field on each showcase first?
