// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as a log wall, adds one entry to STRUCTURES with its cost, placement rule, and finished form.
import type { BackpackContent } from "./backpack";
import { blueprintEntities, campfireEntities, roofEntities, treeEntities, type Entity, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./valley";
import { isInRect, rectsOverlap, turnedRect, turnOffset, type GroundRect, type QuarterTurns, type StructureKind } from "./structure-kind";
import { isWalkable, type WalkMap } from "./walk-map";

export type { GroundRect, QuarterTurns, StructureKind } from "./structure-kind";

/** A material a structure costs. */
export type BuildMaterial = Extract<BackpackContent, "stick" | "bark">;

/** How many of one material a structure costs. */
export interface MaterialCost {
  readonly material: BuildMaterial;
  readonly count: number;
}

/** What a placement rule may look at to decide whether a spot is allowed. */
export interface PlacementSite {
  readonly entities: EntityStore;
  readonly walkMap: WalkMap;
}

export interface StructureDefinition {
  readonly kind: StructureKind;
  /** Everything building it costs, in the order the build menu shows it and construction spends it. */
  readonly cost: readonly MaterialCost[];
  /** How long the player holds the build action to build it from start to finish, in seconds. */
  readonly buildSeconds: number;
  /** The ground it covers at `spot`, a building-grid spot, facing `turns`. A blueprint covers the same ground. */
  footprint(spot: GroundPoint, turns: QuarterTurns): GroundRect;
  /** Whether a blueprint of this structure may go at `spot`, a building-grid spot, facing `turns`. */
  canPlace(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): boolean;
  /** The components a finished structure gets in place of its blueprint, at `spot` facing `turns`. */
  finish(spot: GroundPoint, turns: QuarterTurns): Entity;
}

/**
 * The material each stage of construction spends, in order: one stage for each item of the cost.
 * Construction spends a stage's material at the start of that stage.
 */
export function stageMaterials(cost: readonly MaterialCost[]): BuildMaterial[] {
  return cost.flatMap(({ material, count }) => Array.from({ length: count }, () => material));
}

/** How many sticks a campfire costs. Construction spends one at the start of each stage. */
export const CAMPFIRE_STICK_COST = 5;
/** How long the player holds the build action to build a campfire, in seconds. */
export const CAMPFIRE_BUILD_SECONDS = 5;
/** Two campfires, finished or not, cannot be closer than this, in metres. */
const CAMPFIRE_MIN_SPACING_METRES = 2;
/** A finished campfire stops the player walking within this many metres of its centre. */
const CAMPFIRE_WALK_BLOCK_RADIUS_METRES = 0.8;

const campfire: StructureDefinition & { readonly kind: "campfire" } = {
  kind: "campfire",
  cost: [{ material: "stick", count: CAMPFIRE_STICK_COST }],
  buildSeconds: CAMPFIRE_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, CAMPFIRE_WALK_BLOCK_RADIUS_METRES, CAMPFIRE_WALK_BLOCK_RADIUS_METRES, turns),
  canPlace({ entities, walkMap }, spot) {
    if (!isWalkable(walkMap, spot)) return false;
    for (const other of [...campfireEntities(entities), ...blueprintEntities(entities)]) {
      if (groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return true;
  },
  finish: () => ({ campfire: { lit: false, fuelMinutes: 0 }, blocksWalking: { radius: CAMPFIRE_WALK_BLOCK_RADIUS_METRES } }),
};

/** How many sticks a lean-to's frame costs. */
export const LEAN_TO_STICK_COST = 10;
/** How much bark a lean-to's roof costs. */
export const LEAN_TO_BARK_COST = 6;
/** How long the player holds the build action to build a lean-to, in seconds. */
export const LEAN_TO_BUILD_SECONDS = 20;
/** A lean-to is this wide across its open front, in metres. */
export const LEAN_TO_WIDTH_METRES = 4;
/** A lean-to is this deep from its open front to its back, in metres. */
export const LEAN_TO_DEPTH_METRES = 2;
/**
 * The middles of the 1 m squares a finished lean-to's frame blocks, as offsets from its centre when it faces the default way.
 * Facing the default way, its open front faces +z. Its back row and the two front corners block walking.
 * The two middle front squares stay open, so the player walks in at the front and stands under the roof.
 */
const LEAN_TO_BLOCKED_SQUARES: readonly GroundPoint[] = [
  { x: -1.5, z: -0.5 }, { x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 }, { x: 1.5, z: -0.5 },
  { x: -1.5, z: 0.5 }, { x: 1.5, z: 0.5 },
];

const leanTo: StructureDefinition & { readonly kind: "leanTo" } = {
  kind: "leanTo",
  cost: [
    { material: "stick", count: LEAN_TO_STICK_COST },
    { material: "bark", count: LEAN_TO_BARK_COST },
  ],
  buildSeconds: LEAN_TO_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, LEAN_TO_WIDTH_METRES / 2, LEAN_TO_DEPTH_METRES / 2, turns),
  canPlace(site, spot, turns) {
    return isClearFor(site, leanTo.footprint(spot, turns));
  },
  finish: (spot, turns) => ({
    leanTo: true,
    roof: leanTo.footprint(spot, turns),
    blocksWalkingSpots: LEAN_TO_BLOCKED_SQUARES.map((offset) => {
      const turned = turnOffset(offset, turns);
      return { x: spot.x + turned.x, z: spot.z + turned.z };
    }),
  }),
};

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = { campfire, leanTo };

/** Every structure the player can build, in the order the build menu lists them. */
export const STRUCTURES: readonly StructureDefinition[] = Object.values(STRUCTURE_BY_KIND);

/** The structure of this kind. */
export function structureOf(kind: StructureKind): StructureDefinition {
  return STRUCTURE_BY_KIND[kind];
}

/** A standing tree's trunk and lowest branches reach this far from the foot of its trunk, in metres. Nothing is built over them. */
const TREE_CLEARANCE_METRES = 0.5;

/**
 * Whether a structure covering `rect` fits there: on ground the player can walk on, clear of standing trees,
 * and not over another blueprint or a finished roof.
 */
function isClearFor({ entities, walkMap }: PlacementSite, rect: GroundRect): boolean {
  for (let x = rect.min.x + 0.5; x < rect.max.x; x += 1) {
    for (let z = rect.min.z + 0.5; z < rect.max.z; z += 1) {
      if (!isWalkable(walkMap, { x, z })) return false;
    }
  }
  const nearTrees = {
    min: { x: rect.min.x - TREE_CLEARANCE_METRES, z: rect.min.z - TREE_CLEARANCE_METRES },
    max: { x: rect.max.x + TREE_CLEARANCE_METRES, z: rect.max.z + TREE_CLEARANCE_METRES },
  };
  for (const tree of treeEntities(entities)) if (isInRect(nearTrees, tree.position)) return false;
  for (const blueprint of blueprintEntities(entities)) {
    const other = structureOf(blueprint.blueprint.piece).footprint(blueprint.position, blueprint.facing?.turns ?? 0);
    if (rectsOverlap(rect, other)) return false;
  }
  for (const roofed of roofEntities(entities)) if (rectsOverlap(rect, roofed.roof)) return false;
  return true;
}
