# 03: Pick up and put down

**What to build:** The player bends down when they pick something up from the ground or put it down. See `.scratch/player-motions/spec.md`.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** Reuse `player`. Add draft `pick-up-animation`.

- [ ] Picking up a log, stick, bark, pile, or bedroll plays a short bend: knees and back bend, one hand reaches to the ground, and the player stands up. It takes about 0.6 seconds.
- [ ] Shouldering a log bends with both hands, then lifts the log to the shoulder as the player stands.
- [ ] Dropping a log, or dropping something from the backpack, plays the same bend in reverse: the thing leaves the hand at the bottom.
- [ ] The motion plays where the player stands, facing the thing.
- [ ] Walking or another action cuts the motion short.
- [ ] The motion takes no game time. Game rules do not change.
- [ ] The asset showcase shows picking up and putting down.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
