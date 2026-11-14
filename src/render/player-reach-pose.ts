// Part of the "pick-up-animation" asset in asset-manifest.json. KayKit's PickUp and Interact clips carry the body.
// This file adds what the clips lack: one hand steered to the thing, a deeper bend so that hand can get there, and
// short blends into and out of the reach. player-mesh.ts plays the clips and applies these poses on top.
// The owner approved the asset.
import type { ReachHeight } from "../sim/entities";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../sim/hand-reach";
import { scaleBuildPose, type BuildPose } from "./player-build-pose";

/**
 * A real person picking a stick off the ground hinges at the hips with soft knees, puts one hand down to it, and
 * straightens. Putting something on a woodpile or in a chest, they lean in a little and push one hand out at waist height.
 * These poses add that lean and that hand on top of the clip. Distances are metres from the player's feet, angles radians.
 */
const REACH_POSES: Readonly<Record<ReachHeight, BuildPose>> = {
  low: {
    hipsDrop: 0.05,
    hipsBack: 0.04,
    hipsLean: 0.15,
    chestLean: 0.3,
    // Negative lifts the chin, so the player watches the hand.
    headTilt: -0.15,
    reach: 1,
    // `forward` here is the most the hand reaches. A nearer thing pulls it in. See reachPoseAt.
    hands: { forward: 0.5, height: 0.05, spread: 0.12 },
  },
  waist: {
    hipsDrop: 0,
    hipsBack: 0.02,
    hipsLean: 0.04,
    chestLean: 0.12,
    headTilt: -0.05,
    reach: 1,
    hands: { forward: 0.55, height: 0.85, spread: 0.14 },
  },
};

/** The nearest the hand reaches in front of the feet, however close the thing is, in metres. */
const REACH_NEAREST_METRES = 0.3;

/**
 * The phases of one reach, in seconds from its start. The hand moves out until HAND_AT_SECONDS, holds on the thing
 * until `REACH_HOLD_UNTIL_SECONDS`, then comes back as the player straightens, by REACH_SECONDS.
 */
export const REACH_HOLD_UNTIL_SECONDS = HAND_AT_SECONDS + 0.08;

/** Seconds the player takes to blend from the pose before into the reach, as the reach starts or starts again. */
export const REACH_BLEND_IN_SECONDS = 0.15;
/** Seconds the player takes to blend from the end of the reach into what comes next. */
export const REACH_BLEND_OUT_SECONDS = 0.25;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** How much of the reach pose shows `seconds` in: rising to 1 as the hand gets to the thing, holding, then easing off. */
export function reachWeightAt(seconds: number): number {
  if (seconds <= HAND_AT_SECONDS) return easeInOut(clamp01(seconds / HAND_AT_SECONDS));
  if (seconds <= REACH_HOLD_UNTIL_SECONDS) return 1;
  return 1 - easeInOut(clamp01((seconds - REACH_HOLD_UNTIL_SECONDS) / (REACH_SECONDS - REACH_HOLD_UNTIL_SECONDS)));
}

/**
 * The pose added on top of the clip `seconds` into a reach. `distance` is how far the thing is in front of the
 * player's feet, in metres, if known. The hand goes to it, but never nearer than REACH_NEAREST_METRES or further than the pose allows.
 */
export function reachPoseAt(height: ReachHeight, seconds: number, distance: number | undefined): BuildPose {
  const full = REACH_POSES[height];
  const forward = distance === undefined ? full.hands.forward : Math.min(full.hands.forward, Math.max(REACH_NEAREST_METRES, distance));
  return scaleBuildPose({ ...full, hands: { ...full.hands, forward } }, reachWeightAt(seconds));
}

/** How much of the pose before a blend still shows, `seconds` into a blend that takes `blendSeconds`. Smoothstep. */
export function blendLeftAt(seconds: number, blendSeconds: number): number {
  const t = clamp01(seconds / blendSeconds);
  return 1 - t * t * (3 - 2 * t);
}
