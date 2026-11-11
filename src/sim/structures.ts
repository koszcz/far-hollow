// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as a log wall, adds one entry to STRUCTURES with its cost, placement rule, and finished form.
import type { BackpackContent } from "./backpack";
import { BUILD_GRID_METRES, snapToGridPoint, snapToGridSquare } from "./build-grid";
import { edgeMiddle, edgePieceOn, foundationsBeside, isEdgeTaken, meetsDoorAtCorner, squaresBeside } from "./edge-pieces";
import {
  blueprintEntities, campfireEntities, chestEntities, edgePieceEntities, foundationEntities, roofEntities, stumpEntities, treeEntities,
  walkBlockerSpotEntities, woodpileEntities, type Entity, type EntityStore,
} from "./entities";
import { foundationDeckTop, foundationOn, standingHeightAt } from "./foundations";
import { roomAround } from "./rooms";
import { distanceToRiver, groundDistance, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import {
  isInRect, rectsOverlap, turnedRect, turnOffset, type DeliveredMaterial, type EdgePieceKind, type GroundRect, type QuarterTurns, type StructureKind,
} from "./structure-kind";
import { cellIndexAt, isWalkable, type WalkMap } from "./walk-map";

export type { DeliveredMaterial, EdgePieceKind, FurnitureKind, GroundRect, QuarterTurns, StructureKind } from "./structure-kind";

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
  /** The tool the player needs in the backpack to build it, if any. Building does not use it up. */
  readonly tool?: BackpackContent;
  /** Whether it is furniture: placed freely, off the building grid, so it can stand on a foundation inside a room. */
  readonly furniture?: true;
  /** How long the player holds the build action to build it from start to finish, in seconds. */
  readonly buildSeconds: number;
  /** The ground it covers at `spot`, a building-grid spot, facing `turns`. A blueprint covers the same ground. */
  footprint(spot: GroundPoint, turns: QuarterTurns): GroundRect;
  /** Whether a blueprint of this structure may go at `spot`, a building-grid spot, facing `turns`. */
  canPlace(site: PlacementSite, spot: GroundPoint, turns: QuarterTurns): boolean;
  /** The components a finished structure gets in place of its blueprint, at `spot` facing `turns`, among `entities`. */
  finish(spot: GroundPoint, turns: QuarterTurns, entities: EntityStore): Entity;
  /**
   * The spot a blueprint placed near `at`, facing `turns`, goes to: a building-grid spot, or `at` itself for furniture.
   * Without this, it snaps to the nearest grid point.
   */
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
  canPlace({ entities, walkMap }, spot) {
    if (!isWalkable(walkMap, spot)) return false;
    // On a foundation, a campfire goes only inside a room.
    if (foundationUnderCampfire(entities, spot) !== undefined && roomAround(entities, spot) === undefined) return false;
    const plans = blueprintEntities(entities).entities.filter(({ blueprint }) => !isFurniture(blueprint.piece));
    for (const other of [...campfireEntities(entities), ...plans, ...woodpileEntities(entities)]) {
      if (groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return isClearOfFurniture(entities, campfire.footprint(spot, 0));
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
    return true;
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
    // A roof already over the square, finished or planned, is in the way. Furniture under it is not.
    return isClearOfTreesAndPlans(entities, roof.footprint(spot, turns), { furniture: false });
  },
  finish: (spot) => ({ cabinRoof: true, roof: roof.footprint(spot, 0) }),
};

/** How long the player holds the build action to build a woodpile, in seconds. It costs nothing, so it goes up quickly. */
export const WOODPILE_BUILD_SECONDS = 3;
/** A woodpile covers this much ground either side of its centre, in metres: about one log's length across. */
const WOODPILE_HALF_METRES = 0.5;
/** A finished woodpile stops the player walking within this many metres of its centre. */
const WOODPILE_WALK_BLOCK_RADIUS_METRES = 0.6;

/**
 * A woodpile: logs, debarked logs, and firewood stacked on two rails on the ground. It costs nothing.
 * It sits on a grid point, like a campfire on open ground. It is never built on a foundation.
 */
const woodpile: StructureDefinition & { readonly kind: "woodpile" } = {
  kind: "woodpile",
  cost: [],
  buildSeconds: WOODPILE_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, WOODPILE_HALF_METRES, WOODPILE_HALF_METRES, turns),
  canPlace(site, spot, turns) {
    const rect = woodpile.footprint(spot, turns);
    if (!isWalkable(site.walkMap, spot)) return false;
    for (const other of foundationEntities(site.entities)) if (rectsOverlap(rect, foundation.footprint(other.position, 0))) return false;
    for (const fire of campfireEntities(site.entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    return isClearFor(site, rect);
  },
  finish: () => ({ woodpile: { log: 0, debarkedLog: 0, firewood: 0 }, blocksWalking: { radius: WOODPILE_WALK_BLOCK_RADIUS_METRES } }),
};

/** How many debarked logs a chest costs. Construction spends one at the start of each stage. */
export const CHEST_LOG_COST = 2;
/** How long the player holds the build action to build a chest, in seconds. */
export const CHEST_BUILD_SECONDS = 8;
/** A chest is this wide, along its front, in metres. */
export const CHEST_WIDTH_METRES = 0.9;
/** A chest is this deep, from front to back, in metres. */
export const CHEST_DEPTH_METRES = 0.55;
/** A stump this close to a chest, in metres, is in its way. */
const CHEST_STUMP_MARGIN_METRES = 0.3;

/**
 * A chest: the first piece of furniture. It is placed freely, wherever the mouse points, and R turns it.
 * It stands on the ground, or on the deck of a foundation inside a building, but never half on and half off one.
 */
const chest: StructureDefinition & { readonly kind: "chest" } = {
  kind: "chest",
  cost: [{ material: "debarkedLog", count: CHEST_LOG_COST }],
  tool: "axe",
  furniture: true,
  buildSeconds: CHEST_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, CHEST_WIDTH_METRES / 2, CHEST_DEPTH_METRES / 2, turns),
  snap: (_site, at) => ({ x: at.x, z: at.z }),
  heightAt: ({ entities, valley }, spot) => standingHeightAt(entities, valley.terrain, spot),
  canPlace({ entities, walkMap, valley }, spot, turns) {
    const rect = chest.footprint(spot, turns);
    const corners = [rect.min, rect.max, { x: rect.min.x, z: rect.max.z }, { x: rect.max.x, z: rect.min.z }];
    // A chest is smaller than a walk-map cell, so any blocked cell it overlaps holds one of its corners.
    for (const corner of [spot, ...corners]) {
      if (!isWalkable(walkMap, corner)) return false;
      if (distanceToRiver(valley.river, corner) <= valley.river.width / 2) return false;
    }
    // All on one level: every corner on a foundation's deck, or every corner on the ground.
    const onDecks = corners.filter((corner) => foundationOn(entities, snapToGridSquare(corner)) !== undefined).length;
    if (onDecks !== 0 && onDecks !== corners.length) return false;
    const margin = CHEST_STUMP_MARGIN_METRES;
    const nearStumps = turnedRect(spot, CHEST_WIDTH_METRES / 2 + margin, CHEST_DEPTH_METRES / 2 + margin, turns);
    for (const stump of stumpEntities(entities)) if (isInRect(nearStumps, stump.position)) return false;
    // A cabin roof overhead and a foundation underfoot are not in the way. Every other structure is.
    for (const fire of campfireEntities(entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    for (const frame of walkBlockerSpotEntities(entities)) {
      for (const square of frame.blocksWalkingSpots) if (rectsOverlap(rect, gridSquareAround(square))) return false;
    }
    return isClearOfTreesAndPlans(entities, rect, { roofs: false });
  },
  finish: () => ({ chest: { contents: {} } }),
};

/** The building-grid square that holds a spot. */
function gridSquareAround(spot: GroundPoint): GroundRect {
  return turnedRect(snapToGridSquare(spot), BUILD_GRID_METRES / 2, BUILD_GRID_METRES / 2, 0);
}

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = {
  campfire, leanTo, foundation, logWall, doorFrame, roof, woodpile, chest,
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
 * and not over another blueprint or a finished roof.
 */
function isClearFor({ entities, walkMap }: PlacementSite, rect: GroundRect): boolean {
  for (let x = rect.min.x + 0.5; x < rect.max.x; x += 1) {
    for (let z = rect.min.z + 0.5; z < rect.max.z; z += 1) {
      if (!isWalkable(walkMap, { x, z })) return false;
    }
  }
  return isClearOfTreesAndPlans(entities, rect);
}

/**
 * Whether `rect` keeps clear of standing trees, and is not over another blueprint, a finished roof, a finished woodpile,
 * a finished wall or door frame, or a chest.
 * A wall or door frame covers only the line it stands on, so it is in the way only of something that reaches across that line.
 * `furniture: false` lets furniture and furniture blueprints stand under it, as under a roof.
 * `roofs: false` lets it go under a finished cabin roof or a roof blueprint, as furniture does. A lean-to is still in the way.
 */
function isClearOfTreesAndPlans(entities: EntityStore, rect: GroundRect, allow: { furniture?: false; roofs?: false } = {}): boolean {
  const nearTrees = {
    min: { x: rect.min.x - TREE_CLEARANCE_METRES, z: rect.min.z - TREE_CLEARANCE_METRES },
    max: { x: rect.max.x + TREE_CLEARANCE_METRES, z: rect.max.z + TREE_CLEARANCE_METRES },
  };
  for (const tree of treeEntities(entities)) if (isInRect(nearTrees, tree.position)) return false;
  for (const blueprint of blueprintEntities(entities)) {
    const { piece } = blueprint.blueprint;
    if ((allow.furniture === false && isFurniture(piece)) || (allow.roofs === false && piece === "roof")) continue;
    const other = structureOf(piece).footprint(blueprint.position, blueprint.facing?.turns ?? 0);
    if (rectsOverlap(rect, other)) return false;
  }
  for (const roofed of roofEntities(entities)) {
    // A lean-to's roof is part of the lean-to, so it is always in the way. Only a cabin's roof may be over something.
    if (allow.roofs === false && roofed.cabinRoof === true) continue;
    if (rectsOverlap(rect, roofed.roof)) return false;
  }
  for (const pile of woodpileEntities(entities)) {
    if (rectsOverlap(rect, woodpile.footprint(pile.position, pile.facing?.turns ?? 0))) return false;
  }
  if (allow.furniture !== false && !isClearOfFurniture(entities, rect)) return false;
  for (const piece of edgePieceEntities(entities)) {
    if (rectsOverlap(rect, structureOf(piece.edgePiece).footprint(piece.position, piece.facing?.turns ?? 0))) return false;
  }
  return true;
}

/** Whether `rect` keeps clear of every finished chest and every chest blueprint. */
function isClearOfFurniture(entities: EntityStore, rect: GroundRect): boolean {
  for (const placed of chestEntities(entities)) if (rectsOverlap(rect, chest.footprint(placed.position, placed.facing?.turns ?? 0))) return false;
  for (const { blueprint, position, facing } of blueprintEntities(entities)) {
    if (isFurniture(blueprint.piece) && rectsOverlap(rect, structureOf(blueprint.piece).footprint(position, facing?.turns ?? 0))) return false;
  }
  return true;
}

/** Whether a structure is furniture, placed freely rather than on the building grid. */
export function isFurniture(kind: StructureKind): boolean {
  return structureOf(kind).furniture === true;
}

/** Whether a material is carried to a blueprint on the player's shoulder, rather than taken from the backpack. */
export function isDelivered(material: BuildMaterial): material is DeliveredMaterial {
  return material === "debarkedLog";
}
