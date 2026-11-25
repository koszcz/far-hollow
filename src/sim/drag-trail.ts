// The way a dragged sled follows the player: along the ground the player walked, so it goes round walls as the player did.
// The trail is the spots the player walked through since the sled last passed them, oldest first.
// The rope pulls the sled straight towards the furthest spot along the trail it can see, as a real rope round a corner would.
import { groundDistance, type GroundPoint } from "./ground-point";

/** The spots the player walked through that the sled has not reached yet, oldest first. */
export type DragTrail = readonly GroundPoint[];

/** The player adds a spot to the trail once they have walked this far from the last one, in metres. */
const TRAIL_SPACING_METRES = 0.1;

/** Where a dragged sled moves to, the way its runners point, and the trail it still has to follow. */
export interface Dragged {
  readonly sled: GroundPoint;
  /** The way the rope pulls the sled, from the sled. Undefined if the rope is slack and the sled stays put. */
  readonly pull: GroundPoint | undefined;
  readonly trail: DragTrail;
}

/** The trail with the player's spot now added, if they have walked far enough from its newest spot. */
export function extendTrail(trail: DragTrail, player: GroundPoint): DragTrail {
  const newest = trail.at(-1);
  if (newest !== undefined && groundDistance(newest, player) < TRAIL_SPACING_METRES) return trail;
  return [...trail, { x: player.x, z: player.z }];
}

/**
 * Pulls a sled towards the player along the trail, so it stays `rope` metres behind them, measured along the rope.
 * The rope runs straight from the sled to the furthest spot along the trail that `canSee` says the sled can reach in a
 * straight line, then along the trail to the player. Spots the rope no longer touches drop off the trail.
 * If the sled can see no spot, as when it stands on blocked ground, the rope runs to the oldest spot.
 */
export function pullAlongTrail(
  sled: GroundPoint,
  player: GroundPoint,
  trail: DragTrail,
  rope: number,
  canSee: (from: GroundPoint, to: GroundPoint) => boolean,
): Dragged {
  const route = [...trail, { x: player.x, z: player.z }];
  let first = route.length - 1;
  while (first > 0 && !canSee(sled, route[first] ?? player)) first -= 1;
  let ahead = route.slice(first);
  let along = 0;
  for (let i = 1; i < ahead.length; i += 1) along += groundDistance(ahead[i - 1] ?? player, ahead[i] ?? player);
  let at = sled;
  let excess = groundDistance(at, ahead[0] ?? player) + along - rope;
  if (excess <= 0) return { sled, pull: undefined, trail: ahead.slice(0, -1) };
  // Move the sled along the rope by the excess, passing spots on the trail as it reaches them.
  let pull: GroundPoint | undefined;
  while (excess > 0 && ahead.length > 0) {
    const next = ahead[0] ?? player;
    const gap = groundDistance(at, next);
    if (gap > 0) pull = { x: (next.x - at.x) / gap, z: (next.z - at.z) / gap };
    if (gap > excess) {
      at = { x: at.x + (next.x - at.x) * (excess / gap), z: at.z + (next.z - at.z) * (excess / gap) };
      excess = 0;
    } else {
      at = next;
      excess -= gap;
      ahead = ahead.slice(1);
    }
  }
  return { sled: at, pull, trail: ahead.slice(0, -1) };
}
