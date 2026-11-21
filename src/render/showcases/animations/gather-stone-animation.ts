// The showcase of the draft "gather-stone-animation": the player crouches, feels about low in front, and lifts a stone to the chest.
// A pile of stones lies in front of the player, where the water's edge would be.
import { GATHER_STONE_SECONDS } from "../../../sim/stone";
import { GATHER_STONE_DOWN_SHARE, GATHER_STONE_GRIP_SHARE, GATHER_STONE_LIFT_SECONDS, GATHER_STONE_LIFTED_SHARE } from "../../player-gather-stone-pose";
import type { Showcase } from "../types";

/** How long the player stands after gathering a stone before the "gather-stone-animation" plays again, in seconds. */
const GATHER_STONE_PLAY_REST_SECONDS = 1.2;

export const GATHER_STONE_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.6,
  focus: { x: 0, y: 0.6, z: 0.3 },
  shots: [
    { label: "crouching down", share: GATHER_STONE_DOWN_SHARE / 2 },
    { label: "feeling for a stone", share: (GATHER_STONE_DOWN_SHARE + GATHER_STONE_GRIP_SHARE) / 2 },
    { label: "lifting the stone", share: (GATHER_STONE_GRIP_SHARE + GATHER_STONE_LIFTED_SHARE) / 2 },
    { label: "stone held at the chest", share: (GATHER_STONE_LIFTED_SHARE + 1) / 2 },
  ].map(({ label, share }) => ({ label, yaw: 60, pitch: 20, seconds: share * GATHER_STONE_LIFT_SECONDS })),
  build({ place, movePlayer }) {
    place(0, 0.6, { pile: { content: "stone", count: 5 } });
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    // Start gathering afresh at time 0 for each view, so the view shows the lift `shot.seconds` in.
    player.setMotion("gather-stone-animation", undefined);
    player.setMotion("gather-stone-animation", 0);
    player.setMotion("gather-stone-animation", shot.seconds);
  },
  // The player gathers one stone, as long as the game takes, stands up, rests, then starts again.
  play: {
    shot: { label: "gathering one stone, then standing up", yaw: 40, pitch: 20, radius: 1.8 },
    pose({ player }, seconds) {
      const cycle = seconds % (GATHER_STONE_SECONDS + GATHER_STONE_PLAY_REST_SECONDS);
      player.setMotion("gather-stone-animation", cycle < GATHER_STONE_SECONDS ? cycle : undefined);
      return undefined;
    },
  },
};
