// The showcase of the "campfire-build-animation".
import { CAMPFIRE_BUILD_SECONDS } from "../../../sim/structures";
import { BUILD_STONES_SHARE, buildProgressAtStickStage } from "../../campfire-meshes";
import { BUILD_FADE_SHARE, BUILD_HOLD_SHARE, BUILD_SET_DOWN_SHARE } from "../../structure-look";
import { BUILD_PLAY_REST_SECONDS, type Showcase } from "../types";

export const CAMPFIRE_BUILD_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 0.3, z: 0 },
  // Stones half placed, key moments while the third stick is laid, then the finished campfire.
  shots: [
    { label: "stones going down", progress: BUILD_STONES_SHARE / 2 },
    { label: "3rd stick above its place", progress: buildProgressAtStickStage(2 + BUILD_FADE_SHARE) },
    { label: "3rd stick set down", progress: buildProgressAtStickStage(2 + (BUILD_HOLD_SHARE + BUILD_SET_DOWN_SHARE) / 2) },
    { label: "built", progress: 1 },
  ].map(({ label, progress }) => ({ label, yaw: 30, pitch: 25, seconds: progress })),
  build({ place }) {
    place(0, 0, { blueprint: { structure: "campfire", progress: 0, materialsSpent: 0, delivered: {} } });
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
  // The whole build plays at game speed, rests built, then starts again from an empty blueprint.
  play: {
    shot: { label: "building, then a rest", yaw: 30, pitch: 25 },
    pose({ store }, seconds) {
      const cycle = seconds % (CAMPFIRE_BUILD_SECONDS + BUILD_PLAY_REST_SECONDS);
      for (const entity of store.with("blueprint")) entity.blueprint.progress = Math.min(1, cycle / CAMPFIRE_BUILD_SECONDS);
      return undefined;
    },
  },
};
