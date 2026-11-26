// The showcase of the draft "drying-rack" asset: a blueprint being built, then four finished racks side by side,
// empty, holding fresh berries and mushrooms, full with dried and fresh food mixed, and holding raw and smoked fish beside a lit campfire.
import { DRYING_RACK_MODEL_STAGES } from "../../drying-rack-meshes";
import { BUILD_FADE_SHARE } from "../../structure-look";
import type { Showcase } from "../types";

export const DRYING_RACK_SHOWCASE: Showcase = {
  radius: 3.2,
  focus: { x: 0, y: 0.6, z: 0 },
  shots: [
    { label: "blueprint", yaw: 20, pitch: 25, seconds: 0 },
    { label: "lashings above their place", yaw: 20, pitch: 25, seconds: (1 + BUILD_FADE_SHARE) / DRYING_RACK_MODEL_STAGES },
    { label: "built: empty, fresh food, dried and fresh, fish", yaw: 0, pitch: 15, seconds: 1, focus: { x: 0.7 } },
    { label: "close up of the fish, raw and smoked", yaw: 10, pitch: 12, seconds: 1, radius: 1.1, focus: { x: 2.6, y: 0.75, z: 0 } },
  ],
  build({ place, movePlayer }) {
    place(-2.4, 0, { blueprint: { structure: "dryingRack", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
    place(-1.2, 0, { furniture: "dryingRack", dryingRack: [], facing: { turns: 0 } });
    place(0, 0, {
      furniture: "dryingRack",
      dryingRack: [
        { food: "berries", minutesPreserved: 60, spoilsAt: 3000 },
        { food: "mushroom", minutesPreserved: 30, spoilsAt: 4000 },
        { food: "berries", minutesPreserved: 0, spoilsAt: 3000 },
      ],
      facing: { turns: 0 },
    });
    place(1.3, 0, {
      furniture: "dryingRack",
      dryingRack: [
        { food: "berries", minutesPreserved: 360 },
        { food: "mushroom", minutesPreserved: 360 },
        { food: "berries", minutesPreserved: 360 },
        { food: "mushroom", minutesPreserved: 200, spoilsAt: 4000 },
        { food: "berries", minutesPreserved: 100, spoilsAt: 3000 },
        { food: "mushroom", minutesPreserved: 360 },
      ],
      facing: { turns: 0 },
    });
    place(2.6, 0, {
      furniture: "dryingRack",
      dryingRack: [
        { food: "rawFish", minutesPreserved: 240 },
        { food: "rawFish", minutesPreserved: 100, spoilsAt: 2000 },
        { food: "rawFish", minutesPreserved: 240 },
        { food: "berries", minutesPreserved: 360 },
      ],
      facing: { turns: 0 },
    });
    place(3.9, 0, { campfire: { lit: true, fuelMinutes: 200 } });
    movePlayer(-3.4, 0.6, Math.PI / 2);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
};
