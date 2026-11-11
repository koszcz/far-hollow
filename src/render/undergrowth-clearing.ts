// Decides where undergrowth must not show because the player has placed something there:
// a campfire, a bedroll, a building piece, or a blueprint.
// Footprints come straight from the camp's entities, so hidden undergrowth follows from the saved camp and nothing extra is saved.
import { bedrollEntities, blueprintEntities, campfireEntities, type EntityStore } from "../sim/entities";
import { BEDROLL_LENGTH_METRES, BEDROLL_WIDTH_METRES } from "./bedroll-meshes";

/**
 * A patch of ground that something placed by the player covers, in metres from the valley's centre.
 * A round patch reaches `radius` from its middle. A box reaches `halfX` along x and `halfZ` along z.
 */
export type CampFootprint =
  | { readonly x: number; readonly z: number; readonly radius: number }
  | { readonly x: number; readonly z: number; readonly halfX: number; readonly halfZ: number };

/** A campfire's stone ring, or its blueprint, covers ground this far from its centre, in metres. */
const CAMPFIRE_FOOTPRINT_METRES = 0.8;
/** Undergrowth also hides this far beyond a bedroll's edge, so leaves never lie over the mat, in metres. */
const BEDROLL_MARGIN_METRES = 0.15;

/** The patches of ground covered by everything the player has placed. */
export function campFootprints(entities: EntityStore): CampFootprint[] {
  const footprints: CampFootprint[] = [];
  for (const { position } of [...blueprintEntities(entities), ...campfireEntities(entities)]) {
    footprints.push({ x: position.x, z: position.z, radius: CAMPFIRE_FOOTPRINT_METRES });
  }
  for (const { position } of bedrollEntities(entities)) {
    footprints.push({
      x: position.x,
      z: position.z,
      halfX: BEDROLL_WIDTH_METRES / 2 + BEDROLL_MARGIN_METRES,
      halfZ: BEDROLL_LENGTH_METRES / 2 + BEDROLL_MARGIN_METRES,
    });
  }
  return footprints;
}

/** Whether a spot on the ground lies under anything the player has placed. */
export function isUnderCamp(footprints: readonly CampFootprint[], x: number, z: number): boolean {
  return footprints.some((footprint) =>
    "radius" in footprint
      ? Math.hypot(x - footprint.x, z - footprint.z) <= footprint.radius
      : Math.abs(x - footprint.x) <= footprint.halfX && Math.abs(z - footprint.z) <= footprint.halfZ,
  );
}
