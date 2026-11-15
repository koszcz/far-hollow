// The showcase of the approved "stool" asset. The "sit-animation" showcase plays sitting on it.
import { BUILD_FADE_SHARE } from "../../structure-look";
import { STOOL_MODEL_STAGES } from "../../stool-meshes";
import type { Showcase } from "../types";

// A blueprint holding 1 of its 2 planks, the seat being set down, then the finished stool.
export const STOOL_SHOWCASE: Showcase = {
  radius: 0.7,
  focus: { x: 0, y: 0.15, z: 0 },
  shots: [
    { label: "blueprint, 1 of 2 planks", yaw: 30, pitch: 30, seconds: 0 },
    { label: "seat above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / STOOL_MODEL_STAGES },
    { label: "built, front", yaw: 0, pitch: 15, seconds: 1 },
    { label: "built, from above", yaw: 120, pitch: 55, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(0, 0, { blueprint: { structure: "stool", progress: 0, materialsSpent: 0, delivered: { plank: 1 } }, facing: { turns: 0 } });
    movePlayer(0.9, 0.2, -Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
