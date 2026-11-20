// Builds the draft "forage-eat-drink-animation" asset in asset-manifest.json: short motions the player plays once.
// Foraging a berry bush reaches one hand into the bush at chest height. Eating raises one hand to the mouth twice.
// Drinking from the river kneels at the river bank, dips both hands into the water, and raises them cupped to the mouth.
// Filling the pot kneels at the river bank and dips the pot into the water. Drinking from the pot raises it to the mouth.
// Each is posed in code on top of the idle clip with the build pose's bones, so it has no clip of its own.
// Foraging mushrooms is not here: it reuses the approved "pick-up-animation" bend to the ground unchanged.
// The pot in the hands is the approved "pot", built by pot-shape.ts.
import type { ReachingFor } from "../sim/entities";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../sim/hand-reach";
import { blendBuildPoses, type BuildPose, type HandSpot } from "./player-build-pose";
import { easeInOut } from "./easing";

/** The motions this module poses. */
export const EAT_DRINK_KINDS = ["forageBush", "eat", "drinkFromRiver", "fillPot", "drinkFromPot"] as const;
export type EatDrinkKind = (typeof EAT_DRINK_KINDS)[number];

/** Which motion plays, and how many seconds into it the player is. */
export interface EatDrinkMotion {
  readonly kind: EatDrinkKind;
  readonly seconds: number;
}

/**
 * What the player does in one frame, as far as a bite or drink goes: whether they walk, and which timed work or
 * reach is under way, if any, such as "build" or "reach".
 */
export interface DoingNow {
  readonly walking: boolean;
  readonly busyWith: string | undefined;
}

/**
 * Whether a bite or drink is cut short, going from doing `before` last frame to doing `now`. Walking or work that
 * starts while it plays cuts it short. Walking or work already under way when it began lets it play on top.
 */
export function eatDrinkCutShort(before: DoingNow, now: DoingNow): boolean {
  if (now.walking && !before.walking) return true;
  return now.busyWith !== undefined && now.busyWith !== before.busyWith;
}

/**
 * The motion a hand reach plays instead of the reach clip, from what game logic says the hand takes: reaching into a
 * berry bush for berries, or dipping the pot into the river for water. Any other reach plays the plain reach clip.
 */
export function reachMotionOf(reachingFor: ReachingFor | undefined): EatDrinkKind | undefined {
  if (reachingFor === "berries") return "forageBush";
  if (reachingFor === "riverWater") return "fillPot";
  return undefined;
}

/**
 * Only the arms and head of a pose, for a bite or drink played over walking or work. The hips and chest keep what
 * the motion underneath gives them.
 */
export function upperBodyOf(pose: BuildPose): BuildPose {
  return { ...pose, hipsDrop: 0, hipsBack: 0, hipsLean: 0, chestLean: 0 };
}

/** Seconds eating and drinking take. Game logic does them at once, so drawing picks the length. */
export const EAT_DRINK_SECONDS = 1;

/**
 * Seconds a motion takes. Foraging and filling the pot are hand reaches in game logic, which hands the food or water
 * over HAND_AT_SECONDS in, so they take REACH_SECONDS and get the hand to the bush or water at that moment.
 */
export function eatDrinkSecondsOf(kind: EatDrinkKind): number {
  return kind === "forageBush" || kind === "fillPot" ? REACH_SECONDS : EAT_DRINK_SECONDS;
}

/** One moment of a motion. */
export interface EatDrinkPose {
  readonly body: BuildPose;
  /** Which arms the pose moves: only the right, or both. The other arm stays as the clip holds it. */
  readonly arms: "right" | "both";
  /**
   * The pot held between the hands, or undefined if none. `tilt` tips it about the line through the hands, in radians:
   * positive tips the rim forward, away from the player, and negative tips it back toward the mouth.
   */
  readonly pot?: { readonly look: "empty" | "full"; readonly tilt: number };
}

/** How high the mouth is above the feet while standing, in metres. The player's head is big for the body. */
const MOUTH_HEIGHT = 1.32;
/** How far in front of the feet the hand stops at the mouth, in metres. The beard sticks out. */
const MOUTH_FORWARD = 0.24;
/** How far the hips sink to kneel at the river bank, in metres. The feet stay planted, so the knees fold deep. */
const KNEEL_DROP = 0.34;
/** How far each hand holding the pot is from the middle, in metres. The hands hold the near side of the rim. */
const POT_SPREAD = 0.1;

