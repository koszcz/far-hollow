// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as the lean-to or a log wall, adds one entry to STRUCTURES with its cost and placement rule.
import type { BackpackContent } from "./backpack";
import { blueprintEntities, campfireEntities, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./valley";
import type { QuarterTurns, StructureKind } from "./structure-kind";
import { isWalkable, type WalkMap } from "./walk-map";

export type { QuarterTurns, StructureKind } from "./structure-kind";

/** A material a structure costs. */
export type BuildMaterial = Extract<BackpackContent, "stick">;

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
  /** Everything building it costs, in the order the build menu shows it. */
  readonly cost: readonly MaterialCost[];
  /** Whether a blueprint of this structure may go at `spot`, a building-grid spot, facing `turns`. */
  canPlace(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): boolean;
}

/** How many sticks a campfire costs. Construction spends one at the start of each stage. */
export const CAMPFIRE_STICK_COST = 5;
/** Two campfires, finished or not, cannot be closer than this, in metres. */
const CAMPFIRE_MIN_SPACING_METRES = 2;

const campfire: StructureDefinition & { readonly kind: "campfire" } = {
  kind: "campfire",
  cost: [{ material: "stick", count: CAMPFIRE_STICK_COST }],
  canPlace({ entities, walkMap }, spot) {
    if (!isWalkable(walkMap, spot)) return false;
    for (const other of [...campfireEntities(entities), ...blueprintEntities(entities)]) {
      if (groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return true;
  },
};

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = { campfire };

/** Every structure the player can build, in the order the build menu lists them. */
export const STRUCTURES: readonly StructureDefinition[] = Object.values(STRUCTURE_BY_KIND);

/** The structure of this kind. */
export function structureOf(kind: StructureKind): StructureDefinition {
  return STRUCTURE_BY_KIND[kind];
}
