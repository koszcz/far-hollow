// Builds the draft "fishing-animation" asset in asset-manifest.json. Added by fishing ticket 02.
// The player casts: they swing the fishing rod back over the right shoulder, then whip it forward so the line flies out
// to the water. They wait with the rod held out in both hands, its tip bobbing a little. When a fish bites, they lift
// the rod and reel in, and the fish comes up out of the water on the line. Then they cast again.
// It is posed in code on top of the idle clip with the build pose's bones, so it has no clip of its own.
// The rod is the draft "fishing-rod", built by fishing-rod-model.ts. player-mesh.ts draws the line and the fish.
import { scaleBuildPose, type BuildPose, type HandSpot } from "./player-build-pose";

/** Seconds a cast takes: swing the rod back, whip it forward, and settle into the wait. */
export const FISH_CAST_SECONDS = 1.4;
/** Seconds the player takes to lift the rod and reel the fish in, ending as the fish goes in the backpack. */
export const FISH_REEL_SECONDS = 1.6;
/** Seconds the player takes to lift the rod from standing when fishing starts, and to lower it when fishing stops. */
export const FISH_ENTER_SECONDS = 0.35;

/** Where in a cast each phase ends, as shares of the cast: the swing back, then the whip forward. The rest settles. */
export const FISH_SWUNG_BACK_SHARE = 0.45;
export const FISH_WHIPPED_SHARE = 0.65;
/** How far through the reel the fish clears the water, as a share of the reel. */
export const FISH_OUT_OF_WATER_SHARE = 0.35;

/** Seconds one bob of the rod tip takes while the player waits. */
const BOB_SECONDS = 2.2;
/** How far the rod lifts and dips on each bob, in radians. */
const BOB_RADIANS = 0.04;
/** How far up the rod the left hand grips, from the right hand at the butt, in metres. */
const LEFT_HAND_UP_ROD_METRES = 0.22;

/** The fishing pose at one moment: the body, and how the rod and line lie. */
export interface FishingPose {
  readonly body: BuildPose;
  /** How far the rod points up from level, in radians. Past a right angle, it leans back over the shoulder. */
  readonly rodLift: number;
  /** How far the line reaches, from 0 (hanging short from the tip) to 1 (out to the float on the water). */
  readonly lineOut: number;
  /** Whether the caught fish hangs from the end of the line. */
  readonly fishShown: boolean;
}

/** One key moment: where the right hand holds the butt, and how far the rod lifts. The body follows. */
interface Key {
  readonly hand: HandSpot;
  readonly rodLift: number;
  readonly chestLean: number;
  readonly headTilt: number;
}

/** Waiting: the rod held out over the water, the hands at the chest. */
const WAIT: Key = { hand: { forward: 0.34, height: 1.0, spread: 0.08 }, rodLift: 0.55, chestLean: 0.05, headTilt: 0.05 };
/** Swung back: the hands up by the right ear, the rod leaning back over the shoulder. */
const SWUNG_BACK: Key = { hand: { forward: 0.12, height: 1.45, spread: 0.12 }, rodLift: 1.95, chestLean: -0.12, headTilt: -0.1 };
/** Whipped forward: the arms out, the rod pointing low over the water. */
const WHIPPED: Key = { hand: { forward: 0.46, height: 1.08, spread: 0.06 }, rodLift: 0.3, chestLean: 0.15, headTilt: 0.1 };
/** Reeled in: the rod lifted high, the hands drawn back and up, the fish dangling below the tip. */
const REELED: Key = { hand: { forward: 0.24, height: 1.25, spread: 0.08 }, rodLift: 1.25, chestLean: -0.1, headTilt: -0.15 };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

