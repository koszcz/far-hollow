// Builds the approved "gather-stone-animation" asset in asset-manifest.json: the player lifts one stone the way people lift
// a heavy stone. They squat with the back fairly upright, grip the stone from either side, rock it free with two short
// tugs, drive up with the legs to hug it at the belly, then heave it over the right shoulder into the backpack and
// stand easy. One lift takes as long as gathering one stone, so the stone drops into the backpack as the game counts it.
// It is posed in code on top of the idle clip with the build pose's bones, so it has no clip of its own. Added by
// fireplace ticket 01. The owner approved the asset.
import { GATHER_STONE_SECONDS } from "../sim/stone";
import { blendBuildPoses, scaleBuildPose, type BuildPose } from "./player-build-pose";
import { easeInOut, lerp, smoothstep } from "./easing";

/** Seconds one lift takes, from standing to standing. The same as gathering one stone. */
export const GATHER_STONE_LIFT_SECONDS = GATHER_STONE_SECONDS;

/**
 * Where each phase of one lift ends, as shares of the lift. The player squats until `GATHER_STONE_SQUATTED_SHARE`,
 * grips the stone and rocks it free until `GATHER_STONE_FREED_SHARE`, drives up to hug it at the belly by
 * `GATHER_STONE_RISEN_SHARE`, dips at the knees by `GATHER_STONE_DIPPED_SHARE`, heaves it up beside the right
 * shoulder, outside the head, by `GATHER_STONE_SHOULDER_SHARE`, pushes it back over the shoulder into the backpack by
 * `GATHER_STONE_STOWED_SHARE`, lets the jolt die away by `GATHER_STONE_SETTLED_SHARE`, then stands easy for the rest
 * of the lift.
 */
export const GATHER_STONE_SQUATTED_SHARE = 0.22;
export const GATHER_STONE_FREED_SHARE = 0.42;
export const GATHER_STONE_RISEN_SHARE = 0.64;
export const GATHER_STONE_DIPPED_SHARE = 0.69;
export const GATHER_STONE_SHOULDER_SHARE = 0.75;
export const GATHER_STONE_STOWED_SHARE = 0.81;
export const GATHER_STONE_SETTLED_SHARE = 0.87;

/** The share of the lift at which the hands close on the stone and it shows in them, part way into the grip. */
export const GATHER_STONE_GRIP_SHARE = 0.27;

/** Seconds the player takes to stand back up when gathering stops. */
export const GATHER_STONE_LEAVE_SECONDS = 0.35;

/** Squatting low, hips down and back, back fairly upright, both hands either side of the stone on the ground. */
const SQUAT_POSE: BuildPose = {
  hipsDrop: 0.24,
  hipsBack: 0.14,
  hipsLean: 0.2,
  chestLean: 0.25,
  headTilt: -0.15,
  reach: 1,
  hands: { forward: 0.38, height: 0.1, spread: 0.15 },
};

/** Still squatting, the hands pressed in on the stone's sides. */
const GRIP_POSE: BuildPose = { ...SQUAT_POSE, hands: { forward: 0.36, height: 0.1, spread: 0.1 } };

/** How far each tug pulls the hands back toward the player, in metres, as they rock the stone free. */
const TUG_BACK_METRES = 0.04;
/** How far each tug lifts the hands, in metres. */
const TUG_UP_METRES = 0.03;

/** Stood up, leaning back a little against the stone's weight, hugging it at the belly with both hands. */
const HUG_POSE: BuildPose = {
  hipsDrop: 0.03,
  hipsBack: 0,
  hipsLean: -0.06,
  chestLean: -0.08,
  headTilt: 0.1,
  reach: 1,
  hands: { forward: 0.26, height: 0.55, spread: 0.1 },
};

/** The knees bend a little before the heave, with the stone still hugged. */
const DIP_POSE: BuildPose = { ...HUG_POSE, hipsDrop: 0.08, hipsLean: 0, chestLean: 0, hands: { forward: 0.26, height: 0.5, spread: 0.1 } };

/**
 * The stone held up beside the right shoulder, out past the side of the head so it does not pass through the face or
 * the chest. The player faces +z and the right side is -x. The left hand's spread is negative, so it crosses to the
 * right of the middle.
 */
const SHOULDER_POSE: BuildPose = {
  hipsDrop: 0,
  hipsBack: 0,
  hipsLean: 0,
  chestLean: 0.05,
  headTilt: -0.05,
  reach: 1,
  hands: { forward: 0.16, height: 0.88, spread: -0.24 },
  rightHand: { forward: 0.14, height: 0.9, spread: 0.42 },
};

/**
 * The stone pushed back over the right shoulder by the right hand and dropped into the top of the backpack. The left
 * hand has let go and hangs in front. The player bends forward a little, so the stone rolls into the backpack.
 */
const STOW_POSE: BuildPose = {
  hipsDrop: 0,
  hipsBack: 0,
  hipsLean: 0.05,
  chestLean: 0.15,
  headTilt: 0.2,
  reach: 1,
  hands: { forward: 0.2, height: 0.6, spread: 0.12 },
  rightHand: { forward: -0.12, height: 0.95, spread: 0.12 },
};

/** How high the stone arcs above a straight line as it goes back over the shoulder, in metres. */
const OVER_SHOULDER_ARC_METRES = 0.08;

/** How far the hands bounce as the stone lands in the backpack, in metres, before the jolt dies away. */
const STOW_JOLT_METRES = 0.04;

