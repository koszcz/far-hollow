# 05: Take down chests and woodpiles

**What to build:** The player can take down an empty chest or woodpile and get back everything it cost. A chest or woodpile that still holds anything stays up.

**Blocked by:** 02 (Woodpile), 04 (Open a chest and move things), and Shelter 08 (Take down pieces)

**Status:** resolved

**Assets:** Reuse `chest`, `woodpile`, `player`, and `debarked-log`.

- [ ] The radial menu on a chest, chest blueprint, or woodpile offers "Take down".
- [ ] Taking down a chest returns its 2 debarked logs, which land on the ground.
- [ ] Taking down a chest or woodpile that still holds anything is refused. The player is told to empty it first.
- [ ] Taking down a blueprint is instant, as for other structures.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover refunds and the empty rule.
