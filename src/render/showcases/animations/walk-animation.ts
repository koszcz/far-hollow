// The showcase of the "walk-animation".
import { WALK_SPEED_METRES_PER_SECOND } from "../../../sim/walking";
import { STRIDE_METRES } from "../../player-timing";
import type { Showcase } from "../types";

export const WALK_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.2,
  focus: { x: 0, y: 0.9, z: 0 },
  // A quarter turn of the stride apart: each foot lands, then each leg passes the other.
  shots: [
    { label: "right leg passes", share: 0.25 },
    { label: "right foot lands", share: 0.5 },
    { label: "left leg passes", share: 0.75 },
    { label: "left foot lands", share: 1 },
  ].map(({ label, share }) => ({ label, yaw: 70, pitch: 8, seconds: (share * STRIDE_METRES) / WALK_SPEED_METRES_PER_SECOND })),
  build() {},
  pose({ player }, shot) {
    player.setWalking((shot.seconds ?? 0) * WALK_SPEED_METRES_PER_SECOND);
  },
  // The player walks forward at game speed over the textured ground, so foot slide shows. The camera keeps pace.
  play: {
    shot: { label: "walking", yaw: 70, pitch: 10, radius: 1.6 },
    pose({ player, movePlayer }, seconds) {
      const walked = (seconds * WALK_SPEED_METRES_PER_SECOND) % 60;
      movePlayer(0, walked, 0);
      player.setWalking(walked);
      return { z: walked };
    },
  },
};
