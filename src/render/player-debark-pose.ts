// Builds the "debarking-animation" asset in asset-manifest.json: the player bends over a log on the ground, sets the
// drawknife's blade in at the far side, pulls it towards the body to strip a length of bark, then lifts it and reaches
// out for the next stroke. It is posed in code on top of the idle clip with the build pose's bones, so it has no clip
// of its own. The owner approved the asset.
import { DRAWKNIFE_GRIP } from "./pile-meshes";
import { scaleBuildPose, type BuildPose } from "./player-build-pose";

/** Seconds one stroke takes: reach out, bite in, pull back, and lift. */
export const DEBARK_STROKE_SECONDS = 1.5;

/**
 * Where each phase of one stroke ends, as shares of the stroke. The player reaches out over the log until
 * `DEBARK_REACHED_SHARE`, presses the blade into the bark until `DEBARK_BITE_SHARE`, pulls it back towards the body by
 * `DEBARK_PULLED_SHARE`, then lifts the blade off and carries it out again for the rest of the stroke.
 */
export const DEBARK_REACHED_SHARE = 0.38;
export const DEBARK_BITE_SHARE = 0.46;
export const DEBARK_PULLED_SHARE = 0.8;

/** Seconds the player takes to bend over when debarking starts, and to stand up when it stops. */
export const DEBARK_ENTER_SECONDS = 0.35;

/**
 * How much bigger the drawknife is in the hands than in a pile. The player's head and beard are big for the body,
 * like the axe, so a true-size drawknife hides under them.
 */
export const DRAWKNIFE_IN_HAND_SCALE = 1.5;

/** How far each hand is from the middle, in metres: one on each handle of the drawknife. */
const HANDS_SPREAD = DRAWKNIFE_GRIP.side * DRAWKNIFE_IN_HAND_SCALE;

/** Bent over the log, the blade just lifted clear of the bark near the body. The stroke starts and ends here. */
const DEBARK_LIFTED_POSE: BuildPose = {
  hipsDrop: 0.14,
  hipsBack: 0.14,
  hipsLean: 0.4,
  chestLean: 0.6,
  headTilt: -0.35,
  reach: 1,
  hands: { forward: 0.3, height: 0.36, spread: HANDS_SPREAD },
};

/** Stretched out over the log, the blade resting on the bark at the far side. */
const DEBARK_REACHED_POSE: BuildPose = {
  hipsDrop: 0.16,
  hipsBack: 0.08,
  hipsLean: 0.5,
  chestLean: 0.8,
  headTilt: -0.45,
  reach: 1,
  hands: { forward: 0.52, height: 0.26, spread: HANDS_SPREAD },
};

/** The blade pressed into the bark: the hands sink a little and the shoulders come down onto them. */
const DEBARK_BITE_POSE: BuildPose = {
  ...DEBARK_REACHED_POSE,
  hipsDrop: 0.18,
  chestLean: 0.85,
  hands: { ...DEBARK_REACHED_POSE.hands, height: 0.23 },
};

/** The stroke done: the player has rocked back with the hips, pulling the blade along the log to just in front of the knees. */
const DEBARK_PULLED_POSE: BuildPose = {
  hipsDrop: 0.17,
  hipsBack: 0.18,
  hipsLean: 0.38,
  chestLean: 0.55,
  headTilt: -0.5,
  reach: 1,
  hands: { forward: 0.28, height: 0.24, spread: HANDS_SPREAD },
};

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function blend(a: BuildPose, b: BuildPose, t: number): BuildPose {
  return {
    hipsDrop: lerp(a.hipsDrop, b.hipsDrop, t),
    hipsBack: lerp(a.hipsBack, b.hipsBack, t),
    hipsLean: lerp(a.hipsLean, b.hipsLean, t),
    chestLean: lerp(a.chestLean, b.chestLean, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
    reach: lerp(a.reach, b.reach, t),
    hands: {
      forward: lerp(a.hands.forward, b.hands.forward, t),
      height: lerp(a.hands.height, b.hands.height, t),
      spread: lerp(a.hands.spread, b.hands.spread, t),
    },
  };
}

/** The pose `share` of the way through one stroke, from 0 to 1. The stroke starts and ends lifted, so it loops without a jump. */
function strokePoseAt(share: number): DebarkPose {
  if (share < DEBARK_REACHED_SHARE) {
    // Carry the blade out over the log, lifted clear of the bark.
    return blend(DEBARK_LIFTED_POSE, DEBARK_REACHED_POSE, easeInOut(share / DEBARK_REACHED_SHARE));
  }
  if (share < DEBARK_BITE_SHARE) {
    // Press the blade into the bark.
    const t = (share - DEBARK_REACHED_SHARE) / (DEBARK_BITE_SHARE - DEBARK_REACHED_SHARE);
    return blend(DEBARK_REACHED_POSE, DEBARK_BITE_POSE, smoothstep(t));
  }
  if (share < DEBARK_PULLED_SHARE) {
    // The pull: it starts slow against the bark's grip, runs steadily, and slows as the strip comes free.
    const t = (share - DEBARK_BITE_SHARE) / (DEBARK_PULLED_SHARE - DEBARK_BITE_SHARE);
    return blend(DEBARK_BITE_POSE, DEBARK_PULLED_POSE, smoothstep(t));
  }
  // Lift the blade off the log, ready to reach out again.
  const t = (share - DEBARK_PULLED_SHARE) / (1 - DEBARK_PULLED_SHARE);
  return blend(DEBARK_PULLED_POSE, DEBARK_LIFTED_POSE, easeInOut(t));
}

export type DebarkPose = BuildPose;

/**
 * The debarking pose `seconds` after debarking began. For the first `DEBARK_ENTER_SECONDS` the player bends down
 * into the stroke from standing, so starting has no jump.
 */
export function debarkPoseAt(seconds: number): DebarkPose {
  const share = (((seconds / DEBARK_STROKE_SECONDS) % 1) + 1) % 1;
  const pose = strokePoseAt(share);
  if (seconds >= DEBARK_ENTER_SECONDS) return pose;
  return scaleBuildPose(pose, smoothstep(Math.max(0, seconds) / DEBARK_ENTER_SECONDS));
}
