// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as the lean-to or a log wall, adds one entry to STRUCTURES with its cost and placement rule.
import { BUILD_GRID_METRES, isOnGridSquare, snapToGridPoint, snapToGridSquare } from "./build-grid";
import { blueprintEntities, campfireEntities, foundationEntities, stumpEntities, treeEntities, type Entity, type EntityStore } from "./entities";
import { foundationDeckTop } from "./foundations";
import { distanceToRiver, groundDistance, terrainHeightAt, type GroundPoint, type Terrain, type Valley } from "./valley";
import type { BuildMaterial, DeliveredMaterial, QuarterTurns, StructureKind } from "./structure-kind";
import { cellIndexAt, isWalkable, type WalkMap } from "./walk-map";

export type { BuildMaterial, DeliveredMaterial, MaterialCounts, QuarterTurns, StructureKind } from "./structure-kind";

/** How many of one material a structure costs. */
export interface MaterialCost {
  readonly material: BuildMaterial;
  readonly count: number;
}

/** What a placement rule may look at to decide whether a spot is allowed. */
export interface PlacementSite {
  readonly entities: EntityStore;
  readonly walkMap: WalkMap;
  readonly valley: Valley;
}

export interface StructureDefinition {
  readonly kind: StructureKind;
  /**
   * Everything building it costs, in the order the build menu shows it.
   * Construction has one stage for each single material in the cost. It spends them in this order, one at the start of each stage.
   */
  readonly cost: readonly MaterialCost[];
  /** How long the player holds the build action to build it from start to finish, in seconds. */
  readonly buildSeconds: number;
  /** The building-grid spot a blueprint placed near `at` snaps to. */
  snap(at: GroundPoint): GroundPoint;
  /** How high its position sits at a snapped spot, in metres. */
  heightAt(terrain: Terrain, spot: GroundPoint): number;
  /** Whether a blueprint of this structure may go at `spot`, a snapped spot, facing `turns`. */
  canPlace(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): boolean;
  /** Clears the ground for a blueprint just placed at `spot`, if the structure needs it. */
  clearSite?(entities: EntityStore, spot: GroundPoint): void;
  /** The components a finished piece gains when its blueprint is done. Each call returns new objects. */
  finishedComponents(): Entity;
}

/** How many sticks a campfire costs. Construction spends one at the start of each stage. */
export const CAMPFIRE_STICK_COST = 5;
/** How long the player holds the build action to build a campfire, in seconds. */
export const CAMPFIRE_BUILD_SECONDS = 5;
/** Two campfires, finished or not, cannot be closer than this, in metres. */
const CAMPFIRE_MIN_SPACING_METRES = 2;
/** A finished campfire stops the player walking within this many metres of its centre. */
const CAMPFIRE_WALK_BLOCK_RADIUS_METRES = 0.8;

/** Finished campfires and campfire blueprints. */
function campfiresAndPlans(entities: EntityStore): Entity[] {
  const planned = [...blueprintEntities(entities)].filter(({ blueprint }) => blueprint.piece === "campfire");
  return [...campfireEntities(entities), ...planned];
}

const campfire: StructureDefinition & { readonly kind: "campfire" } = {
  kind: "campfire",
  cost: [{ material: "stick", count: CAMPFIRE_STICK_COST }],
  buildSeconds: CAMPFIRE_BUILD_SECONDS,
  snap: snapToGridPoint,
  heightAt: (terrain, { x, z }) => terrainHeightAt(terrain, x, z),
  canPlace({ entities, walkMap }, spot) {
    if (!isWalkable(walkMap, spot)) return false;
    for (const other of campfiresAndPlans(entities)) {
      if (other.position !== undefined && groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return true;
  },
  finishedComponents: () => ({ campfire: { lit: false, fuelMinutes: 0 }, blocksWalking: { radius: CAMPFIRE_WALK_BLOCK_RADIUS_METRES } }),
};

/** How many debarked logs a foundation costs. Construction spends one at the start of each stage. */
export const FOUNDATION_LOG_COST = 4;
/** How long the player holds the build action to build a foundation, in seconds. */
export const FOUNDATION_BUILD_SECONDS = 12;
/** A tree trunk or stump this close to a foundation's square, in metres, counts as under it. */
const TRUNK_MARGIN_METRES = 0.3;
/** A campfire's ring of stones reaches this far from its centre, in metres, so a foundation keeps clear of it. */
const CAMPFIRE_RING_METRES = 0.7;

const foundation: StructureDefinition & { readonly kind: "foundation" } = {
  kind: "foundation",
  cost: [{ material: "debarkedLog", count: FOUNDATION_LOG_COST }],
  buildSeconds: FOUNDATION_BUILD_SECONDS,
  snap: snapToGridSquare,
  heightAt: foundationDeckTop,
  canPlace({ entities, walkMap, valley }, spot) {
    const half = BUILD_GRID_METRES / 2;
    const corners = [-1, 1].flatMap((dx) => [-1, 1].map((dz) => ({ x: spot.x + dx * half, z: spot.z + dz * half })));
    for (const corner of [spot, ...corners]) {
      if (cellIndexAt(walkMap, corner) === undefined) return false;
      if (distanceToRiver(valley.river, corner) <= valley.river.width / 2) return false;
    }
    // A blueprint cannot overlap a standing tree. The player fells it first.
    for (const tree of treeEntities(entities)) if (isOnGridSquare(spot, tree.position, TRUNK_MARGIN_METRES)) return false;
    // Foundations can sit side by side, but only one fits on each square.
    for (const other of [...foundationEntities(entities), ...blueprintEntities(entities)]) {
      if (other.blueprint?.piece !== "campfire" && groundDistance(other.position, spot) < half) return false;
    }
    for (const fire of campfiresAndPlans(entities)) {
      if (fire.position !== undefined && isOnGridSquare(spot, fire.position, CAMPFIRE_RING_METRES)) return false;
    }
    return true;
  },
  clearSite(entities, spot) {
    // The stump is removed for good, so it never regrows into a tree.
    for (const stump of [...stumpEntities(entities)]) {
      if (isOnGridSquare(spot, stump.position, TRUNK_MARGIN_METRES)) entities.remove(stump);
    }
  },
  finishedComponents: () => ({ foundation: true }),
};

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = { campfire, foundation };

/** Every structure the player can build, in the order the build menu lists them. */
export const STRUCTURES: readonly StructureDefinition[] = Object.values(STRUCTURE_BY_KIND);

/** The structure of this kind. */
export function structureOf(kind: StructureKind): StructureDefinition {
  return STRUCTURE_BY_KIND[kind];
}

/** Whether a material is carried to a blueprint on the player's shoulder, rather than taken from the backpack. */
export function isDelivered(material: BuildMaterial): material is DeliveredMaterial {
  return material === "debarkedLog";
}

/** How many single materials a structure costs in all, which is also how many stages its construction has. */
export function stageCount(structure: StructureDefinition): number {
  return structure.cost.reduce((sum, { count }) => sum + count, 0);
}
