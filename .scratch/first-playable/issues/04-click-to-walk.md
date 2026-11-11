# 04: Click to walk with pathfinding

**What to build:** The player appears at the edge of the valley. Left-clicking the ground makes the player walk there and find a path around trees. The camera follows the player.

**Blocked by:** 02 (Seeded valley with a river and trees)

**Status:** ready-for-agent

- [ ] The player starts at the edge of the valley.
- [ ] Left-clicking the ground sends a walk command to the game logic.
- [ ] The player finds a path around trees and the river's banks where they block the way.
- [ ] Clicking a spot that cannot be reached walks the player to the nearest reachable spot.
- [ ] The camera follows the player by default. Space snaps the camera back to the player.
- [ ] Unit tests cover pathfinding around blocking trees.
- [ ] One Playwright test checks that the game loads and the player can walk. It runs on demand only, not on every commit.
