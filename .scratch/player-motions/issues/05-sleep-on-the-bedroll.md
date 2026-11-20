# 05: Sleep on the bedroll

**What to build:** Sleeping shows the player lying down on the bedroll, the screen going dark while time passes, and the player getting up. Today the clock jumps with no motion at all. See `.scratch/player-motions/spec.md`.

**Blocked by:** 03 (it reuses the bend down)

**Status:** wontfix

**Assets:** Reuse `player`, `bedroll`, and `pick-up-animation`. Add draft `sleep-animation`.

- [ ] When the player sleeps, they kneel and lie down on the bedroll, on their back, head at the blanket end. It takes about 1.5 seconds.
- [ ] The screen then fades to dark for about one second. Game logic skips the time as it does now, while the screen is dark.
- [ ] The screen fades back in, with the player still lying down. The player then sits up and stands, beside the bedroll, in about 1.5 seconds.
- [ ] If a collapse cuts sleep short, the same wake-up plays.
- [ ] The player cannot act while lying down or getting up. Clicks and keys during the motion do nothing.
- [ ] The asset showcase shows lying down and getting up.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).

## Comments

The owner chose to skip this ticket on 2026-11-20. The approved `sleep-animation` from `.scratch/player-animations/` already covers it, and the owner did not want to change that approved asset.
