// Builds the "hand-craft-animation" asset in asset-manifest.json: for a hand recipe, such as the saw or the fishing rod,
// the player stands still and works at something small held at waist height. The left hand holds the work steady. The
// right hand winds a binding around it in slow, steady loops, and the head bows to watch. It is posed in code on top of
// the idle clip with the build pose's bones, so it has no clip of its own. Added by player motions ticket 02 as a draft.
import { recipeOf, type RecipeKind } from "../sim/crafting";
import { scaleBuildPose, type BuildPose } from "./player-build-pose";

/** Seconds one loop of the right hand around the work takes. */
export const HAND_CRAFT_CYCLE_SECONDS = 2;
/** Seconds the player takes to lift the hands to the work when crafting starts, and to lower them when it stops. */
export const HAND_CRAFT_ENTER_SECONDS = 0.25;

/** Where the work sits: in front of the belly, a little left of the middle, in metres from the feet. */
const WORK = { forward: 0.38, height: 0.72 };
/** How far the left hand holds the work to the left of the middle, and the right hand works to the right, in metres. */
const LEFT_SPREAD = 0.06;
const RIGHT_SPREAD = 0.02;
/** How far the right hand loops out from the work, in metres: wider across than up and down. */
const LOOP_ACROSS_METRES = 0.05;
const LOOP_UP_METRES = 0.03;
/** How far the left hand turns the work to meet each loop, in metres. */
const STEADY_METRES = 0.01;

/** How each craft shows: sawing at the sawhorse, or working by hand. */
export type CraftMotion = "saw" | "hand";

/** Which motion shows while the player crafts this recipe. A recipe made at the sawhorse saws. Any other works by hand. */
export function craftMotionOf(recipe: RecipeKind): CraftMotion {
  return recipeOf(recipe).station === "sawhorse" ? "saw" : "hand";
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * The hand-craft pose `seconds` after crafting began. Each loop ends where it starts, so loops follow without a jump.
 * For the first `HAND_CRAFT_ENTER_SECONDS` the hands lift from standing, so starting has no jump.
 */
export function handCraftPoseAt(seconds: number): BuildPose {
  const turn = (seconds / HAND_CRAFT_CYCLE_SECONDS) * Math.PI * 2;
  const pose: BuildPose = {
    hipsDrop: 0,
    hipsBack: 0.02,
    hipsLean: 0.03,
    // The shoulders round a little over the work and rock gently with each loop.
    chestLean: 0.12 + 0.02 * Math.sin(turn),
    // The head bows to watch the hands.
    headTilt: 0.1,
    reach: 1,
    hands: {
      forward: WORK.forward,
      height: WORK.height + STEADY_METRES * Math.sin(turn + Math.PI / 2),
      spread: LEFT_SPREAD,
    },
    rightHand: {
      forward: WORK.forward + LOOP_UP_METRES * 0.5 * Math.cos(turn),
      height: WORK.height + LOOP_UP_METRES * Math.sin(turn),
      spread: RIGHT_SPREAD + LOOP_ACROSS_METRES * Math.cos(turn),
    },
  };
  if (seconds >= HAND_CRAFT_ENTER_SECONDS) return pose;
  return scaleBuildPose(pose, smoothstep(Math.max(0, seconds) / HAND_CRAFT_ENTER_SECONDS));
}
