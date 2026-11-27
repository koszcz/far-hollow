// The showcase of the "sled-rope". It reuses the "sled-drag-animation" showcase with closer framing.
import { STRIDE_METRES } from "../../player-timing";
import type { Showcase } from "../types";
import { DRAG_WALK_METRES_PER_SECOND } from "./shared";
import { SLED_DRAG_SHOWCASE } from "./sled-drag-animation";

// The rope close up from the rope hand's side: taut while walking, slack while standing, then the knot and the hand.
export const SLED_ROPE_SHOWCASE: Showcase = {
  ...SLED_DRAG_SHOWCASE,
  radius: 1.1,
  focus: { x: -0.4, y: 0.4, z: 0 },
  shots: [
    { label: "walking, rope taut", yaw: 180, pitch: 10, share: 0.5 },
    { label: "standing, rope slack", yaw: 180, pitch: 10 },
    { label: "the knot, walking", yaw: 150, pitch: 35, share: 0.5, radius: 0.7, focus: { x: -0.5, y: 0.3 } },
    { label: "the hand, standing", yaw: 200, pitch: 15, radius: 0.65, focus: { x: -0.2, y: 0.45 } },
  ].map(({ share, ...shot }) => (share === undefined ? shot : { ...shot, seconds: (share * STRIDE_METRES) / DRAG_WALK_METRES_PER_SECOND })),
};
