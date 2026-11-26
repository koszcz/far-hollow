// The showcase of the draft "wood-box" asset: a blueprint being built, then three finished boxes side by side,
// empty, holding 9 of its 20 firewood, and full.
import { BUILD_FADE_SHARE } from "../../structure-look";
import { WOOD_BOX_MODEL_STAGES } from "../../wood-box-meshes";
import type { Showcase } from "../types";

export const WOOD_BOX_SHOWCASE: Showcase = {
  radius: 2.8,
  focus: { x: 0, y: 0.3, z: 0 },
  shots: [
    { label: "blueprint, 2 of 4 planks", yaw: 20, pitch: 25, seconds: 0 },
    { label: "sides above their place", yaw: 20, pitch: 25, seconds: (1 + BUILD_FADE_SHARE) / WOOD_BOX_MODEL_STAGES },
    { label: "built: empty, 9 firewood, full", yaw: 0, pitch: 20, seconds: 1 },
    { label: "from above, firewood inside", yaw: 30, pitch: 60, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(-1.8, 0, { blueprint: { structure: "woodBox", progress: 0, materialsSpent: 0, delivered: { plank: 2 } }, facing: { turns: 0 } });
    place(-0.6, 0, { furniture: "woodBox", woodBox: { firewood: 0 }, facing: { turns: 0 } });
    place(0.6, 0, { furniture: "woodBox", woodBox: { firewood: 9 }, facing: { turns: 0 } });
    place(1.8, 0, { furniture: "woodBox", woodBox: { firewood: 20 }, facing: { turns: 0 } });
    movePlayer(2.8, 0.4, -Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
