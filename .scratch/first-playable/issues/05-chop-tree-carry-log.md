# 05: Chop a tree and carry a log

**What to build:** Left-clicking a tree makes the player walk to it and chop it with the axe. The tree falls and leaves a stump. The player carries one log on their shoulder.

**Blocked by:** 04 (Click to walk with pathfinding)

**Status:** resolved

- [x] The player starts with an axe, a knife, and a fire striker in their backpack.
- [x] Left-clicking a tree walks the player to it, then chops it.
- [x] Chopping takes time. The player can see it happening.
- [x] A felled tree becomes a stump and gives logs.
- [x] The player carries one log on their shoulder at a time.
- [x] The player can drop the log they carry.
- [x] A stump blocks walking the same way a tree does.
- [x] Unit tests cover chopping, the stump, and the one-log carry limit.
- [x] Stump regrowth, shift-click queues, and the radial menu are out of scope.
