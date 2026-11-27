// The showcase of the "carry-in-hands-animation": the player carries a plank or a stone in both hands, as they do when
// they fetch one for a blueprint.
import { WALK_SPEED_METRES_PER_SECOND } from "../../../sim/walking";
import { STRIDE_METRES } from "../../player-timing";
import type { Showcase } from "../types";

export const CARRY_IN_HANDS_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.4,
  focus: { x: 0, y: 0.9, z: 0 },
  shots: [
    { label: "standing with a plank", yaw: 30, pitch: 10 },
    { label: "walking with a plank, right foot lands", yaw: 70, pitch: 10, seconds: (0.5 * STRIDE_METRES) / WALK_SPEED_METRES_PER_SECOND },
    { label: "standing with a stone", yaw: 30, pitch: 10 },
    { label: "walking with a stone, left foot lands", yaw: 70, pitch: 10, seconds: STRIDE_METRES / WALK_SPEED_METRES_PER_SECOND },
  ],
  build() {},
  pose({ player }, shot) {
    player.setMotion("carry-in-hands-animation", shot.label.includes("stone") ? "stone" : "plank");
    player.setWalking(shot.seconds === undefined ? undefined : shot.seconds * WALK_SPEED_METRES_PER_SECOND);
  },
  // The player walks forward at game speed with a plank in both hands. The camera keeps pace.
  play: {
    shot: { label: "walking with a plank", yaw: 60, pitch: 10, radius: 1.8 },
    pose({ player, movePlayer }, seconds) {
      const walked = (seconds * WALK_SPEED_METRES_PER_SECOND) % 60;
      movePlayer(0, walked, 0);
      player.setMotion("carry-in-hands-animation", "plank");
      player.setWalking(walked);
      return { z: walked };
    },
  },
};
