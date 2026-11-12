# 02: Load and unload a parked sled

**What to build:** The player can put logs from their shoulder on a parked sled, take them back one at a time, and tip them all out.

**Blocked by:** 01 (Place and build a sled)

**Status:** ready-for-agent

**Assets:** Reuse `logs` and `debarked-log`. Extend draft `sled` to show 0 to 6 logs or debarked logs lying on it.

- [ ] With a log or debarked log on the shoulder, E on a sled with room puts it on the sled.
- [ ] A sled holds up to 6 logs and debarked logs, in any mix. Nothing else goes on it.
- [ ] With nothing on the shoulder, the action list offers taking one log onto the shoulder. When the sled holds both kinds, it offers each kind, as the woodpile does.
- [ ] The action list offers tipping out every log. Each log is laid on the ground beside the sled, on its own.
- [ ] The logs on the sled show on it.
- [ ] What each sled holds is saved.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover loading, the limit of 6, taking one of each kind, tipping out, and saving.
