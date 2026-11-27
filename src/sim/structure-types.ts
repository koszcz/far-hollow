// What every structure is made of: its costs, its placement rule, and how it finishes.
// Each structure's own file fills in a StructureDefinition. structure-shapes.ts holds the part that never needs a rule to read it.
import type { Refusal } from "./api-refusal";
import type { BackpackContent } from "./backpack";
import type { Entity, EntityStore, Vec3 } from "./entities";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import type { DeliveredMaterial, GroundRect, Placement, StructureKind } from "./structure-kind";
import type { Valley } from "./valley";
import type { WalkMap } from "./walk-map";

/**
 * A material a structure costs. Construction takes a backpack material, such as a stick, out of the backpack.
 * It spends a delivered material, such as a debarked log, from what the player carried to the blueprint.
 * It spends planks from the ones the blueprint keeps. Building takes them from the backpack, as many as the blueprint still needs.
 */
export type BuildMaterial = Extract<BackpackContent, "stick" | "bark" | "cord" | "plank" | "stone"> | DeliveredMaterial;

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

/** The components that mark a finished structure. */
export type FinishedMarker =
  | "campfire"
  | "leanTo"
  | "foundation"
  | "floor"
  | "edgePiece"
  | "door"
  | "shutters"
  | "roofFrame"
  | "cabinRoof"
  | "fireplace"
  | "chimney"
  | "woodpile"
  | "furniture"
  | "workStation"
  | "sled";

export interface StructureDefinition {
  readonly kind: StructureKind;
  /** Everything building it costs, in the order the build menu shows it and construction spends it. */
  readonly cost: readonly MaterialCost[];
  /** The tool the player needs in the backpack to build it, if any. Building does not use it up. */
  readonly tool?: BackpackContent;
  /** How its blueprint follows the mouse. Furniture and the sled go "anywhere": off the building grid, so it can stand on a foundation inside a room. */
  readonly placement: Placement;
  /**
   * Present when R does not turn its blueprint: it takes its facing from the piece it goes on, as a roof section or a door does,
   * or it looks the same every way round, as a floor does. Missing if R turns it.
   */
  readonly fixedFacing?: true;
  /**
   * The component that marks it finished, the one `finish` gives it.
   * Where several kinds share a component that holds a name, such as `edgePiece`, the component holds this kind's name.
   */
  readonly finishedAs: FinishedMarker;
  /** How long the player holds the build action to build it from start to finish, in seconds. */
  readonly buildSeconds: number;
  /** The ground it covers at `spot`, a building-grid spot, facing `turns`. A blueprint covers the same ground. */
  footprint(spot: GroundPoint, turns: QuarterTurns): GroundRect;
  /** Whether a blueprint of this structure may go at `spot`, a building-grid spot, facing `turns`. */
  canPlace(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): boolean;
  /**
   * Why a blueprint may not go at `spot`, facing `turns`, when the reason is not plain to see, such as a door frame or window
   * at a corner (ADR 0008). Without this, or when it gives undefined, the game names no reason.
   */
  placementRefusal?(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): Refusal | undefined;
  /** The components a finished structure gets in place of its blueprint, at `spot` facing `turns`, among `entities`. */
  finish(spot: GroundPoint, turns: QuarterTurns, entities: EntityStore): Entity;
  /**
   * The spot a blueprint placed near `at`, facing `turns`, goes to: a building-grid spot, or `at` itself for a structure placed freely.
   * Without this, it snaps to the nearest grid point.
   */
  snap?(site: PlacementSite, at: GroundPoint, turns: QuarterTurns): GroundPoint;
  /**
   * The turn a blueprint placed at `spot` takes, when the player asked for `turns`. Without this, it takes `turns`.
   * A roof takes the turn of the frame under it.
   */
  facingAt?(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): QuarterTurns;
  /** How high its position sits at a snapped spot, in metres. Without this, it sits on the ground. */
  heightAt?(site: PlacementSite, spot: GroundPoint): number;
  /** Clears the ground for a blueprint just placed at `spot`, if the structure needs it. A foundation also raises the floors it joins, if they must rise. */
  clearSite?(site: PlacementSite, spot: GroundPoint): void;
  /** The spots whose walk-map squares a blueprint at `spot` blocks, for a structure whose blueprint blocks walking. Without this, a blueprint blocks nothing. */
  blueprintBlocksWalkingSpots?(spot: GroundPoint): GroundPoint[];
  /** The components a blueprint placed at `spot` gets besides its blueprint, such as the mark of a swap. Without this, it gets none. */
  blueprintParts?(site: PlacementSite, spot: GroundPoint): Entity;
}

/**
 * The material each stage of construction spends, in order: one stage for each item of the cost.
 * Construction spends a stage's material at the start of that stage.
 */
export function stageMaterials(cost: readonly MaterialCost[]): BuildMaterial[] {
  return cost.flatMap(({ material, count }) => Array.from({ length: count }, () => material));
}

/**
 * The part of a structure's definition that says what it is and where it stands: its kind, placement, finished marker, and ground.
 * The queries over every structure, and the rules that look at other structures, read only this part.
 */
export type StructureShape<Kind extends StructureKind = StructureKind> = Pick<StructureDefinition, "placement" | "fixedFacing" | "finishedAs" | "footprint"> & {
  readonly kind: Kind;
};

/** An entity that is a blueprint or a finished structure, standing somewhere. */
export type PlacedStructure = Entity & { position: Vec3 } & { [Marker in "blueprint" | FinishedMarker]: Required<Pick<Entity, Marker>> }[
    "blueprint" | FinishedMarker];
