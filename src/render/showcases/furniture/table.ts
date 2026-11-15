// The showcase of the approved "table" asset.
import { BUILD_FADE_SHARE } from "../../structure-look";
import { TABLE_MODEL_STAGES } from "../../table-meshes";
import type { Showcase } from "../types";

/** How long the table takes to build in its showcase, and how long it stands finished before building again, in seconds. */
const TABLE_PLAY_BUILD_SECONDS = 4;
const TABLE_PLAY_REST_SECONDS = 1.5;

// A blueprint holding 4 of its 6 planks, the rails and the top being set down, then the finished table.
export const TABLE_SHOWCASE: Showcase = {
  radius: 1.8,
  focus: { x: 0, y: 0.4, z: 0 },
  shots: [
    { label: "blueprint, 4 of 6 planks", yaw: 30, pitch: 30, seconds: 0 },
    { label: "rails above their place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / TABLE_MODEL_STAGES },
    { label: "top above its place", yaw: 30, pitch: 30, seconds: (2 + BUILD_FADE_SHARE) / TABLE_MODEL_STAGES },
    { label: "built, from above", yaw: 140, pitch: 50, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(0, 0, { blueprint: { structure: "table", progress: 0, materialsSpent: 0, delivered: { plank: 4 } }, facing: { turns: 0 } });
    movePlayer(0.2, 0.9, Math.PI);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
  // The table goes up stage by stage, stands finished for a moment, then builds again.
  play: {
    shot: { label: "building, stage by stage", yaw: 30, pitch: 30 },
    pose({ store }, seconds) {
      const cycle = seconds % (TABLE_PLAY_BUILD_SECONDS + TABLE_PLAY_REST_SECONDS);
      for (const entity of store.with("blueprint")) entity.blueprint.progress = Math.min(1, cycle / TABLE_PLAY_BUILD_SECONDS);
      return undefined;
    },
  },
};
