// Builds the approved "forage-eat-drink-animation" asset in asset-manifest.json: short motions the player plays once.
// Foraging a berry bush leans in, plucks with one hand in the middle of the bush, and drops the berries into the other hand.
// Eating raises one hand to the mouth and bites twice, the head ducking in to bite and pulling back to tear.
// Drinking from the river kneels at the river bank, dips both hands into the water, and raises them cupped to the mouth.
// Filling the pot kneels at the river bank and dips the pot into the water. Drinking from the pot raises it to the mouth.
// Each is posed in code on top of the idle clip with the build pose's bones, so it has no clip of its own.
// Foraging mushrooms is not here: it reuses the approved "pick-up-animation" bend to the ground unchanged.
// The pot in the hands is the approved "pot", built by pot-shape.ts.
import type { ReachingFor } from "../sim/entities";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../sim/hand-reach";
import { blendBuildPoses, type BuildPose, type HandSpot } from "./player-build-pose";
import { easeInOut, smoothstep } from "./easing";

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

/**
 * A key moment: `at` is a share of the whole motion, from 0 to 1. `ease` shapes the way from the key before to this
 * one, and is easeInOut if missing.
 */
interface Key {
  readonly at: number;
  readonly pose: BuildPose;
  readonly ease?: (t: number) => number;
}

/** Speeds up into contact, as a quick tug or a bite does. */
const snap = (t: number): number => t ** 2;

/** The pose `share` of the way through a motion, eased from each key to the next. */
function keyedPose(keys: readonly Key[], share: number): BuildPose {
  const first = keys[0];
  if (first === undefined) return STANDING;
  if (share <= first.at) return first.pose;
  for (let i = 1; i < keys.length; i += 1) {
    const from = keys[i - 1];
    const to = keys[i];
    if (from === undefined || to === undefined) break;
    if (share <= to.at) return blendBuildPoses(from.pose, to.pose, (to.ease ?? easeInOut)((share - from.at) / (to.at - from.at)));
  }
  return keys.at(-1)?.pose ?? STANDING;
}

// Picking berries: the player leans in from the hips with a little bend at the knees, pushes the right hand into the
// leaves at the middle of the bush, plucks with a short tug back, and drops the berries into the left hand, cupped
// in front of the belly.
/** Where the right hand goes in a berry bush: in among the leaves, at the middle of the 0.7 m tall bush. */
const IN_BUSH: HandSpot = { forward: 0.6, height: 0.48, spread: 0.1 };
/** Where the plucking tug pulls the right hand to: a little back toward the player and up. */
const PLUCKED: HandSpot = { forward: 0.52, height: 0.55, spread: 0.1 };
/** Where the left hand waits, cupped in front of the belly, and where the right hand drops the berries into it. */
const CUPPED_AT_BELLY: HandSpot = { forward: 0.3, height: 0.78, spread: 0.06 };
const BERRIES_DROPPED: HandSpot = { forward: 0.32, height: 0.86, spread: 0.02 };
const IN_BUSH_POSE: BuildPose = {
  hipsDrop: 0.06,
  hipsBack: 0.05,
  hipsLean: 0.2,
  chestLean: 0.3,
  headTilt: 0.2,
  reach: 1,
  hands: CUPPED_AT_BELLY,
  rightHand: IN_BUSH,
};
const HAND_AT = HAND_AT_SECONDS / REACH_SECONDS;
/** Where the plucking tug ends, as a share of the motion. */
const PLUCKED_SHARE = HAND_AT + 0.08;
/** Where the berries drop into the left hand, as a share of the motion. */
const DROPPED_SHARE = 0.76;
const FORAGE_BUSH: readonly Key[] = [
  { at: 0, pose: standingWith(CUPPED_AT_BELLY, IN_BUSH) },
  { at: HAND_AT, pose: IN_BUSH_POSE },
  { at: PLUCKED_SHARE, pose: { ...IN_BUSH_POSE, chestLean: 0.26, rightHand: PLUCKED }, ease: snap },
  { at: DROPPED_SHARE, pose: { ...STANDING, chestLean: 0.08, headTilt: 0.25, reach: 1, hands: CUPPED_AT_BELLY, rightHand: BERRIES_DROPPED } },
  { at: 1, pose: standingWith(CUPPED_AT_BELLY, BERRIES_DROPPED), ease: smoothstep },
];