const STANDING: BuildPose = { hipsDrop: 0, hipsBack: 0, hipsLean: 0, chestLean: 0, headTilt: 0, reach: 0, hands: { forward: 0.2, height: 1, spread: 0.1 } };

/** Standing, with the hands about to go to `hands`, so blending moves them there as the reach grows. */
const standingWith = (hands: HandSpot, rightHand?: HandSpot): BuildPose =>
  rightHand === undefined ? { ...STANDING, hands } : { ...STANDING, hands, rightHand };

/** Kneeling at the river bank with the hands low over the water: the kneel, leaning forward, before raising them. */
const kneelOver = (hands: HandSpot): BuildPose => ({
  hipsDrop: KNEEL_DROP,
  hipsBack: 0.1,
  hipsLean: 0.15,
  chestLean: 0.25,
  headTilt: -0.2,
  reach: 1,
  hands,
});

/** How high the mouth is while kneeling upright with a little lean, in metres above the feet. */
const KNEELING_MOUTH = MOUTH_HEIGHT - KNEEL_DROP - 0.04;

/** A key moment: `at` is a share of the whole motion, from 0 to 1. */
interface Key {
  readonly at: number;
  readonly pose: BuildPose;
}

/** The pose `share` of the way through a motion, eased from each key to the next. */
function keyedPose(keys: readonly Key[], share: number): BuildPose {
  const first = keys[0];
  if (first === undefined) return STANDING;
  if (share <= first.at) return first.pose;
  for (let i = 1; i < keys.length; i += 1) {
    const from = keys[i - 1];
    const to = keys[i];
    if (from === undefined || to === undefined) break;
    if (share <= to.at) return blendBuildPoses(from.pose, to.pose, easeInOut((share - from.at) / (to.at - from.at)));
  }
  return keys.at(-1)?.pose ?? STANDING;
}

/** Where the right hand goes in a berry bush: out in front at chest height. */
const IN_BUSH: HandSpot = { forward: 0.5, height: 0.85, spread: 0.12 };
/** Where the right hand comes back to, holding the berries, in front of the chest. */
const BERRIES_IN: HandSpot = { forward: 0.3, height: 1.05, spread: 0.08 };
const IN_BUSH_POSE: BuildPose = { ...STANDING, chestLean: 0.12, headTilt: 0.05, reach: 1, hands: IN_BUSH, rightHand: IN_BUSH };
const HAND_AT = HAND_AT_SECONDS / REACH_SECONDS;
const FORAGE_BUSH: readonly Key[] = [
  { at: 0, pose: standingWith(IN_BUSH, IN_BUSH) },
  { at: HAND_AT, pose: IN_BUSH_POSE },
  { at: HAND_AT + 0.12, pose: IN_BUSH_POSE },
  { at: 0.8, pose: { ...IN_BUSH_POSE, chestLean: 0.03, hands: BERRIES_IN, rightHand: BERRIES_IN } },
  { at: 1, pose: standingWith(BERRIES_IN, BERRIES_IN) },
];

/** The right hand at the mouth, and just below it while chewing. */
const AT_MOUTH: HandSpot = { forward: MOUTH_FORWARD, height: MOUTH_HEIGHT, spread: 0.03 };
const BELOW_MOUTH: HandSpot = { forward: MOUTH_FORWARD + 0.06, height: MOUTH_HEIGHT - 0.2, spread: 0.06 };
const BITE: BuildPose = { ...STANDING, chestLean: 0.04, headTilt: 0.08, reach: 1, hands: AT_MOUTH, rightHand: AT_MOUTH };
const CHEW: BuildPose = { ...BITE, headTilt: 0, hands: BELOW_MOUTH, rightHand: BELOW_MOUTH };
const EAT: readonly Key[] = [
  { at: 0, pose: standingWith(AT_MOUTH, AT_MOUTH) },
  { at: 0.22, pose: BITE },
  { at: 0.38, pose: CHEW },
  { at: 0.55, pose: BITE },
  { at: 0.68, pose: CHEW },
  { at: 1, pose: standingWith(BELOW_MOUTH, BELOW_MOUTH) },
];

