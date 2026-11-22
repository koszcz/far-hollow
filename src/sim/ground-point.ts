// A spot on the valley floor, and every rule about adding, moving and measuring spots. See docs/adr/0009.
import type { Random } from "./random";

/** A spot on the valley floor, in metres from the valley's centre. */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

/** The spot you reach by stepping from `a` by `b`. */
export function addGroundPoints(a: GroundPoint, b: GroundPoint): GroundPoint {
  return { x: a.x + b.x, z: a.z + b.z };
}

/** The step that leads from `b` to `a`. */
export function subtractGroundPoints(a: GroundPoint, b: GroundPoint): GroundPoint {
  return { x: a.x - b.x, z: a.z - b.z };
}

/** `point` with both parts multiplied by `factor`. */
export function scaleGroundPoint(point: GroundPoint, factor: number): GroundPoint {
  return { x: point.x * factor, z: point.z * factor };
}

/** How far apart two spots are across the ground, in metres. Height is ignored. */
export function groundDistance(a: GroundPoint, b: GroundPoint): number {
  // Subtracts by hand, not with subtractGroundPoints, because walk-map and nearestWithin call it in loops over many spots.
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** The heading from `from` toward `to`, in radians about the vertical axis from +z toward +x. */
export function headingToward(from: GroundPoint, to: GroundPoint): number {
  const step = subtractGroundPoints(to, from);
  return Math.atan2(step.x, step.z);
}

/** The spot `metres` from `from` along `heading`, in radians about the vertical axis from +z toward +x. */
export function stepAlongHeading(from: GroundPoint, heading: number, metres: number): GroundPoint {
  return { x: from.x + Math.sin(heading) * metres, z: from.z + Math.cos(heading) * metres };
}

/**
 * A random spot between `radius.min` (0 when unset) and `radius.max` metres from `centre`. Spots spread evenly by area,
 * so they do not bunch up near the centre.
 */
export function randomPointAround(centre: GroundPoint, radius: { readonly min?: number; readonly max: number }, random: Random): GroundPoint {
  const inner = radius.min ?? 0;
  // Area grows with the square of the distance, so the distance is the square root of an even share of the squares.
  const distance = Math.sqrt(inner * inner + random() * (radius.max * radius.max - inner * inner));
  return stepAlongHeading(centre, random() * Math.PI * 2, distance);
}

/** The spot `share` of the way from `a` to `b`: `a` at 0, `b` at 1. */
export function blendGroundPoints(a: GroundPoint, b: GroundPoint, share: number): GroundPoint {
  return { x: a.x + (b.x - a.x) * share, z: a.z + (b.z - a.z) * share };
}

/**
 * An optional `toward` field holding a copy of `toward`, or no field when it is undefined. Spread it into a record
 * that may say where something faces, so the record never shares the spot it was given.
 */
export function copyToward(toward: GroundPoint | undefined): { toward?: GroundPoint } {
  return toward === undefined ? {} : { toward: { x: toward.x, z: toward.z } };
}

/** The candidate nearest `spot`, if any lies within `reach` metres of it. */
export function nearestWithin<T extends { position: GroundPoint }>(spot: GroundPoint, candidates: Iterable<T>, reach: number): T | undefined {
  let nearest: T | undefined;
  let nearestDistance = reach;
  for (const candidate of candidates) {
    const distance = groundDistance(candidate.position, spot);
    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}
