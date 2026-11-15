// The showcase of the approved "shelf" asset.
import { BUILD_FADE_SHARE } from "../../structure-look";
import { SHELF_MODEL_STAGES } from "../../shelf-meshes";
import type { Showcase } from "../types";

export const SHELF_SHOWCASE: Showcase = {
  radius: 1.8,
  focus: { x: 0, y: 0.6, z: 0 },
  // A blueprint holding 2 of its 4 planks, the back being set down, then the finished shelf from the front and from behind, where the brace shows.
  shots: [
    { label: "blueprint, 2 of 4 planks", yaw: 30, pitch: 25, seconds: 0 },
    { label: "back above its place", yaw: 30, pitch: 25, seconds: (2 + BUILD_FADE_SHARE) / SHELF_MODEL_STAGES },
    { label: "built, front", yaw: 20, pitch: 12, seconds: 1 },
    { label: "built, from behind", yaw: 150, pitch: 25, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(0, 0, { blueprint: { structure: "shelf", progress: 0, materialsSpent: 0, delivered: { plank: 2 } }, facing: { turns: 0 } });
    movePlayer(1.1, 0.3, -Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
