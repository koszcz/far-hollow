// Decides where undergrowth must not show because the player has placed something there:
// a campfire, a bedroll, a building piece, or a blueprint.
// A blueprint covers the same ground as the piece it will become. PIECE_FOOTPRINTS gives that ground for each piece,
// so a new piece cannot be added without saying how much ground it covers.
// Footprints come straight from the camp's entities, so hidden undergrowth follows from the saved camp and nothing extra is saved.
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { bedrollEntities, blueprintEntities, campfireEntities, foundationEntities, leanToEntities, type Entity, type EntityStore } from "../sim/entities";
import { structureOf } from "../sim/structures";
import type { QuarterTurns } from "../sim/structure-kind";
import { BEDROLL_LENGTH_METRES, BEDROLL_WIDTH_METRES } from "./bedroll-meshes";
import { STONE_RING_RADIUS_METRES } from "./campfire-meshes";

/**
 * A patch of ground that something placed by the player covers, in metres from the valley's centre.
 * A round patch reaches `radius` from its middle. A box reaches `halfX` along x and `halfZ` along z.
 */
export type CampFootprint =
  | { readonly x: number; readonly z: number; readonly radius: number }
  | { readonly x: number; readonly z: number; readonly halfX: number; readonly halfZ: number };

/** A building piece the player can plan as a blueprint. */
type BuildingPiece = NonNullable<Entity["blueprint"]>["piece"];

/** Undergrowth also hides this far beyond a campfire's ring of stones, so it covers the stones themselves, in metres. */
const CAMPFIRE_MARGIN_METRES = 0.25;
/** Undergrowth also hides this far beyond a bedroll's edge, so leaves never lie over the mat, in metres. */
const BEDROLL_MARGIN_METRES = 0.15;

/** The ground each building piece covers, centred on (x, z) and facing `turns`. A blueprint and its finished piece both use this. */
const PIECE_FOOTPRINTS: Readonly<Record<BuildingPiece, (x: number, z: number, turns: QuarterTurns) => CampFootprint>> = {
  campfire: (x, z) => ({ x, z, radius: STONE_RING_RADIUS_METRES + CAMPFIRE_MARGIN_METRES }),
  leanTo: (x, z, turns) => {
    const { min, max } = structureOf("leanTo").footprint({ x, z }, turns);
    return { x, z, halfX: (max.x - min.x) / 2, halfZ: (max.z - min.z) / 2 };
  },
  // Undergrowth hides under the whole square, so no leaves poke up through the deck.
  foundation: (x, z) => ({ x, z, halfX: BUILD_GRID_METRES / 2, halfZ: BUILD_GRID_METRES / 2 }),
};

/** The patches of ground covered by everything the player has placed. */
export function campFootprints(entities: EntityStore): CampFootprint[] {
  const footprints: CampFootprint[] = [];
  for (const { blueprint, position, facing } of blueprintEntities(entities)) {
    footprints.push(PIECE_FOOTPRINTS[blueprint.piece](position.x, position.z, facing?.turns ?? 0));
  }
  for (const { position } of campfireEntities(entities)) {
    footprints.push(PIECE_FOOTPRINTS.campfire(position.x, position.z, 0));
  }
  for (const { position, facing } of leanToEntities(entities)) {
    footprints.push(PIECE_FOOTPRINTS.leanTo(position.x, position.z, facing?.turns ?? 0));
  }
  for (const { position } of foundationEntities(entities)) {
    footprints.push(PIECE_FOOTPRINTS.foundation(position.x, position.z, 0));
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

/**
 * Whether two lists of footprints cover exactly the same ground, in the same order.
 * It is cheap enough to call every frame, to spot when the player has placed, moved, or removed something.
 */
export function sameFootprints(a: readonly CampFootprint[], b: readonly CampFootprint[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const one = a[i];
    const other = b[i];
    if (one === undefined || other === undefined || one.x !== other.x || one.z !== other.z) return false;
    if ("radius" in one) {
      if (!("radius" in other) || one.radius !== other.radius) return false;
    } else if ("radius" in other || one.halfX !== other.halfX || one.halfZ !== other.halfZ) {
      return false;
    }
  }
  return true;
}

/** Whether a spot on the ground lies under anything the player has placed. */
export function isUnderCamp(footprints: readonly CampFootprint[], x: number, z: number): boolean {
  return footprints.some((footprint) =>
    "radius" in footprint
      ? Math.hypot(x - footprint.x, z - footprint.z) <= footprint.radius
      : Math.abs(x - footprint.x) <= footprint.halfX && Math.abs(z - footprint.z) <= footprint.halfZ,
  );
}
