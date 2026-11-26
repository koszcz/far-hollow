// Reach never crosses a wall. The player acts on a thing only from the thing's side of every wall.
// The pieces that stop reach are the ones that stop walking: each finished log wall and window.
// A door frame does not stop reach, with or without a door. A blueprint and a half-built wall do not stop it either.
import { walkBlockerEdgeEntities, type EntityStore } from "./entities";
import type { GroundPoint } from "./ground-point";
import { distanceToTarget, type WalkTarget } from "./walk-target";

/**
 * How far into a rectangle the reach check aims, in metres, past the rectangle's nearest edge.
 * A thing that stands against a wall, such as a bed, then counts as on its own side of the wall, not on the wall itself.
 */
const INTO_TARGET_METRES = 0.01;
/** A spot this close to a wall, in metres, counts as on the wall. */
const ON_WALL_METRES = 1e-6;
/** Below this value, a line and a wall run side by side and never meet. It compares two lengths multiplied together, in square metres. */
const SIDE_BY_SIDE_SQUARE_METRES = 1e-12;

/** One wall, as a straight line on the ground from one end to the other. */
interface WallEdge {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
}

/** Every finished wall that stops reach. Read them once with `wallsIn`, then check as many spots against them as needed. */
export type Walls = readonly WallEdge[];

/** The finished log walls and windows in the game now. */
export function wallsIn(entities: EntityStore): Walls {
  const edges: WallEdge[] = [];
  for (const piece of walkBlockerEdgeEntities(entities)) {
    for (const { from, to } of piece.blocksWalkingEdges) {
      // The wall runs across the line between the middles of the two squares beside it. It is as long as that line.
      const middle = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
      const half = { x: -(to.z - from.z) / 2, z: (to.x - from.x) / 2 };
      edges.push({ a: { x: middle.x - half.x, z: middle.z - half.z }, b: { x: middle.x + half.x, z: middle.z + half.z } });
    }
  }
  return edges;
}

/**
 * Whether a wall stands between a player at `from` and a thing, so the player cannot act on the thing from there.
 * A wall on the thing's own edge never stops reach. So the player can act on a wall, a window, or a window's shutters from either side.
 */
export function isBehindWall(walls: Walls, from: GroundPoint, thing: WalkTarget): boolean {
  const aim = aimPoint(thing, from);
  return walls.some((wall) => distanceToWall(wall, aim) > ON_WALL_METRES && crosses(from, aim, wall));
}

/** Whether a player at `from` can act on a thing: within `metres` of it and on its side of every wall. */
export function isWithinReach(walls: Walls, from: GroundPoint, thing: WalkTarget, metres: number): boolean {
  return distanceToTarget(thing, from) <= metres && !isBehindWall(walls, from, thing);
}

/**
 * The point of a thing that the reach check aims at from `from`.
 * For a point, that is the point itself. For a rectangle, it is the nearest point just inside the rectangle.
 * An edge piece, such as a wall, covers a rectangle with no width. That rectangle has no inside, so the check aims at its nearest point.
 * At a corner, that point lies on the wall that meets it there.
 * So the player can reach the end of a wall from round the corner, and never needs to step into the room they are walling in.
 */
function aimPoint(thing: WalkTarget, from: GroundPoint): GroundPoint {
  if (!("min" in thing)) return { x: thing.x, z: thing.z };
  const hasInside = thing.max.x > thing.min.x && thing.max.z > thing.min.z;
  const clampInside = (low: number, high: number, value: number) => {
    const inset = hasInside ? Math.min(INTO_TARGET_METRES, (high - low) / 2) : 0;
    return Math.min(high - inset, Math.max(low + inset, value));
  };
  return { x: clampInside(thing.min.x, thing.max.x, from.x), z: clampInside(thing.min.z, thing.max.z, from.z) };
}

/** How far a spot lies from a wall, in metres. */
function distanceToWall({ a, b }: WallEdge, spot: GroundPoint): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const along = Math.max(0, Math.min(1, ((spot.x - a.x) * dx + (spot.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(spot.x - (a.x + dx * along), spot.z - (a.z + dz * along));
}

/**
 * Whether the straight line from `from` to `to` crosses a wall.
 * A line that touches an end of the wall crosses it. So reach never slips through the corner where two walls meet.
 * A line that starts on the wall does not cross it. So a player standing on the wall's line reaches both sides.
 */
function crosses(from: GroundPoint, to: GroundPoint, { a, b }: WallEdge): boolean {
  const line = { x: to.x - from.x, z: to.z - from.z };
  const wall = { x: b.x - a.x, z: b.z - a.z };
  const turn = line.x * wall.z - line.z * wall.x;
  if (Math.abs(turn) < SIDE_BY_SIDE_SQUARE_METRES) return false;
  // Where the line and the wall meet, as a share of each one's length: 0 at its start, 1 at its end.
  const start = { x: a.x - from.x, z: a.z - from.z };
  const shareOfLine = (start.x * wall.z - start.z * wall.x) / turn;
  const shareOfWall = (start.x * line.z - start.z * line.x) / turn;
  // The same small allowance as ON_WALL_METRES, as a share of each length.
  const lineAllowance = ON_WALL_METRES / Math.hypot(line.x, line.z);
  const wallAllowance = ON_WALL_METRES / Math.hypot(wall.x, wall.z);
  return shareOfLine > lineAllowance && shareOfLine <= 1 && shareOfWall >= -wallAllowance && shareOfWall <= 1 + wallAllowance;
}