function blendKeys(a: Key, b: Key, t: number): Key {
  return {
    hand: { forward: lerp(a.hand.forward, b.hand.forward, t), height: lerp(a.hand.height, b.hand.height, t), spread: lerp(a.hand.spread, b.hand.spread, t) },
    rodLift: lerp(a.rodLift, b.rodLift, t),
    chestLean: lerp(a.chestLean, b.chestLean, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
  };
}

/** The body for a key. The right hand holds the butt. The left hand grips the rod a little further up it. */
function bodyFor(key: Key): BuildPose {
  const lift = Math.min(key.rodLift, Math.PI / 2);
  return {
    hipsDrop: 0,
    hipsBack: 0,
    hipsLean: 0,
    chestLean: key.chestLean,
    headTilt: key.headTilt,
    reach: 1,
    rightHand: key.hand,
    // The left hand crosses to the rod, just right of the middle, so its spread is negative.
    hands: {
      forward: key.hand.forward + LEFT_HAND_UP_ROD_METRES * Math.cos(lift),
      height: key.hand.height + LEFT_HAND_UP_ROD_METRES * Math.sin(lift),
      spread: -key.hand.spread * 0.6,
    },
  };
}

/**
 * The fishing pose `sinceCast` seconds after the latest cast began, with `toBite` seconds left until a fish bites.
 * `sinceStart` is the seconds since the player started fishing, for lifting the rod from standing.
 * Each cast starts from the reeled-in pose, so the reel flows into the next cast without a jump.
 */
export function fishPoseAt(sinceCast: number, toBite: number, sinceStart = Infinity): FishingPose {
  const pose = poseInCast(Math.max(0, sinceCast), Math.max(0, toBite));
  if (sinceStart >= FISH_ENTER_SECONDS) return pose;
  return { ...pose, body: scaleBuildPose(pose.body, smoothstep(clamp01(sinceStart / FISH_ENTER_SECONDS))) };
}

function poseInCast(sinceCast: number, toBite: number): FishingPose {
  if (toBite < FISH_REEL_SECONDS) {
    // The reel: lift the rod and draw the line in. The fish breaks the water partway through.
    const share = 1 - toBite / FISH_REEL_SECONDS;
    const key = blendKeys(waitKey(sinceCast), REELED, easeInOut(share));
    return { body: bodyFor(key), rodLift: key.rodLift, lineOut: 1 - smoothstep(share), fishShown: share >= FISH_OUT_OF_WATER_SHARE };
  }
  const share = sinceCast / FISH_CAST_SECONDS;
  if (share < FISH_SWUNG_BACK_SHARE) {
    const key = blendKeys(REELED, SWUNG_BACK, easeInOut(share / FISH_SWUNG_BACK_SHARE));
    return { body: bodyFor(key), rodLift: key.rodLift, lineOut: 0, fishShown: false };
  }
  if (share < FISH_WHIPPED_SHARE) {
    // The whip is fast: it speeds up all the way to the front.
    const t = (share - FISH_SWUNG_BACK_SHARE) / (FISH_WHIPPED_SHARE - FISH_SWUNG_BACK_SHARE);
    const key = blendKeys(SWUNG_BACK, WHIPPED, t * t);
    return { body: bodyFor(key), rodLift: key.rodLift, lineOut: t * t * 0.6, fishShown: false };
  }
  if (share < 1) {
    // The line lands on the water as the rod comes back up to wait.
    const t = (share - FISH_WHIPPED_SHARE) / (1 - FISH_WHIPPED_SHARE);
    const key = blendKeys(WHIPPED, waitKey(sinceCast), easeInOut(t));
    return { body: bodyFor(key), rodLift: key.rodLift, lineOut: lerp(0.6, 1, smoothstep(t)), fishShown: false };
  }
  const key = waitKey(sinceCast);
  return { body: bodyFor(key), rodLift: key.rodLift, lineOut: 1, fishShown: false };
}

/** The wait, with the rod tip bobbing gently. */
function waitKey(sinceCast: number): Key {
  const bob = Math.sin(((sinceCast - FISH_CAST_SECONDS) / BOB_SECONDS) * Math.PI * 2) * BOB_RADIANS;
  return { ...WAIT, rodLift: WAIT.rodLift + bob };
}
