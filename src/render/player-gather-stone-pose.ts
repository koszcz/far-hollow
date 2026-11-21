// Builds the draft "gather-stone-animation" asset in asset-manifest.json: the player crouches at the water's edge, feels
// about low in front with both hands, then lifts a stone up to the chest. One lift takes as long as gathering one stone,
// so the stone comes up just as it goes in the backpack. It is posed in code on top of the idle clip with the build
// pose's bones, so it has no clip of its own. Added by fireplace ticket 01.
import { GATHER_STONE_SECONDS } from "../sim/stone";
import { blendBuildPoses, scaleBuildPose, type BuildPose } from "./player-build-pose";
import { easeInOut, smoothstep } from "./easing";

/** Seconds one lift takes: crouch, feel for a stone, and lift it. The same as gathering one stone. */
export const GATHER_STONE_LIFT_SECONDS = GATHER_STONE_SECONDS;

/**
 * Where each phase of one lift ends, as shares of the lift. The player crouches and reaches down until
 * `GATHER_STONE_DOWN_SHARE`, feels about for a stone until `GATHER_STONE_GRIP_SHARE`, lifts it to the chest by
 * `GATHER_STONE_LIFTED_SHARE`, and holds it there for the rest of the lift.
 */
export const GATHER_STONE_DOWN_SHARE = 0.25;
export const GATHER_STONE_GRIP_SHARE = 0.6;
export const GATHER_STONE_LIFTED_SHARE = 0.85;

/** Seconds the player takes to stand back up when gathering stops. */
export const GATHER_STONE_LEAVE_SECONDS = 0.35;

/** Deep in a crouch, both hands low in front, at the water's edge. */
const DOWN_POSE: BuildPose = {
  hipsDrop: 0.2,
  hipsBack: 0.1,
  hipsLean: 0.45,
  chestLean: 0.75,
  headTilt: -0.4,
  reach: 1,
  hands: { forward: 0.5, height: 0.12, spread: 0.1 },
};

/** Still crouched, both hands a little further out and lower, closing on a stone. */
const FEELING_POSE: BuildPose = {
  ...DOWN_POSE,
  chestLean: 0.82,
  hands: { forward: 0.56, height: 0.08, spread: 0.08 },
};

/** Half risen, with the stone held in both hands in front of the chest. */
const LIFTED_POSE: BuildPose = {
  hipsDrop: 0.08,
  hipsBack: 0.04,
  hipsLean: 0.15,
  chestLean: 0.2,
  headTilt: -0.2,
  reach: 1,
  hands: { forward: 0.4, height: 0.7, spread: 0.1 },
};

/** The pose `share` of the way through one lift, from 0 to 1, starting from standing. */
function liftPoseAt(share: number): BuildPose {
  if (share < GATHER_STONE_DOWN_SHARE) return scaleBuildPose(DOWN_POSE, easeInOut(share / GATHER_STONE_DOWN_SHARE));
  if (share < GATHER_STONE_GRIP_SHARE) {
    // Feel about for a stone: the hands move out and back once, then close on it.
    const t = (share - GATHER_STONE_DOWN_SHARE) / (GATHER_STONE_GRIP_SHARE - GATHER_STONE_DOWN_SHARE);
    return blendBuildPoses(DOWN_POSE, FEELING_POSE, Math.sin(t * Math.PI));
  }
  if (share < GATHER_STONE_LIFTED_SHARE) {
    const t = (share - GATHER_STONE_GRIP_SHARE) / (GATHER_STONE_LIFTED_SHARE - GATHER_STONE_GRIP_SHARE);
    return blendBuildPoses(DOWN_POSE, LIFTED_POSE, smoothstep(t));
  }
  return LIFTED_POSE;
}

/**
 * The gather-stone pose `seconds` after gathering began. The first lift crouches from standing. A later lift crouches
 * from the end of the one before, so the loop has no jump.
 */
export function gatherStonePoseAt(seconds: number): BuildPose {
  const share = gatherStoneShareAt(seconds);
  if (seconds >= GATHER_STONE_LIFT_SECONDS && share < GATHER_STONE_DOWN_SHARE) {
    return blendBuildPoses(LIFTED_POSE, DOWN_POSE, easeInOut(share / GATHER_STONE_DOWN_SHARE));
  }
  return liftPoseAt(share);
}

/** How far through the current lift the player is, from 0 to 1, `seconds` after gathering began. */
export function gatherStoneShareAt(seconds: number): number {
  return (((seconds / GATHER_STONE_LIFT_SECONDS) % 1) + 1) % 1;
}

/** True while the stone is in the player's hands: from when they grip it until the lift ends. */
export function holdsStoneAt(seconds: number): boolean {
  return gatherStoneShareAt(seconds) >= GATHER_STONE_GRIP_SHARE;
}
