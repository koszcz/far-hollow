// Decides where undergrowth must not show because the player has placed something there:
// a campfire, a bedroll, a lean-to, a building piece, a woodpile, a chest, a work station, or a blueprint.
// A blueprint covers the same ground as the structure it will become: the footprint its placement rule uses,
// unless FOOTPRINT_OVERRIDES says otherwise for that structure.
// Footprints come straight from the camp's entities, so hidden undergrowth follows from the saved camp and nothing extra is saved.
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { bedrollEntities, type EntityStore } from "../sim/entities";
import { placedStructures, structureOf } from "../sim/structures";
import type { QuarterTurns, StructureKind } from "../sim/structure-kind";
import { BEDROLL_LENGTH_METRES, BEDROLL_WIDTH_METRES } from "./bedroll-meshes";
import { STONE_RING_RADIUS_METRES } from "./campfire-meshes";

/**
 * A patch of ground that something placed by the player covers, in metres from the valley's centre.
 * A round patch reaches `radius` from its middle. A box reaches `halfX` along x and `halfZ` along z.
 */
export type CampFootprint =
  | { readonly x: number; readonly z: number; readonly radius: number }
  | { readonly x: number; readonly z: number; readonly halfX: number; readonly halfZ: number };

/** Undergrowth also hides this far beyond a campfire's ring of stones, so it covers the stones themselves, in metres. */
const CAMPFIRE_MARGIN_METRES = 0.25;
/** Undergrowth also hides this far beyond a bedroll's edge, so leaves never lie over the mat, in metres. */
const BEDROLL_MARGIN_METRES = 0.15;

/** The ground a structure covers, as its placement rule sees it, centred on (x, z) and facing `turns`. */
function structureFootprint(kind: StructureKind, x: number, z: number, turns: QuarterTurns): CampFootprint {
  const { min, max } = structureOf(kind).footprint({ x, z }, turns);
  return { x, z, halfX: (max.x - min.x) / 2, halfZ: (max.z - min.z) / 2 };
}

/**
 * The ground a structure covers where it differs from its placement footprint, centred on (x, z) and facing `turns`.
 * A blueprint and its finished structure both use this.
 */
const FOOTPRINT_OVERRIDES: Partial<Record<StructureKind, (x: number, z: number, turns: QuarterTurns) => CampFootprint>> = {
  // The ring of stones reaches past the ground a campfire blocks.
  campfire: (x, z) => ({ x, z, radius: STONE_RING_RADIUS_METRES + CAMPFIRE_MARGIN_METRES }),
  // Undergrowth hides under the whole square, so no leaves poke up through the deck.
  foundation: (x, z) => ({ x, z, halfX: BUILD_GRID_METRES / 2, halfZ: BUILD_GRID_METRES / 2 }),
  // A wall stands on a line with no width, so undergrowth hides in a strip either side of it.
  logWall: (x, z, turns) => edgePieceFootprint(x, z, turns),
  doorFrame: (x, z, turns) => edgePieceFootprint(x, z, turns),
};

/** Undergrowth hides this far either side of the line a log wall or door frame stands on, in metres. */
const EDGE_PIECE_HALF_THICKNESS_METRES = 0.2;

/** The strip of ground under a log wall or door frame: along its edge, facing `turns`, and a little either side. */
function edgePieceFootprint(x: number, z: number, turns: QuarterTurns): CampFootprint {
  const alongX = turns % 2 === 0;
  const half = BUILD_GRID_METRES / 2;
  return { x, z, halfX: alongX ? half : EDGE_PIECE_HALF_THICKNESS_METRES, halfZ: alongX ? EDGE_PIECE_HALF_THICKNESS_METRES : half };
}

/** The patches of ground covered by everything the player has placed. */
export function campFootprints(entities: EntityStore): CampFootprint[] {
  const footprints: CampFootprint[] = [];
  for (const { entity, kind } of placedStructures(entities)) {
    const { x, z } = entity.position;
    const turns = entity.facing?.turns ?? 0;
    footprints.push((FOOTPRINT_OVERRIDES[kind] ?? ((...at) => structureFootprint(kind, ...at)))(x, z, turns));
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
