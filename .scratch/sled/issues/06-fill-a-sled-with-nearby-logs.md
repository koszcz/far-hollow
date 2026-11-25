# 06: Fill a sled with nearby logs

**What to build:** The sled's action list offers filling it. The player fetches every log and debarked log lying within 10 m of the sled, one at a time, and puts each on the sled.

**Blocked by:** 02 (Load and unload a parked sled)

**Status:** resolved

**Assets:** Reuse `sled`, `logs`, `debarked-log`, and `pick-up-animation`.

- [x] The action list of a parked sled offers "Fill with nearby logs".
- [x] The player fetches logs and debarked logs lying within 10 m of the sled's edge, measured along the walking path.
- [x] They fetch the nearest log first, by walking distance, and carry it on the shoulder to the sled.
- [x] A log already on the player's shoulder goes on the sled first.
- [x] Filling stops when the sled is full, no log is left within 10 m, or the player does something else.
- [x] A log on the shoulder when the player stops stays there.
- [x] The game refuses, and says why, when no log lies within 10 m, the sled is full, the player holds a plank or stone, or the player drags a sled.
- [x] Filling in progress is saved.
- [x] `GLOSSARY.md` describes filling.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover filling, nearest first, the 10 m limit, a full sled, a shouldered log, the refusals, and stopping on a click.

## Comments

- The owner asked for this in chat on 2026-11-25.
- Implemented 2026-11-25 in `src/sim/sled-filling.ts`. Filling in progress is saved as a new optional part of the player, so older saves load as they are and the save version stays the same.