/** Both hands cupped together in the water at the river bank, and cupped at the mouth while kneeling. */
const IN_WATER: HandSpot = { forward: 0.62, height: 0.1, spread: 0.05 };
const CUPPED_AT_MOUTH: HandSpot = { forward: MOUTH_FORWARD + 0.02, height: KNEELING_MOUTH, spread: 0.04 };
const SIP: BuildPose = { hipsDrop: KNEEL_DROP, hipsBack: 0.06, hipsLean: 0.1, chestLean: 0.02, headTilt: -0.3, reach: 1, hands: CUPPED_AT_MOUTH };
const DRINK_FROM_RIVER: readonly Key[] = [
  { at: 0, pose: standingWith(IN_WATER) },
  { at: 0.3, pose: kneelOver(IN_WATER) },
  { at: 0.38, pose: kneelOver(IN_WATER) },
  { at: 0.58, pose: SIP },
  { at: 0.72, pose: SIP },
  { at: 1, pose: standingWith(CUPPED_AT_MOUTH) },
];

/** Both hands hold the pot by its lugs, in the water at the river bank. */
const POT_IN_WATER: HandSpot = { forward: 0.6, height: 0.2, spread: POT_SPREAD };
const POT_LIFTED: HandSpot = { forward: 0.4, height: 0.75, spread: POT_SPREAD };
const FILL_POT: readonly Key[] = [
  { at: 0, pose: standingWith(POT_IN_WATER) },
  { at: HAND_AT, pose: kneelOver(POT_IN_WATER) },
  { at: HAND_AT + 0.12, pose: kneelOver(POT_IN_WATER) },
  { at: 1, pose: standingWith(POT_LIFTED) },
];

/** Both hands hold the pot by its lugs, at the chest and up at the mouth. */
const POT_AT_CHEST: HandSpot = { forward: 0.38, height: 0.95, spread: POT_SPREAD };
const POT_AT_MOUTH: HandSpot = { forward: MOUTH_FORWARD + 0.12, height: MOUTH_HEIGHT - 0.12, spread: POT_SPREAD };
const POT_SIP: BuildPose = { ...STANDING, hipsBack: 0.02, chestLean: -0.08, headTilt: -0.3, reach: 1, hands: POT_AT_MOUTH };
const DRINK_FROM_POT: readonly Key[] = [
  { at: 0, pose: standingWith(POT_AT_CHEST) },
  { at: 0.3, pose: POT_SIP },
  { at: 0.7, pose: POT_SIP },
  { at: 1, pose: standingWith(POT_AT_CHEST) },
];

const KEYS: Readonly<Record<EatDrinkKind, readonly Key[]>> = {
  forageBush: FORAGE_BUSH,
  eat: EAT,
  drinkFromRiver: DRINK_FROM_RIVER,
  fillPot: FILL_POT,
  drinkFromPot: DRINK_FROM_POT,
};

/** How far the pot tips forward to dip into the river, and back to pour into the mouth, in radians. */
const POT_DIP_TILT = 0.7;
const POT_POUR_TILT = 1.1;

/** How far the pot tips `share` of the way through a motion: rising to `most` between `from` and `to`, and back after. */
function tiltBetween(share: number, from: number, to: number, most: number): number {
  if (share <= from || share >= 1) return 0;
  if (share < to) return most * easeInOut((share - from) / (to - from));
  return most * (1 - easeInOut((share - to) / (1 - to)));
}

/** The motion's pose `seconds` after it began. Before 0 and after it ends, the player stands as the clip holds them. */
export function eatDrinkPoseAt(kind: EatDrinkKind, seconds: number): EatDrinkPose {
  const share = Math.min(1, Math.max(0, seconds / eatDrinkSecondsOf(kind)));
  const body = keyedPose(KEYS[kind], share);
  if (kind === "forageBush" || kind === "eat") return { body, arms: "right" };
  if (kind === "fillPot") {
    // The pot tips forward into the water and fills when the hands get there, as game logic fills it.
    const tilt = tiltBetween(share, 0.15, HAND_AT, POT_DIP_TILT);
    return { body, arms: "both", pot: { look: share < HAND_AT ? "empty" : "full", tilt } };
  }
  if (kind === "drinkFromPot") {
    const tilt = -tiltBetween(share, 0.2, 0.55, POT_POUR_TILT);
    return { body, arms: "both", pot: { look: share < 0.55 ? "full" : "empty", tilt } };
  }
  return { body, arms: "both" };
}
