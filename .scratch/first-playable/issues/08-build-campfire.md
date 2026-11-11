# 08: Build a campfire

**What to build:** The player places a campfire blueprint on the ground, then holds the build action to build it. Construction spends sticks as it goes. The player can stop partway and come back later.

**Blocked by:** 07 (Gather fuel)

**Status:** resolved

- [x] The player can choose to place a campfire blueprint. The blueprint is see-through and shows its progress.
- [x] A campfire costs sticks.
- [x] Holding the build action builds the campfire in stages, with an animation.
- [x] Sticks leave the backpack as construction goes on, not all at once.
- [x] Construction pauses when the player runs out of sticks or stops holding the action.
- [x] The player can walk away and resume later. Progress stays.
- [x] A finished campfire is unlit and blocks walking.
- [x] Unit tests cover placing, partial construction, resuming, and the stick cost.
