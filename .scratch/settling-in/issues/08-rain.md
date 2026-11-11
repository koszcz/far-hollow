# 08: Rain

**What to build:** Rain sometimes falls in the valley. Being out in the rain drains the player's warmth, even during the day. A lit campfire nearby still warms the player.

**Blocked by:** 02 (Autosave and continue)

**Status:** ready-for-agent

- [ ] Rain starts and stops over the day. The seed decides when it falls.
- [ ] The player can see and hear that it is raining. Sound needs owner-approved assets.
- [ ] Rain drains warmth whenever the player has no roof overhead. No roofs exist yet, so rain affects the player everywhere.
- [ ] Standing within a lit campfire's warmth range still warms the player in the rain.
- [ ] Rain does not put out campfires.
- [ ] Whether it is raining, and for how long, is saved.
- [ ] The debug overlay can skip time through rain.
- [ ] Before any rain texture, effect asset, or sound enters the game, the owner approves it (ADR 0004).
- [ ] Unit tests cover when rain falls, warmth drain in rain, and campfire warmth in rain.
