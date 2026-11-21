// Builds the "sled-drag-animation" asset in asset-manifest.json: while the player drags a sled, they lean forward and
// pull it by a short rope held in the left hand, low behind the left hip, the arm trailing straight back. Each step's
// push-off heaves the body a little further into the pull. The right arm and the legs keep whatever the clip does: the
// walk's swing and stride while moving, or steadying a log on the right shoulder. It is posed in code with the build
// pose's bones, so it has no clip of its own. The owner approved it. The rope is the draft "sled-rope", drawn by sled-rope.ts.
import { blendBuildPoses, type BuildPose } from "./player-build-pose";

/**
 * The lean while dragging a sled, standing or between heaves. Only the left arm reaches: its wrist goes to `hands`,
 * out of reach behind the left hip, so the arm hangs straight back along the taut rope.
 */
export const SLED_DRAG_POSE: BuildPose = {
  hipsDrop: 0.02,
  hipsBack: 0.02,
  hipsLean: 0.14,
  chestLean: 0.18,
  headTilt: -0.22,
  reach: 1,
  hands: { forward: -0.45, height: 0.45, spread: 0.24 },
};

/** The deepest point of each heave, at a foot's push-off: the body further over, the rope hand pulled a little further back. */
const SLED_HEAVE_POSE: BuildPose = {
  ...SLED_DRAG_POSE,
  hipsDrop: 0.035,
  chestLean: 0.27,
  headTilt: -0.3,
  hands: { ...SLED_DRAG_POSE.hands, forward: -0.5 },
};

/**
 * Where in each step the heave is deepest, as a share of the step after the foot lands: during the push-off, before
 * the other foot lands and the load checks the body back.
 */
export const SLED_HEAVE_PEAK_SHARE = 0.6;

/**
 * The drag pose. `steps` counts the walk clip's steps so far, two to each stride, or is undefined while standing still.
 * Each step eases into the heave and back out, so the pose at the end of a step matches the start of the next.
 */
export function sledDragPoseAt(steps: number | undefined): BuildPose {
  if (steps === undefined) return SLED_DRAG_POSE;
  const share = ((steps % 1) + 1) % 1;
  const heave = 0.5 - 0.5 * Math.cos(2 * Math.PI * (share - SLED_HEAVE_PEAK_SHARE + 0.5));
  return blendBuildPoses(SLED_DRAG_POSE, SLED_HEAVE_POSE, heave);
}
