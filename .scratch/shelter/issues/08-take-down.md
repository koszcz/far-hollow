# 08: Take down pieces

**What to build:** The player can take down any blueprint, building piece, or lean-to and get back everything in it. A piece cannot come down while another piece stands on it.

**Blocked by:** 06 (Roof)

**Status:** ready-for-agent

**Assets:** Reuse `player`, `debarked-log`, `bark`, and `sticks`.

- [ ] The radial menu on a blueprint, building piece, or lean-to offers "Take down".
- [ ] Taking down a finished piece is timed work, shorter than building it.
- [ ] Taking down a blueprint is instant.
- [ ] The player gets back every material spent or delivered. Debarked logs land on the ground. Bark and sticks go to the backpack, or onto the ground if it is full.
- [ ] A foundation cannot come down while a wall, door frame, or campfire stands on it. A wall or door frame cannot come down while a roof needs it.
- [ ] Removed stumps stay removed.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover refunds and the support rules.
