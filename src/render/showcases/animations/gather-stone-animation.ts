// The showcase of the approved "gather-stone-animation": the player squats, rocks a stone free, lifts it to the belly, and heaves it into the backpack.
// A pile of stones lies in front of the player, where the water's edge would be.
import { GATHER_STONE_SECONDS } from "../../../sim/stone";
import {
  GATHER_STONE_SHOULDER_SHARE,
  GATHER_STONE_FREED_SHARE,
  GATHER_STONE_LIFT_SECONDS,
  GATHER_STONE_RISEN_SHARE,
  GATHER_STONE_SQUATTED_SHARE,
  GATHER_STONE_STOWED_SHARE,
} from "../../player-gather-stone-pose";
import type { Showcase } from "../types";

/** How long the player stands after gathering a stone before the "gather-stone-animation" plays again, in seconds. */
const GATHER_STONE_PLAY_REST_SECONDS = 1.2;

export const GATHER_STONE_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.6,
  focus: { x: 0, y: 0.6, z: 0.3 },
  shots: [
    { label: "squatting, gripping the stone", share: GATHER_STONE_SQUATTED_SHARE + 0.08 },
    { label: "driving up with the legs", share: (GATHER_STONE_FREED_SHARE + GATHER_STONE_RISEN_SHARE) / 2 },
    { label: "heaved up beside the shoulder", share: GATHER_STONE_SHOULDER_SHARE },
    { label: "heaving it into the backpack", share: GATHER_STONE_STOWED_SHARE - 0.01, yaw: 210 },
  ].map(({ label, share, yaw = 60 }) => ({ label, yaw, pitch: 20, seconds: share * GATHER_STONE_LIFT_SECONDS })),
  build({ place, movePlayer }) {
    place(0, 0.6, { pile: { content: "stone", count: 5 } });
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    // Start gathering afresh at time 0 for each view, so the view shows the lift `shot.seconds` in.
    player.setMotion("gather-stone-animation", undefined);
    player.setMotion("gather-stone-animation", { seconds: 0, lifts: "stone", liftSeconds: GATHER_STONE_SECONDS });
    player.setMotion("gather-stone-animation", { seconds: shot.seconds ?? 0, lifts: "stone", liftSeconds: GATHER_STONE_SECONDS });
  },
  // The player gathers one stone, as long as the game takes, stands up, rests, then starts again.
  play: {
    shot: { label: "gathering one stone, then standing up", yaw: 40, pitch: 20, radius: 1.8 },
    pose({ player }, seconds) {
      const cycle = seconds % (GATHER_STONE_SECONDS + GATHER_STONE_PLAY_REST_SECONDS);
      player.setMotion(
        "gather-stone-animation",
        cycle < GATHER_STONE_SECONDS ? { seconds: cycle, lifts: "stone", liftSeconds: GATHER_STONE_SECONDS } : undefined,
      );
      return undefined;
    },
  },
};