// Eating: the right hand lifts the food to the mouth, the head ducks forward to bite and pulls back to tear it off,
// the hand drops a little while the player chews, and the same again, then the hand goes down.
/** The right hand at the mouth, and just below it while chewing. */
const AT_MOUTH: HandSpot = { forward: MOUTH_FORWARD, height: MOUTH_HEIGHT, spread: 0.03 };
const BELOW_MOUTH: HandSpot = { forward: MOUTH_FORWARD + 0.06, height: MOUTH_HEIGHT - 0.2, spread: 0.06 };
/** How far the head ducks forward into a bite, and how far it pulls back to tear the food off, in radians. */
const BITE_HEAD_TILT = 0.22;
const TEAR_HEAD_TILT = -0.1;
const RAISED: BuildPose = { ...STANDING, chestLean: 0.03, reach: 1, hands: AT_MOUTH, rightHand: AT_MOUTH };
const BITE: BuildPose = { ...RAISED, chestLean: 0.07, headTilt: BITE_HEAD_TILT };
const TEAR: BuildPose = { ...RAISED, headTilt: TEAR_HEAD_TILT, hands: BELOW_MOUTH, rightHand: BELOW_MOUTH };
/** Chewing nods the head a little. */
const CHEW: BuildPose = { ...TEAR, headTilt: 0.06 };
const EAT: readonly Key[] = [
  { at: 0, pose: standingWith(AT_MOUTH, AT_MOUTH) },
  { at: 0.22, pose: RAISED },
  { at: 0.28, pose: BITE, ease: snap },
  { at: 0.38, pose: TEAR },
  { at: 0.48, pose: RAISED },
  { at: 0.54, pose: BITE, ease: snap },
  { at: 0.64, pose: TEAR },
  { at: 0.74, pose: CHEW },
  { at: 0.82, pose: TEAR },
  { at: 1, pose: standingWith(BELOW_MOUTH, BELOW_MOUTH), ease: smoothstep },
];

// Drinking from the river: the player kneels at the bank, leans over, scoops water toward them with both hands
// cupped together, lifts them to the mouth with the head tipped back, and stands up.
/** Both hands cupped together in the water at the river bank, after the scoop, and at the mouth while kneeling. */
const IN_WATER: HandSpot = { forward: 0.62, height: 0.1, spread: 0.05 };
const SCOOPED: HandSpot = { forward: 0.5, height: 0.14, spread: 0.04 };
const CUPPED_AT_MOUTH: HandSpot = { forward: MOUTH_FORWARD + 0.02, height: KNEELING_MOUTH, spread: 0.04 };
const SIP: BuildPose = { hipsDrop: KNEEL_DROP, hipsBack: 0.06, hipsLean: 0.1, chestLean: 0.02, headTilt: -0.3, reach: 1, hands: CUPPED_AT_MOUTH };
const DRINK_FROM_RIVER: readonly Key[] = [
  { at: 0, pose: standingWith(IN_WATER) },
  { at: 0.3, pose: kneelOver(IN_WATER) },
  { at: 0.38, pose: { ...kneelOver(SCOOPED), chestLean: 0.22 } },
  { at: 0.56, pose: SIP },
  { at: 0.7, pose: { ...SIP, headTilt: -0.38 } },
  { at: 1, pose: standingWith(CUPPED_AT_MOUTH), ease: smoothstep },
];

/** Both hands hold the pot by its lugs, in the water at the river bank. */
const POT_IN_WATER: HandSpot = { forward: 0.6, height: 0.2, spread: POT_SPREAD };
const POT_LIFTED: HandSpot = { forward: 0.4, height: 0.75, spread: POT_SPREAD };
const FILL_POT: readonly Key[] = [
  { at: 0, pose: standingWith(POT_IN_WATER) },
  { at: HAND_AT, pose: kneelOver(POT_IN_WATER) },
  { at: HAND_AT + 0.12, pose: kneelOver(POT_IN_WATER) },
  { at: 1, pose: standingWith(POT_LIFTED), ease: smoothstep },
];

// Drinking from the pot: both hands lift the pot to the mouth, the head and chest tip back as the pot tips, the head
// nods with two gulps, and the pot comes back down to the chest.
/** Both hands hold the pot by its lugs, at the chest and up at the mouth. */
const POT_AT_CHEST: HandSpot = { forward: 0.38, height: 0.95, spread: POT_SPREAD };
const POT_AT_MOUTH: HandSpot = { forward: MOUTH_FORWARD + 0.12, height: MOUTH_HEIGHT - 0.12, spread: POT_SPREAD };
const POT_SIP: BuildPose = { ...STANDING, hipsBack: 0.02, chestLean: -0.08, headTilt: -0.3, reach: 1, hands: POT_AT_MOUTH };
/** A gulp nods the head a little forward. */
const POT_GULP: BuildPose = { ...POT_SIP, headTilt: -0.22 };
const DRINK_FROM_POT: readonly Key[] = [
  { at: 0, pose: standingWith(POT_AT_CHEST) },
  { at: 0.3, pose: POT_SIP },
  { at: 0.42, pose: POT_GULP },
  { at: 0.52, pose: POT_SIP },
  { at: 0.62, pose: POT_GULP },
  { at: 0.7, pose: POT_SIP },
  { at: 1, pose: standingWith(POT_AT_CHEST), ease: smoothstep },
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
  if (kind === "eat") return { body, arms: "right" };
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
