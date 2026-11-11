// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as a log wall, adds one entry to STRUCTURES with its cost, placement rule, and finished form.
import type { BackpackContent } from "./backpack";
import { BUILD_GRID_METRES, snapToGridPoint, snapToGridSquare } from "./build-grid";
import { edgeMiddle, edgePieceOn, foundationsBeside, isEdgeTaken, meetsDoorAtCorner, squaresBeside } from "./edge-pieces";
import {
  blueprintEntities, cabinRoofEntities, campfireEntities, edgePieceEntities, foundationEntities, lyingThings, roofEntities, stumpEntities, treeEntities,
  type Entity, type EntityStore,
} from "./entities";
import { foundationDeckTop, foundationOn } from "./foundations";
import { roomAround } from "./rooms";
import { distanceToRiver, groundDistance, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import {
  isInRect, rectsOverlap, turnedRect, turnOffset, type DeliveredMaterial, type EdgePieceKind, type GroundRect, type QuarterTurns, type StructureKind,
} from "./structure-kind";
import { cellIndexAt, isWalkable, type WalkMap } from "./walk-map";

export type { DeliveredMaterial, EdgePieceKind, GroundRect, QuarterTurns, StructureKind } from "./structure-kind";

/**
 * A material a structure costs. Construction takes a backpack material, such as a stick, out of the backpack.
 * It spends a delivered material, such as a debarked log, from what the player carried to the blueprint.
 */
export type BuildMaterial = Extract<BackpackContent, "stick" | "bark"> | DeliveredMaterial;

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
  /** Everything building it costs, in the order the build menu shows it and construction spends it. */
  readonly cost: readonly MaterialCost[];
  /** How long the player holds the build action to build it from start to finish, in seconds. */
  readonly buildSeconds: number;
  /** The ground it covers at `spot`, a building-grid spot, facing `turns`. A blueprint covers the same ground. */
  footprint(spot: GroundPoint, turns: QuarterTurns): GroundRect;
  /** Whether a blueprint of this structure may go at `spot`, a building-grid spot, facing `turns`. */
  canPlace(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): boolean;
  /** The components a finished structure gets in place of its blueprint, at `spot` facing `turns`, among `entities`. */
  finish(spot: GroundPoint, turns: QuarterTurns, entities: EntityStore): Entity;
  /** The building-grid spot a blueprint placed near `at`, facing `turns`, snaps to. Without this, it snaps to the nearest grid point. */
  snap?(site: PlacementSite, at: GroundPoint, turns: QuarterTurns): GroundPoint;
  /** How high its position sits at a snapped spot, in metres. Without this, it sits on the ground. */
  heightAt?(site: PlacementSite, spot: GroundPoint): number;
  /** Clears the ground for a blueprint just placed at `spot`, if the structure needs it. */
  clearSite?(entities: EntityStore, spot: GroundPoint): void;
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

/** The finished foundation a campfire at `spot` would stand on: one whose square has `spot` as its middle. */
function foundationUnderCampfire(entities: EntityStore, spot: GroundPoint) {
  const foundation = foundationOn(entities, spot);
  if (foundation === undefined) return undefined;
  return foundation.position.x === spot.x && foundation.position.z === spot.z ? foundation : undefined;
}

/**
 * A campfire. On open ground it sits on a grid point.
 * Inside a room it stands on a foundation, in the middle of the square, so it can warm the whole room.
 */
const campfire: StructureDefinition & { readonly kind: "campfire" } = {
  kind: "campfire",
  cost: [{ material: "stick", count: CAMPFIRE_STICK_COST }],
  buildSeconds: CAMPFIRE_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, CAMPFIRE_WALK_BLOCK_RADIUS_METRES, CAMPFIRE_WALK_BLOCK_RADIUS_METRES, turns),
  snap({ entities }, at) {
    const square = snapToGridSquare(at);
    return foundationOn(entities, square) === undefined ? snapToGridPoint(at) : square;
  },
  heightAt: ({ entities, valley }, spot) => foundationUnderCampfire(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities, walkMap }, spot, turns) {
    if (!isWalkable(walkMap, spot)) return false;
    if (foundationUnderCampfire(entities, spot) === undefined) {
      // On open ground, a campfire keeps clear of every foundation, wall, door frame, and roof section, finished or as a blueprint.
      if (overlapsCabinPiece(entities, campfire.footprint(spot, turns))) return false;
    } else if (roomAround(entities, spot) === undefined) {
      // On a foundation, a campfire goes only inside a room.
      return false;
    }
    for (const other of [...campfireEntities(entities), ...blueprintEntities(entities)]) {
      if (groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return true;
  },
  finish(spot, _turns, entities) {
    const finished: Entity = { campfire: { lit: false, fuelMinutes: 0 }, blocksWalking: { radius: CAMPFIRE_WALK_BLOCK_RADIUS_METRES } };
    if (foundationUnderCampfire(entities, spot) !== undefined) finished.onFoundation = { x: spot.x, z: spot.z };
    return finished;
  },
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

/** How many debarked logs a foundation costs. Construction spends one at the start of each stage. */
export const FOUNDATION_LOG_COST = 4;
/** How long the player holds the build action to build a foundation, in seconds. */
export const FOUNDATION_BUILD_SECONDS = 12;
/** A foundation covers one building-grid square. */
const FOUNDATION_HALF_METRES = 0.5;
/** A stump this close to a foundation's square, in metres, counts as under it. */
const STUMP_MARGIN_METRES = 0.3;

const foundation: StructureDefinition & { readonly kind: "foundation" } = {
  kind: "foundation",
  cost: [{ material: "debarkedLog", count: FOUNDATION_LOG_COST }],
  buildSeconds: FOUNDATION_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ valley }, spot) => foundationDeckTop(valley.terrain, spot),
  canPlace({ entities, walkMap, valley }, spot, turns) {
    const rect = foundation.footprint(spot, turns);
    // Stumps block walking, but a foundation goes over them, so this checks the map's edge and the river instead.
    const corners = [rect.min, rect.max, { x: rect.min.x, z: rect.max.z }, { x: rect.max.x, z: rect.min.z }];
    for (const corner of [spot, ...corners]) {
      if (cellIndexAt(walkMap, corner) === undefined) return false;
      if (distanceToRiver(valley.river, corner) <= valley.river.width / 2) return false;
    }
    if (!isClearOfTreesAndPlans(entities, rect)) return false;
    // Foundations can sit side by side, but not overlap a finished foundation or campfire.
    for (const other of foundationEntities(entities)) if (rectsOverlap(rect, foundation.footprint(other.position, 0))) return false;
    for (const fire of campfireEntities(entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    // Logs, sticks, bark, and bedrolls would end up under the deck. The player moves them first.
    return !hasThingsLyingOn(entities, rect);
  },
  clearSite(entities, spot) {
    // The stump is removed for good, so it never regrows into a tree.
    const under = turnedRect(spot, FOUNDATION_HALF_METRES + STUMP_MARGIN_METRES, FOUNDATION_HALF_METRES + STUMP_MARGIN_METRES, 0);
    for (const stump of [...stumpEntities(entities)]) if (isInRect(under, stump.position)) entities.remove(stump);
  },
  finish: () => ({ foundation: true }),
};

/** How many debarked logs a log wall costs. Construction spends one at the start of each stage. */
export const LOG_WALL_LOG_COST = 4;
/** How long the player holds the build action to build a log wall, in seconds. */
export const LOG_WALL_BUILD_SECONDS = 12;
/** How many debarked logs a door frame costs: fewer than a wall, since the doorway is left open. */
export const DOOR_FRAME_LOG_COST = 3;
/** How long the player holds the build action to build a door frame, in seconds. */
export const DOOR_FRAME_BUILD_SECONDS = 10;

/**
 * A log wall or a door frame. Each stands on one edge of a finished foundation's square, along the line to the square beside it.
 * R picks the edge: facing `turns`, it snaps to the edge that `edgeMiddle` gives for the square under the mouse.
 * Its ground is that line, so it never overlaps the squares on either side, and foundations can sit right beside it.
 */
function edgePiece<Kind extends EdgePieceKind>(kind: Kind, logCost: number, buildSeconds: number): StructureDefinition & { readonly kind: Kind } {
  const footprint = (spot: GroundPoint, turns: QuarterTurns) => turnedRect(spot, BUILD_GRID_METRES / 2, 0, turns);
  return {
    kind,
    cost: [{ material: "debarkedLog", count: logCost }],
    buildSeconds,
    footprint,
    snap: (_site, at, turns) => edgeMiddle(snapToGridSquare(at), turns),
    heightAt({ entities, valley }, spot) {
      // Facing 0 or 1 covers both kinds of edge. Only the one that matches the spot finds foundations.
      const decks = ([0, 1] as const).flatMap((turns) => foundationsBeside(entities, spot, turns)).map(({ position }) => position.y);
      return decks.length > 0 ? Math.max(...decks) : terrainHeightAt(valley.terrain, spot.x, spot.z);
    },
    canPlace({ entities }, spot, turns) {
      if (foundationsBeside(entities, spot, turns).length === 0) return false;
      if (isEdgeTaken(entities, spot)) return false;
      if (meetsDoorAtCorner(entities, kind, spot, turns)) return false;
      if (overlapsOpenGroundCampfire(entities, footprint(spot, turns))) return false;
      return isClearOfTreesAndPlans(entities, footprint(spot, turns));
    },
    finish(spot, turns) {
      const [inside, beyond] = squaresBeside(spot, turns);
      // A door frame leaves the doorway open, so it blocks nothing.
      return kind === "logWall" ? { edgePiece: kind, blocksWalkingEdges: [{ from: inside, to: beyond }] } : { edgePiece: kind };
    },
  };
}

const logWall = edgePiece("logWall", LOG_WALL_LOG_COST, LOG_WALL_BUILD_SECONDS);
const doorFrame = edgePiece("doorFrame", DOOR_FRAME_LOG_COST, DOOR_FRAME_BUILD_SECONDS);

/** How many debarked logs a roof section costs, laid as rafters. Construction spends them first. */
export const ROOF_LOG_COST = 3;
/** How much bark a roof section costs, laid over the rafters. Construction spends it from the backpack after the logs. */
export const ROOF_BARK_COST = 4;
/** How long the player holds the build action to build a roof section, in seconds. */
export const ROOF_BUILD_SECONDS = 15;

/** The four sides of a grid square, as `edgeMiddle` numbers them. */
const SIDES: readonly QuarterTurns[] = [0, 1, 2, 3];

/**
 * A roof section over one foundation square. It rests on the log walls and door frames on the square's edges, so it needs at least one.
 * A finished section is a roof overhead for the whole square, like a lean-to's roof.
 */
const roof: StructureDefinition & { readonly kind: "roof" } = {
  kind: "roof",
  cost: [
    { material: "debarkedLog", count: ROOF_LOG_COST },
    { material: "bark", count: ROOF_BARK_COST },
  ],
  buildSeconds: ROOF_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities }, spot, turns) {
    if (foundationOn(entities, spot) === undefined) return false;
    // The roof rests on the walls: at least one finished log wall or door frame must stand on the square's edges.
    if (!SIDES.some((side) => edgePieceOn(entities, spot, side) !== undefined)) return false;
    // Logs, sticks, bark, and bedrolls on the deck are in the way, as is a roof already over the square, finished or as a blueprint.
    const rect = roof.footprint(spot, turns);
    return !hasThingsLyingOn(entities, rect) && isClearOfTreesAndPlans(entities, rect);
  },
  finish: (spot) => ({ cabinRoof: true, roof: roof.footprint(spot, 0) }),
};

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = {
  campfire, leanTo, foundation, logWall, doorFrame, roof,
};

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
 * and not over another blueprint, a finished roof, or a finished foundation.
 */
