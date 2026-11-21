// Builds the "hand-craft-animation" asset in asset-manifest.json: for a hand recipe, such as the saw or the fishing rod,
// the player stands still and lashes a small bundle of sticks at waist height. The left hand holds the bundle and turns
// it to meet the cord. The right hand winds the cord once around it, holds, then tugs it tight out to the side, and
// the shoulders dip with the tug. The head bows to watch. It is posed in code on top of the idle clip with the build
// pose's bones, so it has no clip of its own. hand-craft-work.ts draws the bundle and the cord. Added by player motions
// ticket 02. The owner approved it.
import { recipeOf, type RecipeKind } from "../sim/crafting";
import { scaleBuildPose, type BuildPose, type HandSpot } from "./player-build-pose";
import { easeInOut, lerp, smoothstep } from "./easing";

/** Seconds one wind-and-tug cycle takes. */
export const HAND_CRAFT_CYCLE_SECONDS = 2;
/** Seconds the player takes to lift the hands to the work when crafting starts. When it stops, they stand straight back up. */
export const HAND_CRAFT_ENTER_SECONDS = 0.25;

/**
 * Where each phase of one cycle ends, as shares of the cycle. The right hand winds the cord once around the bundle
 * until `HAND_CRAFT_WOUND_SHARE`, holds at the top until `HAND_CRAFT_HOLD_SHARE`, tugs the cord tight by
 * `HAND_CRAFT_TUGGED_SHARE`, lets the jolt die away by `HAND_CRAFT_SETTLED_SHARE`, then comes back to the top of the
 * bundle for the rest of the cycle.
 */
export const HAND_CRAFT_WOUND_SHARE = 0.55;
export const HAND_CRAFT_HOLD_SHARE = 0.62;
export const HAND_CRAFT_TUGGED_SHARE = 0.72;
export const HAND_CRAFT_SETTLED_SHARE = 0.82;

/** Where the left wrist holds the bundle: in front of the belly, left of the middle, in metres from the feet. */
const LEFT_HOLD: HandSpot = { forward: 0.52, height: 0.78, spread: 0.1 };
/** The middle of the loop the right wrist winds, in metres from the feet: beside the binding, right of the middle. */
const WIND_MIDDLE: HandSpot = { forward: 0.52, height: 0.78, spread: 0.2 };
/** How far the right wrist circles out from `WIND_MIDDLE` as it winds the cord over, under, and back up, in metres. */
const WIND_RADIUS_METRES = 0.1;
/** Where the right wrist pulls the cord tight to: out to the right, a little up and back, in metres from the feet. */
const TUG_SPOT: HandSpot = { forward: 0.48, height: 0.84, spread: 0.32 };
/** How far the left wrist pulls left against the tug, in metres. */
const LEFT_BRACE_METRES = 0.02;
/** How far the right wrist bounces up and down after the tug before it settles, in metres. */
const TUG_JOLT_METRES = 0.015;

/** How far the shoulders round over the work, in radians forward. */
const CHEST_LEAN = 0.14;
/** How far the shoulders rock forward as the cord passes over the front of the bundle, in radians. */
const CHEST_ROCK = 0.03;
/** How far the shoulders dip forward with the tug, in radians. */
const CHEST_TUG_DIP = 0.06;
/** How far the head bows to watch the hands, in radians forward. */
const HEAD_BOW = 0.15;
/** How far the head nods with the tug, in radians forward. */
const HEAD_TUG_NOD = 0.05;

/** How far the left hand turns the bundle towards the passing cord, in radians about the bundle's length. */
const WORK_TURN_RADIANS = 0.35;
/** How far the left hand twists the bundle against the tug, in radians the other way. */
const WORK_TUG_TURN_RADIANS = 0.2;

/** How each craft shows: sawing at the sawhorse, or working by hand. */
export type CraftMotion = "saw" | "hand";

/** Which motion shows while the player crafts this recipe. A recipe made at the sawhorse saws. Any other works by hand. */
export function craftMotionOf(recipe: RecipeKind): CraftMotion {
  return recipeOf(recipe).station === "sawhorse" ? "saw" : "hand";
}

/** Where the right wrist is at angle `turn` of the wind: 0 on top of the bundle, a quarter turn in front, half under it. */
const windSpot = (turn: number): HandSpot => ({
  forward: WIND_MIDDLE.forward + WIND_RADIUS_METRES * Math.sin(turn),
  height: WIND_MIDDLE.height + WIND_RADIUS_METRES * Math.cos(turn),
  spread: WIND_MIDDLE.spread,
});

