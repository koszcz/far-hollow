# 03: Drag a sled

**What to build:** The player can drag a sled, with its load, anywhere they can walk. Dragging is slower than walking and keeps the player's hands busy.

**Blocked by:** 02 (Load and unload a parked sled)

**Status:** ready-for-agent

**Assets:** Reuse `sled` and `player`. Add draft `sled-icon` for the hotbar.

- [ ] With nothing on the shoulder, E on a sled starts dragging it. While dragging, E lets go.
- [ ] With a log on the shoulder, dragging is in the sled's action list instead.
- [ ] The sled follows behind the player. It goes anywhere the player can walk.
- [ ] The player drags one sled at a time.
- [ ] While dragging, the player walks at 70% of normal speed. This stacks with the slowdown from neglected needs.
- [ ] While dragging, the player cannot shoulder a log, gather, chop, build, or craft.
- [ ] If the player collapses while dragging, they let go. The sled stays where they fell, with its load.
- [ ] The hotbar shows a sled cell while dragging, such as "Sled 4/6", where the shoulder cell goes.
- [ ] Whether the player is dragging a sled is saved.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover starting and stopping, the speed, blocked actions, collapse, and saving.