function isClearFor({ entities, walkMap }: PlacementSite, rect: GroundRect): boolean {
  for (let x = rect.min.x + 0.5; x < rect.max.x; x += 1) {
    for (let z = rect.min.z + 0.5; z < rect.max.z; z += 1) {
      if (!isWalkable(walkMap, { x, z })) return false;
    }
  }
  // A foundation is walkable, but a lean-to stands on the ground, not on a deck.
  for (const built of foundationEntities(entities)) if (rectsOverlap(rect, foundation.footprint(built.position, 0))) return false;
  return isClearOfTreesAndPlans(entities, rect);
}

/**
 * Whether `rect` overlaps any foundation, log wall, door frame, or roof section, finished or as a blueprint.
 * A wall or door frame covers only the line it stands on, so it overlaps only a rectangle that reaches across that line.
 */
function overlapsCabinPiece(entities: EntityStore, rect: GroundRect): boolean {
  for (const built of foundationEntities(entities)) if (rectsOverlap(rect, foundation.footprint(built.position, 0))) return true;
  for (const piece of edgePieceEntities(entities)) if (rectsOverlap(rect, footprintOfEntity(piece))) return true;
  for (const section of cabinRoofEntities(entities)) if (rectsOverlap(rect, section.roof)) return true;
  for (const blueprint of blueprintEntities(entities)) {
    if (blueprint.blueprint.piece !== "campfire" && blueprint.blueprint.piece !== "leanTo" && rectsOverlap(rect, footprintOfEntity(blueprint))) return true;
  }
  return false;
}