const blendSpot = (a: HandSpot, b: HandSpot, t: number): HandSpot => ({
  forward: lerp(a.forward, b.forward, t),
  height: lerp(a.height, b.height, t),
  spread: lerp(a.spread, b.spread, t),
});

/** One moment of the cycle: where the right wrist is, how far into the tug (0 to 1), and how far the wind has turned, in radians. */
interface CycleMoment {
  readonly right: HandSpot;
  readonly tug: number;
  readonly turn: number;
}

/** The moment `share` of the way through one cycle. The cycle starts and ends with the right wrist on top of the bundle. */
function momentAt(share: number): CycleMoment {
  const top = windSpot(0);
  if (share < HAND_CRAFT_WOUND_SHARE) {
    // The wind eases in and out, slow over the top and quick underneath.
    const turn = Math.PI * 2 * easeInOut(share / HAND_CRAFT_WOUND_SHARE);
    return { right: windSpot(turn), tug: 0, turn };
  }
  if (share < HAND_CRAFT_HOLD_SHARE) return { right: top, tug: 0, turn: 0 };
  if (share < HAND_CRAFT_TUGGED_SHARE) {
    // The tug speeds up until the cord snaps tight.
    const t = (share - HAND_CRAFT_HOLD_SHARE) / (HAND_CRAFT_TUGGED_SHARE - HAND_CRAFT_HOLD_SHARE);
    return { right: blendSpot(top, TUG_SPOT, t * t), tug: t * t, turn: 0 };
  }
  if (share < HAND_CRAFT_SETTLED_SHARE) {
    // The cord snaps tight and the hand bounces, dying away.
    const t = (share - HAND_CRAFT_TUGGED_SHARE) / (HAND_CRAFT_SETTLED_SHARE - HAND_CRAFT_TUGGED_SHARE);
    const jolt = TUG_JOLT_METRES * (1 - t) ** 2 * Math.sin(t * Math.PI * 3);
    return { right: { ...TUG_SPOT, height: TUG_SPOT.height + jolt }, tug: 1, turn: 0 };
  }
  // The hand settles back on top of the bundle for the next wind.
  const t = smoothstep((share - HAND_CRAFT_SETTLED_SHARE) / (1 - HAND_CRAFT_SETTLED_SHARE));
  return { right: blendSpot(TUG_SPOT, top, t), tug: 1 - t, turn: 0 };
}

const shareAt = (seconds: number): number => (((seconds / HAND_CRAFT_CYCLE_SECONDS) % 1) + 1) % 1;

/**
 * The hand-craft pose `seconds` after crafting began. Each cycle ends where it starts, so cycles follow without a jump.
 * For the first `HAND_CRAFT_ENTER_SECONDS` the hands lift from standing, so starting has no jump.
 */
export function handCraftPoseAt(seconds: number): BuildPose {
  const { right, tug, turn } = momentAt(shareAt(seconds));
  const pose: BuildPose = {
    hipsDrop: 0,
    hipsBack: 0.02,
    hipsLean: 0.04,
    // The shoulders round over the work, rock forward as the cord passes the front, and dip with the tug.
    chestLean: CHEST_LEAN + CHEST_ROCK * Math.max(0, Math.sin(turn)) + CHEST_TUG_DIP * tug,
    headTilt: HEAD_BOW + HEAD_TUG_NOD * tug,
    reach: 1,
    hands: { ...LEFT_HOLD, spread: LEFT_HOLD.spread + LEFT_BRACE_METRES * tug },
    rightHand: right,
  };
  if (seconds >= HAND_CRAFT_ENTER_SECONDS) return pose;
  return scaleBuildPose(pose, smoothstep(Math.max(0, seconds) / HAND_CRAFT_ENTER_SECONDS));
}

/**
 * How far the left hand has turned the bundle `seconds` after crafting began, in radians about its length. Positive
 * rolls its top forward to meet the cord as it passes over. Negative twists it back against the tug.
 */
export function handCraftWorkTurnAt(seconds: number): number {
  const { tug, turn } = momentAt(shareAt(seconds));
  return WORK_TURN_RADIANS * Math.sin(turn / 2) ** 2 - WORK_TUG_TURN_RADIANS * tug;
}
