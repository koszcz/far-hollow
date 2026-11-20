// Builds the "sled-drag-animation" asset in asset-manifest.json: while the player drags a sled, they lean forward from
// the hips and pull it by a short rope over the left shoulder. The left hand grips the rope in front of the shoulder.
// The right arm and the legs keep whatever the clip does: the walk's swing and stride while moving, and the idle clip's
// rest while standing. It is posed in code with the build pose's bones, so it has no clip of its own. It is a draft.
// The rope is the draft "sled-rope", drawn by sled-rope.ts.
import type { BuildPose } from "./player-build-pose";

/**
 * The lean while dragging a sled. Only the left arm reaches: its hand goes to `hands`, gripping the rope just in front
 * of the left shoulder. The pose is the same moving or standing still, so it starts and ends at once with dragging.
 */
export const SLED_DRAG_POSE: BuildPose = {
  hipsDrop: 0.03,
  hipsBack: 0.06,
  hipsLean: 0.2,
  chestLean: 0.25,
  headTilt: -0.3,
  reach: 1,
  hands: { forward: 0.2, height: 0.8, spread: 0.14 },
};
