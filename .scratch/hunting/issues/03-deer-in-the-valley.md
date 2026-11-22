# 03: Deer live in the valley and run from the player

**What to build:** Up to 6 deer graze in the valley's clearings and wander between them. A deer that notices the player runs away. The player cannot hunt them yet. That comes in ticket 04.

**Status:** deferred

**Assets:** Add the drafts `deer` and `deer-animations` (graze, walk, and run).

- [ ] A new valley starts with 6 deer in its clearings. The same seed puts them in the same places.
- [ ] A deer grazes for a while, then walks slowly to another spot in a clearing. It uses the walk map, so it goes around trees and structures.
- [ ] Deer keep at least 15 m from structures and lit fires.
- [ ] Deer do not cross the river and do not step onto foundations.
- [ ] A deer notices the player within 12 m, or within 20 m if the player is carrying a lit torch or dragging a sled. The torch rule applies only once `.scratch/torch/` has landed.
- [ ] A deer that notices the player runs to a spot at least 40 m from the player. It runs faster than the player.
- [ ] Deer do not block the player's walking.
- [ ] Deer play their graze, walk, and run animations.
- [ ] With 6 deer in view, the game meets the frame-rate targets in `.scratch/first-playable/spec.md`.
- [ ] Deer and where each one is are saved. The save version goes up. An older save gets 6 deer when loaded.
- [ ] The playground has deer.
- [ ] The debug overlay can show each deer's state and the range at which it notices the player.
- [ ] `GLOSSARY.md` defines deer as the spec does.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover where deer start, wandering, noticing the player, running, and the places deer never go.
