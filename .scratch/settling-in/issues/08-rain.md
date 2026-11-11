# 08: Rain

**What to build:** Rain sometimes falls in the valley. Being out in the rain drains the player's warmth, even during the day. A lit campfire nearby still warms the player.

**Blocked by:** 02 (Autosave and continue)

**Status:** resolved

**Assets:** Add the draft `rain`, a falling rain effect. A rain sound is optional. Leave it out if it would take more than a quick synthesized loop.

- [x] Rain starts and stops over the day. The seed decides when it falls.
- [x] The player can see and hear that it is raining. Sound needs owner-approved assets.
- [x] Rain drains warmth whenever the player has no roof overhead. No roofs exist yet, so rain affects the player everywhere.
- [x] Standing within a lit campfire's warmth range still warms the player in the rain.
- [x] Rain does not put out campfires.
- [x] Whether it is raining, and for how long, is saved.
- [x] The debug overlay can skip time through rain.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover when rain falls, warmth drain in rain, and campfire warmth in rain.
