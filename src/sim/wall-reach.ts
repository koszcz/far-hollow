// Reach never crosses a wall: the player acts on a thing only from the thing's side of every wall.
// The pieces that block reach are the ones that block walking: a finished log wall or window. A door frame, with or without
// a door, blocks nothing, and neither does a blueprint or a half-built wall, since none of them blocks walking.
import { walkBlockerEdgeEntities, type EntityStore } from "./entities";
import type { GroundPoint } from "./ground-point";
import type { WalkTarget } from "./pathfinding";

/**
 * How far past its nearest edge reach aims into a rectangle, in metres. A thing standing against a wall, such as a bed,
 * is then on its own side of the wall, not on the wall itself.
 */
const INTO_TARGET_METRES = 0.01;
/** A spot this close to a wall, in metres, lies on that wall's edge. */
const ON_WALL_METRES = 1e-6;

/** One wall's edge, from one end to the other. */
interface WallEdge {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
}

/**
 * Whether a wall stands between a player at `from` and a target, so the player cannot act on it from there.
 * Reach aims at the target's point nearest `from`. A wall on the target's own edge never blocks it, so the player can
 * act on a wall, a window, or the shutters on a window from either side.
 */
export function isBehindWall(entities: EntityStore, from: GroundPoint, target: WalkTarget): boolean {
  const aim = aimPoint(target, from);
  for (const wall of wallEdges(entities)) {
    if (distanceToEdge(wall, aim) <= ON_WALL_METRES) continue;
    if (crosses(from, aim, wall)) return true;
  }
  return false;
}

/** The edges of every finished piece that blocks walking across its edge: each finished log wall and window. */
function wallEdges(entities: EntityStore): WallEdge[] {
  const edges: WallEdge[] = [];
  for (const piece of walkBlockerEdgeEntities(entities)) {
    for (const { from, to } of piece.blocksWalkingEdges) {
      // The edge runs across the line between the middles of the two squares beside it, and is as long as that line.
      const middle = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
      const half = { x: -(to.z - from.z) / 2, z: (to.x - from.x) / 2 };
      edges.push({ a: { x: middle.x - half.x, z: middle.z - half.z }, b: { x: middle.x + half.x, z: middle.z + half.z } });
    }
  }
  return edges;
}

/**
 * The point of a target that reach aims at from `from`: a point itself, or the nearest point just inside a rectangle.
 * A rectangle with no width, as an edge piece's is, has no inside, so reach aims at its nearest point. At a corner, that
 * point lies on the wall it meets, so the player can reach a wall's end from round the corner, and so never needs to step
 * into the room they are walling in.
 */
function aimPoint(target: WalkTarget, from: GroundPoint): GroundPoint {
  if (!("min" in target)) return { x: target.x, z: target.z };
  const hasInside = target.max.x > target.min.x && target.max.z > target.min.z;
  const into = (low: number, high: number, value: number) => {
    const inset = hasInside ? Math.min(INTO_TARGET_METRES, (high - low) / 2) : 0;
    return Math.min(high - inset, Math.max(low + inset, value));
  };
  return { x: into(target.min.x, target.max.x, from.x), z: into(target.min.z, target.max.z, from.z) };
}

/** How far a spot lies from a wall's edge, in metres. */
function distanceToEdge({ a, b }: WallEdge, spot: GroundPoint): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const along = Math.max(0, Math.min(1, ((spot.x - a.x) * dx + (spot.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(spot.x - (a.x + dx * along), spot.z - (a.z + dz * along));
}

/**
 * Whether the straight line from `from` to `to` crosses a wall's edge. Touching an end of the edge counts, so reach never
 * slips through the corner where two walls meet. A player standing on the edge's line does not cross it.
 */
function crosses(from: GroundPoint, to: GroundPoint, { a, b }: WallEdge): boolean {
  const line = { x: to.x - from.x, z: to.z - from.z };
  const edge = { x: b.x - a.x, z: b.z - a.z };
  const across = line.x * edge.z - line.z * edge.x;
  // A line running along the wall never crosses it.
  if (Math.abs(across) < 1e-12) return false;
  const start = { x: a.x - from.x, z: a.z - from.z };
  const alongLine = (start.x * edge.z - start.z * edge.x) / across;
  const alongEdge = (start.x * line.z - start.z * line.x) / across;
  const lineLength = Math.hypot(line.x, line.z);
  const edgeLength = Math.hypot(edge.x, edge.z);
  const slackLine = ON_WALL_METRES / lineLength;
  const slackEdge = ON_WALL_METRES / edgeLength;
  return alongLine > slackLine && alongLine <= 1 && alongEdge >= -slackEdge && alongEdge <= 1 + slackEdge;
}
