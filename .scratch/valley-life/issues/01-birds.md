# 01: Birds fly over the trees and land in clearings

**What to build:** By day, small flocks of birds fly over the treetops, and a few birds peck on the ground in clearings near the player. A bird flies off when the player comes close. Birds are only for looks. See `.scratch/valley-life/spec.md`.

**Blocked by:** none

**Status:** ready-for-agent

**Assets:** Add the draft `birds`, built in code: a small brown songbird with a wing-flap motion for flying and a peck motion for the ground. Reuses nothing. Decided with the owner on 2026-11-22.

## Where and when birds show

- [ ] Birds show only by day. They fade out at dusk and back in at dawn, following daylight.
- [ ] Up to 3 flocks of 3 to 5 birds fly over the treetops.
- [ ] Up to 6 birds peck on the ground in clearings near the player.
- [ ] There is one kind of bird: a small, generic brown songbird.
- [ ] Birds never land on foundations, in the river, or within 8 m of a lit fire.
- [ ] No birds fly or land while it rains. They come back gradually after the rain stops.

## Flying off

- [ ] When the player comes within 6 m of a bird on the ground, it flies off.
- [ ] A bird that flies off lands in another clearing or flies away over the trees.
- [ ] Birds never block the player's walking or the action menu.

## Only for looks

- [ ] Birds are drawn by the renderer only. The game logic never sees them.
- [ ] Birds are not saved. The save version does not change.
- [ ] Birds start in new random places each time the game loads.
- [ ] The playground has birds.

## Assets and checks

- [ ] The `birds` entry in `asset-manifest.json` is `draft` and links this ticket.
- [ ] The asset showcase shows a bird flying and pecking, so the owner can review it.
- [ ] The game still runs at 60 fps on an Apple M1 laptop in Chrome with birds in view.
- [ ] Unit tests cover the bird counts, birds showing only by day, flying off at 6 m, staying away in rain, and the 8 m gap from lit fires.
