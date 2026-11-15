// The showcase of the approved "chest" asset.
import { BUILD_FADE_SHARE } from "../../structure-look";
import { CHEST_MODEL_STAGES } from "../../chest-meshes";
import type { Showcase } from "../types";

export const CHEST_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 0.25, z: 0 },
  // A blueprint holding 2 of its 4 planks, the lid being set down, then the finished chest from the front and above.
  shots: [
    { label: "blueprint, 2 of 4 planks", yaw: 30, pitch: 30, seconds: 0 },
    { label: "lid above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / CHEST_MODEL_STAGES },
    { label: "built, front", yaw: 0, pitch: 12, seconds: 1 },
    { label: "built, from above", yaw: 140, pitch: 55, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(0, 0, { blueprint: { structure: "chest", progress: 0, materialsSpent: 0, delivered: { plank: 2 } }, facing: { turns: 0 } });
    movePlayer(1, 0.2, -Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
