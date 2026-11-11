# 03: Camp clears undergrowth

**What to build:** Undergrowth hides under anything the player places, so ferns and grass never poke through a fire ring, a bedroll, or a floor. See `.scratch/forest-floor/spec.md`.

**Blocked by:** 02 (Undergrowth)

**Status:** resolved

**Assets:** Reuses `grass`, `ferns`, `flowers`, and `pebbles`. Adds none.

- [x] Undergrowth hides within the footprint of a campfire, a bedroll, a building piece, or a blueprint.
- [x] Undergrowth hides as soon as a blueprint is placed, not only when construction finishes.
- [x] If the player removes a placed object, the undergrowth under it shows again.
- [x] Hidden undergrowth stays hidden after saving and loading. It follows from the saved camp, so nothing extra is saved.
- [x] Unit tests cover hiding under each kind of placed object.
