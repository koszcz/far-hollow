// A walk target: what the player walks to or reaches for, and how far a spot lies from it (ADR 0009).
import { groundDistance, type GroundPoint } from "./ground-point";
import type { GroundRect } from "./structure-kind";

/**
 * A thing the player walks to: a single spot, such as a campfire's centre, or a rectangle of ground, such as a sled's footprint.
 * Distances to a rectangle are measured to its edge, and are 0 inside it.
 */
export type WalkTarget = GroundPoint | GroundRect;

/** How far a spot lies from a walk target, in metres: from the spot for a point, or from the edge for a rectangle. */
export function distanceToTarget(target: WalkTarget, spot: GroundPoint): number {
  return groundDistance(nearestPointOf(target, spot), spot);
}

/** The point of a walk target nearest `spot`. Inside a rectangle, that is the spot itself. */
export function nearestPointOf(target: WalkTarget, spot: GroundPoint): GroundPoint {
  if (!("min" in target)) return { x: target.x, z: target.z };
  return { x: Math.min(target.max.x, Math.max(target.min.x, spot.x)), z: Math.min(target.max.z, Math.max(target.min.z, spot.z)) };
}

/** The middle of a walk target. */
export function middleOf(target: WalkTarget): GroundPoint {
  if (!("min" in target)) return { x: target.x, z: target.z };
  return { x: (target.min.x + target.max.x) / 2, z: (target.min.z + target.max.z) / 2 };
}
