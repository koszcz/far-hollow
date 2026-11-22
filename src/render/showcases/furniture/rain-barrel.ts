// The showcase of the approved "rain-barrel" asset: a blueprint being built, then three finished barrels side by side,
// empty, holding 3 of its 6 drinks, and full.
import { BUILD_FADE_SHARE } from "../../structure-look";
import { RAIN_BARREL_MODEL_STAGES } from "../../rain-barrel-meshes";
import type { Showcase } from "../types";

export const RAIN_BARREL_SHOWCASE: Showcase = {
  radius: 2.4,
  focus: { x: 0, y: 0.4, z: 0 },
  shots: [
    { label: "blueprint, 3 of 6 planks", yaw: 20, pitch: 25, seconds: 0 },
    { label: "hoops above their place", yaw: 20, pitch: 25, seconds: (1 + BUILD_FADE_SHARE) / RAIN_BARREL_MODEL_STAGES },
    { label: "built: empty, half full, full", yaw: 0, pitch: 15, seconds: 1 },
    { label: "from above, water levels", yaw: 30, pitch: 60, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(-1.5, 0, { blueprint: { structure: "rainBarrel", progress: 0, materialsSpent: 0, delivered: { plank: 3 } }, facing: { turns: 0 } });
    place(-0.5, 0, { furniture: "rainBarrel", rainBarrel: { held: 0, progress: 0 }, facing: { turns: 0 } });
    place(0.5, 0, { furniture: "rainBarrel", rainBarrel: { held: 3, progress: 0 }, facing: { turns: 0 } });
    place(1.5, 0, { furniture: "rainBarrel", rainBarrel: { held: 6, progress: 0 }, facing: { turns: 0 } });
    movePlayer(2.4, 0.4, -Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
