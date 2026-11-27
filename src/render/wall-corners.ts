// Which ends of a log wall another wall crosses at a corner, so the wall reaches past them like the corner of a log cabin.
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { addGroundPoints, subtractGroundPoints } from "../sim/ground-point";
import { areAtRightAngles, quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";

/** Two corner points closer than this, in metres, are the same point. */
const SAME_POINT_METRES = 1e-6;

/** A log wall on the edge with this middle, facing `turns`. */
export interface WallLine {
  readonly middle: { readonly x: number; readonly z: number };
  readonly turns: QuarterTurns;
}

/** Which ends of a log wall another wall crosses at a corner. `start` is the end at the wall's -x, facing the default way. */
export interface WallEnds {
  readonly start: boolean;
  readonly end: boolean;
}

/** The two ends of a wall, in the world: first its start, then its end. */
function endsOf(wall: WallLine): [{ x: number; z: number }, { x: number; z: number }] {
  // Turning the default way's +x by the wall's facing gives the way from its start to its end.
  const radians = quarterTurnsToRadians(wall.turns);
  const half = { x: (Math.cos(radians) * BUILD_GRID_METRES) / 2, z: (-Math.sin(radians) * BUILD_GRID_METRES) / 2 };
  return [subtractGroundPoints(wall.middle, half), addGroundPoints(wall.middle, half)];
}

/**
 * Which ends of `wall` meet another wall at a corner, among `walls`. A wall running the other way crosses an end when
 * one of its own ends is at that same point. A wall running the same way, carrying on in a straight line, is not a corner.
 */
export function wallEnds(wall: WallLine, walls: readonly WallLine[]): WallEnds {
  const [start, end] = endsOf(wall);
  const same = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) < SAME_POINT_METRES && Math.abs(a.z - b.z) < SAME_POINT_METRES;
  const crossing = walls.filter((other) => areAtRightAngles(other.turns, wall.turns)).flatMap(endsOf);
  return { start: crossing.some((point) => same(point, start)), end: crossing.some((point) => same(point, end)) };
}