/** Standing as the clip holds the player. The hand spot is the stow spot, so the end of one lift meets the start of the next. */
const STANDING = scaleBuildPose(STOW_POSE, 0);

/** Share `share` of the way through the phase from `start` to `end`, from 0 to 1. */
const within = (share: number, start: number, end: number): number => Math.min(1, Math.max(0, (share - start) / (end - start)));

/** The pose `share` of the way through one lift, from 0 to 1. It starts and ends standing, so lift follows lift with no jump. */
export function gatherStonePoseAtShare(share: number): BuildPose {
  if (share < GATHER_STONE_SQUATTED_SHARE) return blendBuildPoses(STANDING, SQUAT_POSE, easeInOut(share / GATHER_STONE_SQUATTED_SHARE));
  if (share < GATHER_STONE_FREED_SHARE) {
    // The hands close on the stone, then two short tugs back and up rock it free of the mud.
    const t = within(share, GATHER_STONE_SQUATTED_SHARE, GATHER_STONE_FREED_SHARE);
    const gripped = blendBuildPoses(SQUAT_POSE, GRIP_POSE, smoothstep(within(share, GATHER_STONE_SQUATTED_SHARE, GATHER_STONE_GRIP_SHARE)));
    const tug = Math.sin(within(t, 0.3, 1) * Math.PI * 2) ** 2;
    const hands = gripped.hands;
    return {
      ...gripped,
      hands: { ...hands, forward: hands.forward - TUG_BACK_METRES * tug, height: hands.height + TUG_UP_METRES * tug },
    };
  }
  if (share < GATHER_STONE_RISEN_SHARE) {
    // The legs drive the lift: the hips lead and the chest lags, staying over the stone until the hips are half up.
    const t = within(share, GATHER_STONE_FREED_SHARE, GATHER_STONE_RISEN_SHARE);
    const hips = easeInOut(t);
    const chest = easeInOut(within(t, 0.2, 1));
    const body = blendBuildPoses(GRIP_POSE, HUG_POSE, hips);
    return {
      ...body,
      chestLean: lerp(GRIP_POSE.chestLean, HUG_POSE.chestLean, chest),
      headTilt: lerp(GRIP_POSE.headTilt, HUG_POSE.headTilt, chest),
      hands: blendBuildPoses(GRIP_POSE, HUG_POSE, chest).hands,
    };
  }
  if (share < GATHER_STONE_DIPPED_SHARE) {
    return blendBuildPoses(HUG_POSE, DIP_POSE, easeInOut(within(share, GATHER_STONE_RISEN_SHARE, GATHER_STONE_DIPPED_SHARE)));
  }
  if (share < GATHER_STONE_SHOULDER_SHARE) {
    // The legs straighten and both arms heave the stone up beside the right shoulder.
    return blendBuildPoses(DIP_POSE, SHOULDER_POSE, easeInOut(within(share, GATHER_STONE_DIPPED_SHARE, GATHER_STONE_SHOULDER_SHARE)));
  }
  if (share < GATHER_STONE_STOWED_SHARE) {
    // The right hand pushes the stone back over the shoulder in a small arc. The left hand lets go.
    const t = within(share, GATHER_STONE_SHOULDER_SHARE, GATHER_STONE_STOWED_SHARE);
    const pose = blendBuildPoses(SHOULDER_POSE, STOW_POSE, easeInOut(t));
    const right = pose.rightHand ?? pose.hands;
    return { ...pose, rightHand: { ...right, height: right.height + OVER_SHOULDER_ARC_METRES * Math.sin(t * Math.PI) } };
  }
  if (share < GATHER_STONE_SETTLED_SHARE) {
    // The stone lands in the backpack: the hands bounce down a little and settle.
    const t = within(share, GATHER_STONE_STOWED_SHARE, GATHER_STONE_SETTLED_SHARE);
    const jolt = (1 - t) ** 2 * Math.sin(t * Math.PI * 3);
    const hands = STOW_POSE.hands;
    return { ...STOW_POSE, hipsDrop: 0.02 * jolt, hands: { ...hands, height: hands.height - STOW_JOLT_METRES * jolt } };
  }
  return blendBuildPoses(STOW_POSE, STANDING, easeInOut(within(share, GATHER_STONE_SETTLED_SHARE, 1)));
}

/** The gather-stone pose `seconds` after gathering began. */
export function gatherStonePoseAt(seconds: number): BuildPose {
  return gatherStonePoseAtShare(gatherStoneShareAt(seconds));
}

/** How far through the current lift the player is, from 0 to 1, `seconds` after gathering began. */
export function gatherStoneShareAt(seconds: number): number {
  return (((seconds / GATHER_STONE_LIFT_SECONDS) % 1) + 1) % 1;
}

/** True while the stone is in the player's hands: from when they grip it until it drops into the backpack. */
export function holdsStoneAt(seconds: number): boolean {
  const share = gatherStoneShareAt(seconds);
  return share >= GATHER_STONE_GRIP_SHARE && share < GATHER_STONE_STOWED_SHARE;
}

/**
 * How far the right hand has taken over the stone, from 0 to 1, `seconds` after gathering began. At 0 the stone sits in
 * front of the middle of both hands. At 1 it sits behind the right hand alone, as the right hand pushes it back over
 * the shoulder into the backpack.
 */
export function stoneInRightHandAt(seconds: number): number {
  return smoothstep(within(gatherStoneShareAt(seconds), GATHER_STONE_SHOULDER_SHARE, GATHER_STONE_STOWED_SHARE));
}
