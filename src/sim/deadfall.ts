// Where sticks fall under trees, alone or in a deadfall: a few sticks that fell together under one tree.
// Making a valley uses this to lay its first sticks. Sticks that fall later can use it too.
import type { Random } from "./random";
import type { GroundPoint } from "./valley";

/** Sticks fall from trees, so each lies within this ring around a tree's trunk, in metres. */
export const STICK_MIN_FROM_TREE_METRES = 1.5;
export const STICK_MAX_FROM_TREE_METRES = 4;

/** A deadfall holds 3 to 6 sticks. */
export const DEADFALL_MIN_STICKS = 3;
export const DEADFALL_MAX_STICKS = 6;
/**
 * Each stick in a deadfall lies within this distance of the deadfall's middle, in metres.
 * Half a stick's length, so the sticks overlap a little but do not all lie on one spot.
 */
const DEADFALL_SPREAD_METRES = 0.45;
/** How many spots to try for each stick before the deadfall gives up. */
const TRIES_PER_STICK = 12;

/** Tells whether a stick may lie on a spot, for example out of the water and clear of tree trunks. */
export type SpotIsOpen = (spot: GroundPoint) => boolean;

/** Picks how many sticks a new deadfall holds, from 3 to 6, each size as likely as the others. */
export function rollDeadfallSize(random: Random): number {
  return DEADFALL_MIN_STICKS + Math.floor(random() * (DEADFALL_MAX_STICKS - DEADFALL_MIN_STICKS + 1));
}

/** A random spot in the ring around `tree` where sticks fall. The spot may not be open. */
export function spotUnderTree(random: Random, tree: GroundPoint): GroundPoint {
  const angle = random() * Math.PI * 2;
  const distance = STICK_MIN_FROM_TREE_METRES + (STICK_MAX_FROM_TREE_METRES - STICK_MIN_FROM_TREE_METRES) * random();
  return { x: tree.x + Math.sin(angle) * distance, z: tree.z + Math.cos(angle) * distance };
}

/** Lays one stick alone under `tree`, on an open spot in the ring around the trunk. Returns undefined if the spot it picks is not open. */
export function layLoneStick(random: Random, tree: GroundPoint, isOpen: SpotIsOpen): GroundPoint[] | undefined {
  const spot = spotUnderTree(random, tree);
  return isOpen(spot) ? [spot] : undefined;
}

/**
 * Lays a deadfall of `stickCount` sticks under `tree`. Each stick lies in the ring around the trunk, on an open spot,
 * close to the others. Returns undefined if there is no room for all the sticks, so the caller can try another tree.
 */
export function layDeadfall(random: Random, tree: GroundPoint, stickCount: number, isOpen: SpotIsOpen): GroundPoint[] | undefined {
  const middle = spotUnderTree(random, tree);
  if (!isOpen(middle)) return undefined;
  const sticks: GroundPoint[] = [middle];
  while (sticks.length < stickCount) {
    const stick = nearbySpot(random, tree, middle, isOpen);
    if (stick === undefined) return undefined;
    sticks.push(stick);
  }
  return sticks;
}

/** An open spot within the deadfall's spread of `middle`, and still in the ring around `tree`. */
function nearbySpot(random: Random, tree: GroundPoint, middle: GroundPoint, isOpen: SpotIsOpen): GroundPoint | undefined {
  for (let attempt = 0; attempt < TRIES_PER_STICK; attempt += 1) {
    const angle = random() * Math.PI * 2;
    // The square root spreads the sticks evenly over the circle instead of crowding its middle.
    const distance = DEADFALL_SPREAD_METRES * Math.sqrt(random());
    const spot = { x: middle.x + Math.sin(angle) * distance, z: middle.z + Math.cos(angle) * distance };
    const fromTree = Math.hypot(spot.x - tree.x, spot.z - tree.z);
    if (fromTree < STICK_MIN_FROM_TREE_METRES || fromTree > STICK_MAX_FROM_TREE_METRES) continue;
    if (isOpen(spot)) return spot;
  }
  return undefined;
}
