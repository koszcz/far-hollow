// The showcase of the "split-animation".
import { SPLIT_STRIKES_PER_SECOND } from "../../player-mesh";
import type { Showcase } from "../types";

export const SPLIT_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 1, z: 0 },
  shots: [
    { label: "lifting", phase: 0.15 },
    { label: "axe overhead", phase: 0.35 },
    { label: "dropping", phase: 0.45 },
    { label: "strike", phase: 0.52 },
  ].map(({ label, phase }) => ({ label, yaw: 90, pitch: 10, seconds: phase / SPLIT_STRIKES_PER_SECOND })),
  build() {},
  pose({ player }, shot) {
    player.setSplitting(shot.seconds);
  },
};