/**
 * Whether a campfire on open ground, finished or as a blueprint, reaches across `rect`.
 * A campfire in the middle of a foundation square, in a room, is left out: it sits clear of the walls round its square.
 */
function overlapsOpenGroundCampfire(entities: EntityStore, rect: GroundRect): boolean {
  const fires = [...campfireEntities(entities), ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.piece === "campfire")];
  return fires.some((fire) => foundationUnderCampfire(entities, fire.position) === undefined && rectsOverlap(rect, campfire.footprint(fire.position, 0)));
}

/** Whether a log, debarked log, stick, piece of bark, or bedroll lies on `rect`, edges included. */
function hasThingsLyingOn(entities: EntityStore, rect: GroundRect): boolean {
  return lyingThings(entities).some(({ position }) => isInRect(rect, position));
}

/**
 * Whether `rect` keeps clear of standing trees, and is not over another blueprint, a finished roof, or a finished wall or door frame.
 * A wall or door frame covers only the line it stands on, so it is in the way only of something that reaches across that line.
 */
function isClearOfTreesAndPlans(entities: EntityStore, rect: GroundRect): boolean {
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
  for (const piece of edgePieceEntities(entities)) {
    if (rectsOverlap(rect, structureOf(piece.edgePiece).footprint(piece.position, piece.facing?.turns ?? 0))) return false;
  }
  return true;
}

