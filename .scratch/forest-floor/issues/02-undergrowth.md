# 02: Undergrowth

**What to build:** Grass, ferns, flowers, and pebbles grow on the valley's ground. What grows depends on the ground type. Undergrowth is only for looks. See `.scratch/forest-floor/spec.md`.

**Blocked by:** 01 (Ground types)

**Status:** ready-for-agent

**Assets:** Add four drafts: `grass`, `ferns`, `flowers`, and `pebbles`. Each uses Kenney Nature Kit files from `third-party/kenney_nature-kit`, copied into `public/assets/<id>/`. The spec lists the files. The owner approved copying them as drafts in chat on 2026-11-11.

- [ ] Forest floor grows ferns, small rocks, and sparse grass.
- [ ] A clearing grows grass tufts, flowers, and rare stones.
- [ ] A river bank grows tall grass and flat pebbles.
- [ ] The same seed always grows the same undergrowth in the same spots.
- [ ] Undergrowth draws only within about 80 m of where the camera looks. It fades out at the edge, without popping in.
- [ ] The player cannot click or pick up undergrowth. It does not block walking or pathfinding.
- [ ] Undergrowth is not saved. The game logic never sees it.
- [ ] Undergrowth is drawn in batches. The game still runs at 60 fps on an Apple M1 laptop in Chrome.
- [ ] `asset-manifest.json` lists `grass`, `ferns`, `flowers`, and `pebbles` as drafts, with source and license.
- [ ] The asset showcase has a view for each of the four, at `/?asset=<id>`.
- [ ] Unit tests cover the choice of undergrowth by ground type and the same seed giving the same spots.
