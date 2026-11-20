// A spot on the valley floor, and every rule about adding, moving and measuring spots. See docs/adr/0009.

/** A spot on the valley floor, in metres from the valley's centre. */
export interface GroundPoint {
  x: number;
  z: number;
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
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** The heading from `from` toward `to`, in radians about the vertical axis from +z toward +x. */
export function headingToward(from: GroundPoint, to: GroundPoint): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
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