/** Whether a material is carried to a blueprint on the player's shoulder, rather than taken from the backpack. */
export function isDelivered(material: BuildMaterial): material is DeliveredMaterial {
  return material === "debarkedLog";
}

/**
 * What kind of structure an entity is: a blueprint of any structure, or a finished campfire, lean-to, foundation,
 * log wall, door frame, or roof section. Undefined for anything else.
 */
export function structureKindOf(entity: Entity): StructureKind | undefined {
  if (entity.blueprint !== undefined) return entity.blueprint.piece;
  if (entity.campfire !== undefined) return "campfire";
  if (entity.leanTo === true) return "leanTo";
  if (entity.foundation === true) return "foundation";
  if (entity.edgePiece !== undefined) return entity.edgePiece;
  if (entity.cabinRoof === true) return "roof";
  return undefined;
}

/** An entity that is a blueprint or a finished structure, standing somewhere. */
export type PlacedStructure = Entity & { position: GroundPoint } & (
  | Required<Pick<Entity, "blueprint">>
  | Required<Pick<Entity, "campfire">>
  | Required<Pick<Entity, "leanTo">>
  | Required<Pick<Entity, "foundation">>
  | Required<Pick<Entity, "edgePiece">>
  | Required<Pick<Entity, "cabinRoof">>
);

/** The ground a blueprint or finished structure covers where it stands, facing the way it faces. */
export function footprintOfEntity(entity: PlacedStructure): GroundRect {
  const kind = structureKindOf(entity);
  if (kind === undefined) throw new Error("Not a structure");
  return structureOf(kind).footprint({ x: entity.position.x, z: entity.position.z }, entity.facing?.turns ?? 0);
}
