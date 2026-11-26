// The showcase of the draft "drying-rack" asset: a blueprint being built, then three finished racks side by side,
// empty, holding fresh berries and mushrooms, and full with dried and fresh food mixed.
import { DRYING_RACK_MODEL_STAGES } from "../../drying-rack-meshes";
import { BUILD_FADE_SHARE } from "../../structure-look";
import type { Showcase } from "../types";

export const DRYING_RACK_SHOWCASE: Showcase = {
  radius: 3.2,
  focus: { x: 0, y: 0.6, z: 0 },
  shots: [
    { label: "blueprint", yaw: 20, pitch: 25, seconds: 0 },
    { label: "lashings above their place", yaw: 20, pitch: 25, seconds: (1 + BUILD_FADE_SHARE) / DRYING_RACK_MODEL_STAGES },
    { label: "built: empty, fresh food, dried and fresh", yaw: 0, pitch: 15, seconds: 1 },
    { label: "close up of the food", yaw: 25, pitch: 20, seconds: 1, radius: 1.3, focus: { x: 1.3, y: 0.85, z: 0 } },
  ],
  build({ place, movePlayer }) {
    place(-2.4, 0, { blueprint: { structure: "dryingRack", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
    place(-1.2, 0, { furniture: "dryingRack", dryingRack: [], facing: { turns: 0 } });
    place(0, 0, {
      furniture: "dryingRack",
      dryingRack: [
        { food: "berries", minutesDried: 60, spoilsAt: 3000 },
        { food: "mushroom", minutesDried: 30, spoilsAt: 4000 },
        { food: "berries", minutesDried: 0, spoilsAt: 3000 },
      ],
      facing: { turns: 0 },
    });
    place(1.3, 0, {
      furniture: "dryingRack",
      dryingRack: [
        { food: "berries", minutesDried: 360 },
        { food: "mushroom", minutesDried: 360 },
        { food: "berries", minutesDried: 360 },
        { food: "mushroom", minutesDried: 200, spoilsAt: 4000 },
        { food: "berries", minutesDried: 100, spoilsAt: 3000 },
        { food: "mushroom", minutesDried: 360 },
      ],
      facing: { turns: 0 },
    });
    movePlayer(2.4, 0.6, -Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
