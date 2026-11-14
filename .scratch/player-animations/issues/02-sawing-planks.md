# 02: Sawing animation for cutting planks

**What to build:** The player saws when they cut planks at the sawhorse. Today crafting reuses the chopping swing, so the player swings an axe at the air. A person sawing a log lays it on the sawhorse and stands beside it. They hold the log still with the left hand, grip the bow saw with the right, and push and pull it in long, even strokes. The blade sinks deeper into the log as the cut goes on.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Assets:** Reuse `player`, `sawhorse`, `debarked-log`, and `hud`. Add the drafts `sawing-animation` and `saw-model`.

## Acceptance criteria

- [x] While the player cuts planks, the debarked log they cut is drawn lying along the top of the sawhorse beam. The game's record of where the log lies does not change.
- [x] If the player stops partway, the log is drawn back in its spot on the ground.
- [x] The player stands beside the sawhorse and faces it, with the feet planted.
- [x] The player holds the saw in the right hand and rests the left hand on the log.
- [x] Each stroke pushes the saw forward and pulls it back, about one full stroke a second.
- [x] The saw sits lower in the log as the cut goes on, from the top of the log at the start to the bottom at the end.
- [x] The axe goes on the back while sawing, as it does while building and debarking.
- [x] The saw in the hand is the new draft `saw-model`, built in code: a bow saw with a thin steel blade strung across the ends of a bent stick. It matches the saw in the approved `crafting-icons`.
- [x] The saw shows in the hand only while sawing.
- [x] Making the saw, which is a hand recipe, keeps the chopping swing. Only the planks recipe saws.
- [x] The motion is posed in code over the idle clip, as `player-debark-pose.ts` does. It reads apart from the chop's side swing and the debark's pull along the log.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover where the log is drawn while sawing and after stopping partway.
- [x] Check the motion in the browser as `docs/agents/game-testing.md` describes.

## Comments

- 2026-11-14: Done. The drawn player steps up beside the beam to saw, 0.7 m from it, upright so the head stays clear of the log, and steps back when sawing stops. Game logic's record of where the player stands does not change. A log taken from a sled stays on the sled, so the player saws over the bare beam then.
