import type { ApproachReach } from "./approach";
import { footprintOfEntity } from "./structure-queries";
import type { GroundRect } from "./structure-kind";
import type { PlacedStructure } from "./structure-types";
import { addGroundPoints, type GroundPoint, scaleGroundPoint } from "./ground-point";
import type { WalkTarget } from "./walk-target";

/** The player walks to a spot this far outside the ground a blueprint covers to build it, in metres. */
export const BUILD_STAND_METRES = 0.7;
/** The player can build a blueprint, or add a material to it, from this far outside the ground it covers, in metres. */
export const BUILD_REACH_METRES = 1.7;

/** How far a walk target lies from the edge of a rectangle in a straight line, in metres. */
export function gapTo(rect: GroundRect, target: WalkTarget): number {
  return "min" in target ? gapBetween(rect, target) : distanceOutside(rect, target);
}

/** How far apart two rectangles lie at their nearest edges, in metres. It is 0 if they touch or overlap. */
export function gapBetween(a: GroundRect, b: GroundRect): number {
  const dx = Math.max(a.min.x - b.max.x, 0, b.min.x - a.max.x);
  const dz = Math.max(a.min.z - b.max.z, 0, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
}

/** How far a spot lies outside a rectangle, in metres. It is 0 for a spot inside it. */
export function distanceOutside(rect: GroundRect, spot: GroundPoint): number {
  const dx = Math.max(rect.min.x - spot.x, 0, spot.x - rect.max.x);
  const dz = Math.max(rect.min.z - spot.z, 0, spot.z - rect.max.z);
  return Math.hypot(dx, dz);
}

/**
 * Where the approach takes a player at `player` to work on a blueprint or structure: within BUILD_REACH_METRES of the ground
 * it covers, just outside it, on their side of it. A player standing on it steps off it too, so a finished structure never traps them.
 */
export function structureReach(structure: PlacedStructure, player: GroundPoint): ApproachReach {
  const footprint = footprintOfEntity(structure);
  return { target: footprint, metres: BUILD_REACH_METRES, walk: { style: "offAndBeside", spot: standSpot(footprint, structure.position, player) } };
}

/** Where the player stands to build: just outside the blueprint, on the line from its centre towards the player. */
export function standSpot(rect: GroundRect, centre: GroundPoint, player: GroundPoint): GroundPoint {
  const dx = player.x - centre.x;
  const dz = player.z - centre.z;
  const distance = Math.hypot(dx, dz);
  const away = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 1, z: 0 };
  // How far along that line the edge of the blueprint is.
  const halfX = (rect.max.x - rect.min.x) / 2;
  const halfZ = (rect.max.z - rect.min.z) / 2;
  const toEdge = Math.min(away.x === 0 ? Infinity : halfX / Math.abs(away.x), away.z === 0 ? Infinity : halfZ / Math.abs(away.z));
  const reach = toEdge + BUILD_STAND_METRES;
  return addGroundPoints(centre, scaleGroundPoint(away, reach));
}
