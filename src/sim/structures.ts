// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as a log wall, adds one entry to STRUCTURES with its cost, placement rule, and finished form.
// A piece of furniture comes from its definition in furniture.ts instead. freelyPlaced turns it into a structure.
import type { Refusal } from "./api";
import type { BackpackContent } from "./backpack";
import { BUILD_GRID_METRES, isOnGridSquare, snapToGridPoint, snapToGridSquare } from "./build-grid";
import { blocksWalking, edgeMiddle, edgePieceOn, foundationsBeside, isEdgeTaken, meetsOpeningAtCorner, squaresBeside } from "./edge-pieces";
import { hasShutters, nearestBareWindow, windowOn } from "./windows";
import { canSwapForWall, swappableWallOn } from "./wall-swaps";
import { fireplaceOn, hasChimney, nearestBareFireplace } from "./chimneys";
import {
  blueprintEntities,
  cabinRoofEntities,
  campfireEntities,
  edgePieceEntities,
  fireplaceEntities,
  floorEntities,
  furnitureEntities,
  leanToEntities,
  foundationEntities,
  lyingThings,
  roofEntities,
  roofFrameEntities,
  growingTreeEntities,
  stumpEntities,
  treeEntities,
  walkBlockerSpotEntities,
  woodpileEntities,
  workStationEntities,
  type Entity,
  type EntityStore,
  type Vec3,
} from "./entities";
import { doorFrameOn, hasDoor, nearestDoorFrame } from "./doors";
import { floorJoin, foundationDeckTop, foundationOn, raiseFloors, standingHeightAt, type FloorJoin } from "./foundations";
import { floorOn } from "./floors";
import { unlitFire } from "./fire";
import { FURNITURE, type FurnitureDefinition } from "./furniture";
import { roomAround } from "./rooms";
import { isYoungTree } from "./tree-growth";
import { isRiverWater, terrainHeightAt, type Valley } from "./valley";
import { addGroundPoints, groundDistance, type GroundPoint } from "./ground-point";
import {
  isInRect,
  widenRect,
  rectsOverlap,
  SIDES,
  turnedRect,
  type DeliveredMaterial,
  FURNITURE_KINDS,
  type EdgePieceKind,
  type FurnitureKind,
  type GroundRect,
  type KeptMaterial,
  type Placement,
  type StructureKind,
  TAKEN_MATERIALS,
  type TakenMaterial,
} from "./structure-kind";
import { turnOffset, turnQuarters, type QuarterTurns } from "./quarter-turns";
import { cellIndexAt, isWalkable, type WalkMap } from "./walk-map";

export type {
  DeliveredMaterial,
  EdgePieceKind,
  FurnitureKind,
  GroundRect,
  KeptMaterial,
  Placement,
  StructureKind,
  TakenMaterial,
  WorkStationKind,
} from "./structure-kind";

/**
 * A material a structure costs. Construction takes a backpack material, such as a stick, out of the backpack.
 * It spends a delivered material, such as a debarked log, from what the player carried to the blueprint.
 * It spends planks from the ones the blueprint keeps. Building takes them from the backpack, as many as the blueprint still needs.
 */
export type BuildMaterial = Extract<BackpackContent, "stick" | "bark" | "plank" | "stone"> | DeliveredMaterial;

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
  placement: "onGround",
  finishedAs: "campfire",
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
    // A fireplace's square holds no campfire.
    if (fireplaceEntities(entities).entities.some((fireplace) => isOnGridSquare(fireplace.position, spot))) return false;
    const plans = blueprintEntities(entities).entities.filter(({ blueprint }) => !isPlacedFreely(blueprint.structure) && !liesUnderfoot(blueprint.structure));
    for (const other of [...campfireEntities(entities), ...plans, ...woodpileEntities(entities), ...workStationEntities(entities)]) {
      if (groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return isClearOfFreelyPlaced(entities, campfire.footprint(spot, 0));
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
  { x: -1.5, z: -0.5 },
  { x: -0.5, z: -0.5 },
  { x: 0.5, z: -0.5 },
  { x: 1.5, z: -0.5 },
  { x: -1.5, z: 0.5 },
  { x: 1.5, z: 0.5 },
];

/**
 * Where a bedroll laid in a lean-to lies: across the middle of its open front, along its width, under the roof.
 * That strip is the part of the lean-to the player can walk on. `spot` and `turns` are the lean-to's middle and facing.
 * Returns the bedroll's middle and which way it faces. A bedroll facing the default way lies along z, so it turns a quarter more.
 */
export function leanToBedrollSpot(spot: GroundPoint, turns: QuarterTurns): { spot: GroundPoint; turns: QuarterTurns } {
  const offset = turnOffset({ x: 0, z: LEAN_TO_DEPTH_METRES / 4 }, turns);
  return { spot: addGroundPoints(spot, offset), turns: turnQuarters(turns, 1) };
}

const leanTo: StructureDefinition & { readonly kind: "leanTo" } = {
  kind: "leanTo",
  placement: "onGround",
  finishedAs: "leanTo",
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
    blocksWalkingSpots: LEAN_TO_BLOCKED_SQUARES.map((offset) => addGroundPoints(spot, turnOffset(offset, turns))),
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
  placement: "onGround",
  finishedAs: "foundation",
  cost: [{ material: "debarkedLog", count: FOUNDATION_LOG_COST }],
  buildSeconds: FOUNDATION_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: (site, spot) => foundationJoin(site, spot)?.deckTop ?? foundationDeckTop(site.valley.terrain, spot),
  canPlace({ entities, walkMap, valley }, spot, turns) {
    const rect = foundation.footprint(spot, turns);
    // Stumps block walking, but a foundation goes over them, so this checks the map's edge and the river instead.
    const corners = [rect.min, rect.max, { x: rect.min.x, z: rect.max.z }, { x: rect.max.x, z: rect.min.z }];
    for (const corner of [spot, ...corners]) {
      if (cellIndexAt(walkMap, corner) === undefined) return false;
      if (isRiverWater(valley.river, corner)) return false;
    }
    if (!isClearOfTreesAndStructures(entities, rect)) return false;
    // Foundations side by side make one flat floor, so the floors beside it must be able to rise to its deck, if they need to.
    if (foundationJoin({ entities, walkMap, valley }, spot) === undefined) return false;
    // Foundations can sit side by side, but not overlap a finished foundation or campfire.
    for (const other of foundationEntities(entities)) if (rectsOverlap(rect, foundation.footprint(other.position, 0))) return false;
    for (const fire of campfireEntities(entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    // Logs, sticks, bark, and bedrolls would end up under the deck. The player moves them first.
    return !hasThingsLyingOn(entities, rect);
  },
  clearSite(site, spot) {
    const { entities } = site;
    // The stump is removed for good, so it never regrows into a tree.
    const under = turnedRect(spot, FOUNDATION_HALF_METRES + STUMP_MARGIN_METRES, FOUNDATION_HALF_METRES + STUMP_MARGIN_METRES, 0);
    for (const stump of [...stumpEntities(entities)]) if (isInRect(under, stump.position)) entities.remove(stump);
    const join = foundationJoin(site, spot);
    if (join !== undefined) raiseFloors(entities, join);
  },
  finish: () => ({ foundation: true }),
};

/** How a new foundation at `spot` joins the floors beside it. A floor rises only where nothing but a floor of planks stands on it. */
function foundationJoin({ entities, valley }: PlacementSite, spot: GroundPoint): FloorJoin | undefined {
  return floorJoin(entities, valley.terrain, spot, (square) => !standsOnFoundation(entities, square, { ignoreFloors: true }));
}

/**
 * Whether anything stands on the foundation square with this middle, finished or as a blueprint:
 * a log wall or door frame on one of its edges, a campfire, fireplace, or floor whose centre is on it, or a roof frame, roof section, lean-to, piece of furniture, or sled
 * over any of it. A structure placed freely, such as a piece of furniture, stands on every foundation its base reaches over.
 * `ignoreFloors` leaves out a floor of planks, finished or as a blueprint.
 */
export function standsOnFoundation(entities: EntityStore, square: GroundPoint, { ignoreFloors = false }: { ignoreFloors?: boolean } = {}): boolean {
  if (SIDES.some((side) => isEdgeTaken(entities, edgeMiddle(square, side)))) return true;
  const rect = foundation.footprint(square, 0);
  const others = [
    ...campfireEntities(entities),
    ...fireplaceEntities(entities),
    ...floorEntities(entities),
    ...leanToEntities(entities),
    ...roofFrameEntities(entities),
    ...cabinRoofEntities(entities),
    ...furnitureEntities(entities),
    ...blueprintEntities(entities),
  ];
  return others.some((other) => {
    const kind = structureKindOf(other);
    if (kind === undefined || (ignoreFloors && kind === "floor")) return false;
    if (kind === "campfire" || kind === "fireplace" || liesUnderfoot(kind)) return isOnGridSquare(square, other.position);
    return (kind === "leanTo" || kind === "roofFrame" || kind === "roof" || isPlacedFreely(kind)) && rectsOverlap(rect, footprintOfEntity(other));
  });
}

/** How many planks a floor costs. Construction spends one at the start of each stage. */
export const FLOOR_PLANK_COST = 2;
/** How long the player holds the build action to build a floor, in seconds. */
export const FLOOR_BUILD_SECONDS = 4;

/**
 * A floor: planks laid flush across the deck of one finished foundation square. It changes only how the square looks.
 * It lies underfoot, so nothing on the square is in its way, and it is in the way of nothing. A square holds one floor.
 */
const floor: StructureDefinition & { readonly kind: "floor" } = {
  kind: "floor",
  placement: "underfoot",
  fixedFacing: true,
  finishedAs: "floor",
  cost: [{ material: "plank", count: FLOOR_PLANK_COST }],
  buildSeconds: FLOOR_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => foundationOn(entities, spot) !== undefined && floorOn(entities, spot) === undefined,
  finish: () => ({ floor: true }),
};

/** Whether a structure lies flush on a foundation's deck, so it is never in the way of another structure. Only a floor does. */
export function liesUnderfoot(kind: StructureKind): boolean {
  return structureOf(kind).placement === "underfoot";
}

/** How many debarked logs a log wall costs. Construction spends one at the start of each stage. */
export const LOG_WALL_LOG_COST = 4;
/** How long the player holds the build action to build a log wall, in seconds. */
export const LOG_WALL_BUILD_SECONDS = 12;
/** How many debarked logs a door frame costs: fewer than a wall, since the doorway is left open. */
export const DOOR_FRAME_LOG_COST = 3;
/** How long the player holds the build action to build a door frame, in seconds. */
export const DOOR_FRAME_BUILD_SECONDS = 10;
/** How many debarked logs a window costs: fewer than a wall, since the opening is left open, like a door frame. */
export const WINDOW_LOG_COST = 3;
/** How long the player holds the build action to build a window, in seconds. */
export const WINDOW_BUILD_SECONDS = 10;

/**
 * A log wall, door frame, or window. Each stands on one edge of a finished foundation's square, along the line to the square beside it.
 * R picks the edge: facing `turns`, it snaps to the edge that `edgeMiddle` gives for the square under the mouse.
 * Its ground is that line, so it never overlaps the squares on either side, and foundations can sit right beside it.
 * A log wall and a window block walking across their edge. A door frame leaves the doorway open.
 * A window or door frame may also go on a finished log wall, as a swap (see wall-swaps.ts). Its other placement rules still apply.
 */
function edgePiece<Kind extends EdgePieceKind>(kind: Kind, logCost: number, buildSeconds: number): StructureDefinition & { readonly kind: Kind } {
  const footprint = (spot: GroundPoint, turns: QuarterTurns) => turnedRect(spot, BUILD_GRID_METRES / 2, 0, turns);
  /** Whether a blueprint at `spot` would be a swap: this piece on a finished log wall that has no swap on it yet. */
  const isSwap = (entities: EntityStore, spot: GroundPoint) => canSwapForWall(kind) && swappableWallOn(entities, spot) !== undefined;
  /** Whether the edge holds a piece or blueprint this one may not go on. A log wall it would swap does not count. */
  const isTaken = (entities: EntityStore, spot: GroundPoint) => isEdgeTaken(entities, spot) && !isSwap(entities, spot);
  return {
    kind,
    cost: [{ material: "debarkedLog", count: logCost }],
    placement: "onEdge",
    finishedAs: "edgePiece",
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
      if (isTaken(entities, spot)) return false;
      if (meetsOpeningAtCorner(entities, kind, spot, turns)) return false;
      if (overlapsOpenGroundCampfire(entities, footprint(spot, turns))) return false;
      return isClearOfTreesAndStructures(entities, footprint(spot, turns));
    },
    placementRefusal({ entities }, spot, turns) {
      // Only an edge the piece could otherwise take says why, so a taken edge or open ground does not blame the corner.
      if (foundationsBeside(entities, spot, turns).length === 0 || isTaken(entities, spot)) return undefined;
      return meetsOpeningAtCorner(entities, kind, spot, turns) ? { kind: "atCorner" } : undefined;
    },
    blueprintParts: ({ entities }, spot) => (isSwap(entities, spot) ? { swapsWall: true } : {}),
    finish(spot, turns) {
      const [inside, beyond] = squaresBeside(spot, turns);
      // A door frame leaves the doorway open, so it blocks nothing.
      return blocksWalking(kind) ? { edgePiece: kind, blocksWalkingEdges: [{ from: inside, to: beyond }] } : { edgePiece: kind };
    },
  };
}

const logWall = edgePiece("logWall", LOG_WALL_LOG_COST, LOG_WALL_BUILD_SECONDS);
const doorFrame = edgePiece("doorFrame", DOOR_FRAME_LOG_COST, DOOR_FRAME_BUILD_SECONDS);
const windowPiece = edgePiece("window", WINDOW_LOG_COST, WINDOW_BUILD_SECONDS);

/** How many debarked logs a roof frame costs: two beam logs, each cut in two, then three rafters. Construction spends one at the start of each stage. */
export const ROOF_FRAME_LOG_COST = 5;
/** How long the player holds the build action to build a roof frame, in seconds. */
export const ROOF_FRAME_BUILD_SECONDS = 12;

/** The finished roof frame over the foundation square with this middle, or undefined if it has none. */
export function roofFrameOn(entities: EntityStore, square: GroundPoint): (Entity & { position: NonNullable<Entity["position"]> }) | undefined {
  for (const frame of roofFrameEntities(entities)) if (isOnGridSquare(square, frame.position)) return frame;
  return undefined;
}

/** The middles of the four grid squares that share an edge with the square with this middle. */
function squaresAround(square: GroundPoint): GroundPoint[] {
  return SIDES.map((side) => squaresBeside(edgeMiddle(square, side), side)[1]);
}

/** Whether a finished log wall, door frame, or window stands on any edge of the square with this middle. */
function hasWallOnEdges(entities: EntityStore, square: GroundPoint): boolean {
  return SIDES.some((side) => edgePieceOn(entities, square, side) !== undefined);
}

/**
 * Whether a roof frame over this square has something to rest on: a finished wall, door frame, or window on its edges,
 * or a finished roof frame on a square beside it. The middle square of a cabin 3 squares wide has no walls, so it rests on its neighbours' frames.
 */
function canCarryRoofFrame(entities: EntityStore, square: GroundPoint): boolean {
  return hasWallOnEdges(entities, square) || squaresAround(square).some((beside) => roofFrameOn(entities, beside) !== undefined);
}

/**
 * Whether every roof frame, finished or as a blueprint, would still rest on walls with the finished frame over `without` taken away.
 * A frame rests on walls itself, or through a run of finished frames beside each other that reaches one that does.
 */
export function roofFramesStayCarried(entities: EntityStore, without: GroundPoint): boolean {
  const finished = roofFrameEntities(entities).entities.filter((frame) => !isOnGridSquare(without, frame.position));
  const carried = finished.filter((frame) => hasWallOnEdges(entities, frame.position));
  const isCarriedBeside = (square: GroundPoint) => squaresAround(square).some((beside) => carried.some((frame) => isOnGridSquare(beside, frame.position)));
  for (let grew = true; grew;) {
    grew = false;
    for (const frame of finished) {
      if (carried.includes(frame) || !isCarriedBeside(frame.position)) continue;
      carried.push(frame);
      grew = true;
    }
  }
  if (carried.length < finished.length) return false;
  const frameBlueprints = blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === "roofFrame");
  return frameBlueprints.every(({ position }) => hasWallOnEdges(entities, position) || isCarriedBeside(position));
}

/**
 * A roof frame over one foundation square: level beams on the tops of the walls, and sloped rafters on the beams.
 * It rests on the log walls and door frames on the square's edges, or on a finished frame beside it, so it needs one of them.
 * R turns it: facing `turns`, it slopes down the way `turnOffset` turns +z. The frame keeps its turn in `facing`.
 * The game rules store only that turn. The renderer works out each frame's height and corner shape from its neighbours.
 * It is no roof overhead. A roof section laid on it is.
 */
const roofFrame: StructureDefinition & { readonly kind: "roofFrame" } = {
  kind: "roofFrame",
  placement: "overWalls",
  finishedAs: "roofFrame",
  cost: [{ material: "debarkedLog", count: ROOF_FRAME_LOG_COST }],
  buildSeconds: ROOF_FRAME_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities }, spot, turns) {
    if (foundationOn(entities, spot) === undefined) return false;
    // The frame rests on the walls, or on a finished frame beside it where the square has no walls, as in the middle of a cabin.
    if (!canCarryRoofFrame(entities, spot)) return false;
    // Logs, sticks, bark, and bedrolls on the deck are in the way, as is a frame or roof already over the square, finished or as a blueprint.
    // Furniture and sleds under it are not.
    const rect = roofFrame.footprint(spot, turns);
    return !hasThingsLyingOn(entities, rect) && isClearOfTreesAndStructures(entities, rect, { ignoreFreelyPlaced: true, ignoreFireplaces: true });
  },
  finish: () => ({ roofFrame: true }),
};

/** How many planks a roof section costs, laid on its frame in one row each. Construction spends them from the backpack. */
export const ROOF_PLANK_COST = 6;
/** How long the player holds the build action to build a roof section, in seconds: 2 seconds a row. */
export const ROOF_BUILD_SECONDS = 12;

/**
 * A roof section: rows of planks laid on the finished roof frame of one foundation square, so it needs one.
 * A finished section is a roof overhead for the whole square, like a lean-to's roof.
 * It has no turn of its own: it takes the turn of the frame under it, and slopes the way the frame does.
 */
const roof: StructureDefinition & { readonly kind: "roof" } = {
  kind: "roof",
  placement: "onFrame",
  fixedFacing: true,
  finishedAs: "cabinRoof",
  cost: [{ material: "plank", count: ROOF_PLANK_COST }],
  buildSeconds: ROOF_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  facingAt: ({ entities }, spot, turns) => roofFrameOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities }, spot, turns) {
    if (roofFrameOn(entities, spot) === undefined) return false;
    // A roof already over the square, finished or as a blueprint, is in the way. The frame under it, a fireplace, a chimney, furniture, and sleds are not.
    return isClearOfTreesAndStructures(entities, roof.footprint(spot, turns), { ignoreFreelyPlaced: true, ignoreRoofFrames: true, ignoreFireplaces: true });
  },
  finish: (spot, turns) => ({ cabinRoof: true, roof: roof.footprint(spot, turns) }),
};

/** How many planks a door costs. Construction spends one at the start of each stage. */
export const DOOR_PLANK_COST = 3;
/** How long the player holds the build action to build a door, in seconds. */
export const DOOR_BUILD_SECONDS = 6;
/** A door blueprint snaps to the finished door frame whose middle is within this many metres of the mouse. */
const DOOR_SNAP_METRES = 1;

/**
 * A door: planks hung in a finished door frame. It takes the frame's edge and facing, so R does not turn it.
 * It is not an edge piece. The frame keeps holding the edge, and a frame with a door, or a door blueprint, cannot come down.
 * A door never blocks walking, open or shut. Its ground is the frame's line, like the frame's own.
 */
const door: StructureDefinition & { readonly kind: "door" } = {
  kind: "door",
  placement: "inDoorFrame",
  fixedFacing: true,
  finishedAs: "door",
  cost: [{ material: "plank", count: DOOR_PLANK_COST }],
  buildSeconds: DOOR_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, BUILD_GRID_METRES / 2, 0, turns),
  snap({ entities }, at, turns) {
    const frame = nearestDoorFrame(entities, at, DOOR_SNAP_METRES);
    return frame === undefined ? edgeMiddle(snapToGridSquare(at), turns) : { x: frame.position.x, z: frame.position.z };
  },
  facingAt: ({ entities }, spot, turns) => doorFrameOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => doorFrameOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => doorFrameOn(entities, spot) !== undefined && !hasDoor(entities, spot),
  finish: () => ({ door: true }),
};

/** How many planks shutters cost. Construction spends one at the start of each stage. */
export const SHUTTERS_PLANK_COST = 2;
/** How long the player holds the build action to build shutters, in seconds. */
export const SHUTTERS_BUILD_SECONDS = 4;
/** A shutters blueprint snaps to the finished window with no shutters whose middle is within this many metres of the mouse. */
const SHUTTERS_SNAP_METRES = 1;

/**
 * Shutters: two plank shutters hung in a finished window. They take the window's edge and facing, so R does not turn them.
 * They are not an edge piece. The window keeps holding the edge, and a window with shutters, or a shutters blueprint, cannot come down.
 * Finished shutters start closed. They never block walking, open or closed. Their ground is the window's line, like the window's own.
 */
const shutters: StructureDefinition & { readonly kind: "shutters" } = {
  kind: "shutters",
  placement: "inWindow",
  fixedFacing: true,
  finishedAs: "shutters",
  cost: [{ material: "plank", count: SHUTTERS_PLANK_COST }],
  buildSeconds: SHUTTERS_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, BUILD_GRID_METRES / 2, 0, turns),
  snap({ entities }, at, turns) {
    const bare = nearestBareWindow(entities, at, SHUTTERS_SNAP_METRES);
    return bare === undefined ? edgeMiddle(snapToGridSquare(at), turns) : { x: bare.position.x, z: bare.position.z };
  },
  facingAt: ({ entities }, spot, turns) => windowOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => windowOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => windowOn(entities, spot) !== undefined && !hasShutters(entities, spot),
  finish: () => ({ shutters: { open: false } }),
};

/** How many stones a fireplace costs. Construction spends one at the start of each stage. */
export const FIREPLACE_STONE_COST = 12;
/** How long the player holds the build action to build a fireplace, in seconds. */
export const FIREPLACE_BUILD_SECONDS = 24;

/**
 * A fireplace: a low stone fire box with a short chimney, on one finished foundation square. R turns it to face any side of the square.
 * It needs no room around it, so the player can build it before the walls and roof.
 * The square must hold no campfire and no furniture. A fireplace and its blueprint block walking on the square.
 */
const fireplace: StructureDefinition & { readonly kind: "fireplace" } = {
  kind: "fireplace",
  placement: "onFoundation",
  finishedAs: "fireplace",
  cost: [{ material: "stone", count: FIREPLACE_STONE_COST }],
  buildSeconds: FIREPLACE_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities }, spot, turns) {
    if (foundationUnderCampfire(entities, spot) === undefined) return false;
    const rect = fireplace.footprint(spot, turns);
    // A campfire on the square, finished or as a blueprint, is in the way.
    const fires = [...campfireEntities(entities), ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === "campfire")];
    if (fires.some((fire) => isOnGridSquare(spot, fire.position))) return false;
    // Things lying on the deck would end up under it. The player moves them first.
    // Walls on the square's edges and a roof frame or roof over it are not in the way. Furniture and any other structure are.
    return !hasThingsLyingOn(entities, rect) && isClearOfTreesAndStructures(entities, rect, { ignoreCabinRoofs: true });
  },
  finish: (spot) => ({ fireplace: unlitFire(), blocksWalkingSpots: [{ x: spot.x, z: spot.z }] }),
  blueprintBlocksWalkingSpots: (spot) => [{ x: spot.x, z: spot.z }],
};

/** How many stones a chimney costs. Construction spends one at the start of each stage. */
export const CHIMNEY_STONE_COST = 8;
/** How long the player holds the build action to build a chimney, in seconds. */
export const CHIMNEY_BUILD_SECONDS = 16;
/** A chimney blueprint snaps to the finished fireplace with no chimney whose middle is within this many metres of the mouse. */
const CHIMNEY_SNAP_METRES = 1;

/**
 * A chimney: stone built up from the cap stone of a finished fireplace, through any roof over it. It takes the fireplace's
 * square and facing, so R does not turn it. A fireplace holds one chimney. A chimney is only for looks, and the fireplace
 * already blocks walking on the square, so a chimney blocks nothing more. A roof frame and roof section can go over it.
 */
const chimney: StructureDefinition & { readonly kind: "chimney" } = {
  kind: "chimney",
  placement: "onFireplace",
  fixedFacing: true,
  finishedAs: "chimney",
  cost: [{ material: "stone", count: CHIMNEY_STONE_COST }],
  buildSeconds: CHIMNEY_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns),
  snap({ entities }, at) {
    const bare = nearestBareFireplace(entities, at, CHIMNEY_SNAP_METRES);
    return bare === undefined ? snapToGridSquare(at) : { x: bare.position.x, z: bare.position.z };
  },
  facingAt: ({ entities }, spot, turns) => fireplaceOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => fireplaceOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => fireplaceOn(entities, spot) !== undefined && !hasChimney(entities, spot),
  placementRefusal({ entities }, spot) {
    if (fireplaceOn(entities, spot) === undefined) return { kind: "chimneyNeedsFireplace" };
    return hasChimney(entities, spot) ? { kind: "fireplaceHasChimney" } : undefined;
  },
  finish: () => ({ chimney: true }),
};

/** Whether a structure is a fireplace or a chimney, which a roof frame and a roof section may go over. */
function isFireplaceOrChimney(kind: StructureKind): boolean {
  return kind === "fireplace" || kind === "chimney";
}

/** How long the player holds the build action to build a woodpile, in seconds. It costs nothing, so it goes up quickly. */
export const WOODPILE_BUILD_SECONDS = 3;
/** A woodpile covers this much ground either side of its centre, in metres: about one log's length across. */
const WOODPILE_HALF_METRES = 0.5;
/**
 * A finished woodpile stops the player walking within this many metres of its centre.
 * It sits on a grid point, where four 1 m walk-map cells meet, so this reaches the centres of all four.
 */
export const WOODPILE_WALK_BLOCK_RADIUS_METRES = 0.75;

/**
 * A woodpile: logs, debarked logs, and firewood stacked on two rails on the ground. It costs nothing.
 * It sits on a grid point, like a campfire on open ground. It is never built on a foundation.
 */
const woodpile: StructureDefinition & { readonly kind: "woodpile" } = {
  kind: "woodpile",
  placement: "onGround",
  finishedAs: "woodpile",
  cost: [],
  buildSeconds: WOODPILE_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, WOODPILE_HALF_METRES, WOODPILE_HALF_METRES, turns),
  canPlace(site, spot, turns) {
    const rect = woodpile.footprint(spot, turns);
    if (!isWalkable(site.walkMap, spot)) return false;
    for (const fire of campfireEntities(site.entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    return isClearFor(site, rect);
  },
  finish: () => ({ woodpile: { log: 0, debarkedLog: 0, firewood: 0 }, blocksWalking: { radius: WOODPILE_WALK_BLOCK_RADIUS_METRES } }),
};

/**
 * A small gap, in metres. Some checks on a structure placed freely look this far inside its edges.
 * Then an edge that lies on the line between two squares does not count as over the square beyond.
 */
const EDGE_INSET_METRES = 0.01;

/**
 * Turns a piece of furniture into a structure for the build menu. Every piece is placed freely, wherever the mouse points,
 * and R turns it. It stands on the ground or on a foundation's deck, never half on and half off one.
 */
export function freelyPlaced<Kind extends FurnitureKind>(piece: FurnitureDefinition<Kind>): StructureDefinition & { readonly kind: Kind } {
  const halfX = piece.size.x / 2;
  const halfZ = piece.size.z / 2;
  const { blocks, storage } = piece;
  return {
    kind: piece.kind,
    placement: "anywhere",
    finishedAs: "furniture",
    cost: piece.cost,
    ...(piece.tool === undefined ? {} : { tool: piece.tool }),
    buildSeconds: piece.buildSeconds,
    footprint: (spot, turns) => turnedRect(spot, halfX, halfZ, turns),
    snap: (_site, at) => ({ x: at.x, z: at.z }),
    heightAt: ({ entities, valley }, spot) => standingHeightAt(entities, valley.terrain, spot),
    canPlace: (site, spot, turns) => canPlaceFreely(site, spot, turns, halfX, halfZ),
    finish: (spot, turns) => ({
      furniture: piece.kind,
      ...(storage === undefined ? {} : { storage: { contents: {} } }),
      ...piece.finishedParts?.(),
      // A piece that blocks the cells under it blocks every walk-map cell it reaches over. The spots are at most half a cell
      // apart, so each of those cells holds one. They stay a little inside its edges, so a cell that only touches an edge stays open.
      ...(blocks === "cellsUnder"
        ? { blocksWalkingSpots: spotsAcross(turnedRect(spot, halfX - EDGE_INSET_METRES, halfZ - EDGE_INSET_METRES, turns)) }
        : { blocksWalking: { radius: blocks.radius } }),
    }),
  };
}

/** Each piece of furniture as a structure, by its kind. */
const FURNITURE_STRUCTURES = Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, freelyPlaced(FURNITURE[kind])])) as {
  readonly [Kind in FurnitureKind]: StructureDefinition & { readonly kind: Kind };
};

/** How many debarked logs a sawhorse costs: one for its legs and one for the beam across them. */
export const SAWHORSE_LOG_COST = 2;
/** How long the player holds the build action to build a sawhorse, in seconds. */
export const SAWHORSE_BUILD_SECONDS = 8;
/** A sawhorse is this long, along its beam, in metres. */
export const SAWHORSE_LENGTH_METRES = 1.2;
/** A sawhorse's legs spread this far apart at the foot, across its beam, in metres. */
export const SAWHORSE_WIDTH_METRES = 0.6;
/**
 * A finished sawhorse stops the player walking within this many metres of its centre.
 * It sits on a grid point, where four 1 m walk-map cells meet, so this reaches the centres of all four.
 */
export const SAWHORSE_WALK_BLOCK_RADIUS_METRES = 0.75;

/**
 * A sawhorse: the first work station. A beam of debarked log rests on two pairs of crossed legs.
 * It sits on a grid point on the ground, like a woodpile, and R turns it. It is not a building piece, so it needs no foundation.
 */
const sawhorse: StructureDefinition & { readonly kind: "sawhorse" } = {
  kind: "sawhorse",
  placement: "onGround",
  finishedAs: "workStation",
  cost: [{ material: "debarkedLog", count: SAWHORSE_LOG_COST }],
  buildSeconds: SAWHORSE_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, SAWHORSE_LENGTH_METRES / 2, SAWHORSE_WIDTH_METRES / 2, turns),
  canPlace(site, spot, turns) {
    const rect = sawhorse.footprint(spot, turns);
    // The sawhorse reaches into each of the four walk-map cells that meet at its grid point, and each corner lies in one of them.
    const corners = [rect.min, rect.max, { x: rect.min.x, z: rect.max.z }, { x: rect.max.x, z: rect.min.z }];
    for (const corner of [spot, ...corners]) if (!isWalkable(site.walkMap, corner)) return false;
    for (const fire of campfireEntities(site.entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    return isClearFor(site, rect);
  },
  finish: () => ({ workStation: "sawhorse", blocksWalking: { radius: SAWHORSE_WALK_BLOCK_RADIUS_METRES } }),
};

/** How many logs a sled costs: one for each runner. Construction spends one at the start of each stage. */
export const SLED_LOG_COST = 2;
/** How many sticks a sled costs: the cross pieces laid over the runners. */
export const SLED_STICK_COST = 4;
/** How long the player holds the build action to build a sled, in seconds. */
export const SLED_BUILD_SECONDS = 10;
/** A sled is this long, along its runners, in metres. */
export const SLED_LENGTH_METRES = 1.8;
/** A sled is this wide, across its runners, in metres. */
export const SLED_WIDTH_METRES = 0.8;

/**
 * A sled: two log runners with sticks laid across them, for dragging logs. It is placed freely, wherever the mouse points,
 * and R turns it. Its runners run along x when it faces the default way.
 * It blocks no walking, since the player will drag it about. It starts empty.
 */
const sled: StructureDefinition & { readonly kind: "sled" } = {
  kind: "sled",
  placement: "anywhere",
  finishedAs: "sled",
  cost: [
    { material: "log", count: SLED_LOG_COST },
    { material: "stick", count: SLED_STICK_COST },
  ],
  tool: "axe",
  buildSeconds: SLED_BUILD_SECONDS,
  footprint: (spot, turns) => turnedRect(spot, SLED_LENGTH_METRES / 2, SLED_WIDTH_METRES / 2, turns),
  snap: (_site, at) => ({ x: at.x, z: at.z }),
  heightAt: ({ entities, valley }, spot) => standingHeightAt(entities, valley.terrain, spot),
  canPlace: (site, spot, turns) => canPlaceFreely(site, spot, turns, SLED_LENGTH_METRES / 2, SLED_WIDTH_METRES / 2),
  finish: () => ({ sled: { log: 0, debarkedLog: 0, plank: 0 } }),
};

/** A stump this close to a structure placed anywhere, such as a piece of furniture or a sled, in metres, is in its way. */
const FREE_STUMP_MARGIN_METRES = 0.3;
/** A structure placed anywhere is checked for blocked ground at spots across it no further apart than this, in metres. */
const FREE_CHECK_SPACING_METRES = 0.5;

/**
 * The placement rule for a structure placed anywhere, off the building grid, such as a piece of furniture or a sled.
 * It covers `halfX` by `halfZ` metres either side of `spot`, turned by `turns`.
 * It stands on ground the player can walk on, or on the decks of foundations, but never half on and half off a deck.
 * It keeps clear of stumps, the river, lean-to frames, and every other structure. A cabin roof overhead is not in the way.
 */
function canPlaceFreely({ entities, walkMap, valley }: PlacementSite, spot: GroundPoint, turns: QuarterTurns, halfX: number, halfZ: number): boolean {
  const rect = turnedRect(spot, halfX, halfZ, turns);
  // The ground and decks are checked just inside its edges, so an edge lying on the line between two squares does not count as over the square beyond.
  const inside = turnedRect(spot, halfX - EDGE_INSET_METRES, halfZ - EDGE_INSET_METRES, turns);
  const corners = [inside.min, inside.max, { x: inside.min.x, z: inside.max.z }, { x: inside.max.x, z: inside.min.z }];
  // The spots are no further apart than half a walk-map cell, so every blocked cell it overlaps holds one of them.
  for (const point of [spot, ...spotsAcross(inside)]) {
    if (!isWalkable(walkMap, point)) return false;
    if (isRiverWater(valley.river, point)) return false;
  }
  // All on one level: every corner on a foundation's deck, or every corner on the ground.
  const onDecks = corners.filter((corner) => foundationOn(entities, snapToGridSquare(corner)) !== undefined).length;
  if (onDecks !== 0 && onDecks !== corners.length) return false;
  const margin = FREE_STUMP_MARGIN_METRES;
  const nearStumps = turnedRect(spot, halfX + margin, halfZ + margin, turns);
  for (const stump of stumpEntities(entities)) if (isInRect(nearStumps, stump.position)) return false;
  // A cabin roof overhead and a foundation underfoot are not in the way. Every other structure is.
  for (const fire of campfireEntities(entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
  for (const frame of walkBlockerSpotEntities(entities)) {
    // Furniture can block walking at spots too, but only the ground it covers is in the way.
    const kind = structureKindOf(frame);
    if (kind !== undefined && isPlacedFreely(kind)) continue;
    for (const square of frame.blocksWalkingSpots) if (rectsOverlap(rect, gridSquareAround(square))) return false;
  }
  return isClearOfTreesAndStructures(entities, rect, { ignoreCabinRoofs: true });
}

/** Spots spread evenly across a rectangle, edges and corners included, no further apart than FREE_CHECK_SPACING_METRES. */
function spotsAcross(rect: GroundRect): GroundPoint[] {
  const along = (min: number, max: number) => {
    const steps = Math.max(1, Math.ceil((max - min) / FREE_CHECK_SPACING_METRES));
    return Array.from({ length: steps + 1 }, (_, i) => min + ((max - min) * i) / steps);
  };
  return along(rect.min.x, rect.max.x).flatMap((x) => along(rect.min.z, rect.max.z).map((z) => ({ x, z })));
}

/** The building-grid square that holds a spot. */
function gridSquareAround(spot: GroundPoint): GroundRect {
  return turnedRect(snapToGridSquare(spot), BUILD_GRID_METRES / 2, BUILD_GRID_METRES / 2, 0);
}

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = {
  campfire,
  leanTo,
  foundation,
  floor,
  logWall,
  doorFrame,
  window: windowPiece,
  roofFrame,
  roof,
  door,
  shutters,
  fireplace,
  chimney,
  woodpile,
  ...FURNITURE_STRUCTURES,
  sawhorse,
  sled,
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
  return isClearOfTreesAndStructures(entities, rect);
}

/** The structures a cabin is built from. */
const CABIN_PIECES: ReadonlySet<StructureKind> = new Set<StructureKind>(["foundation", "logWall", "doorFrame", "window", "roofFrame", "roof"]);

/**
 * Whether `rect` overlaps any foundation, log wall, door frame, window, roof frame, or roof section, finished or as a blueprint.
 * A wall or door frame covers only the line it stands on, so it overlaps only a rectangle that reaches across that line.
 */
function overlapsCabinPiece(entities: EntityStore, rect: GroundRect): boolean {
  for (const built of foundationEntities(entities)) if (rectsOverlap(rect, foundation.footprint(built.position, 0))) return true;
  for (const piece of edgePieceEntities(entities)) if (rectsOverlap(rect, footprintOfEntity(piece))) return true;
  for (const section of cabinRoofEntities(entities)) if (rectsOverlap(rect, section.roof)) return true;
  for (const frame of roofFrameEntities(entities)) if (rectsOverlap(rect, footprintOfEntity(frame))) return true;
  for (const blueprint of blueprintEntities(entities)) {
    if (CABIN_PIECES.has(blueprint.blueprint.structure) && rectsOverlap(rect, footprintOfEntity(blueprint))) return true;
  }
  return false;
}

/**
 * Whether a campfire on open ground, finished or as a blueprint, reaches across `rect`.
 * A campfire in the middle of a foundation square, in a room, is left out: it sits clear of the walls round its square.
 */
function overlapsOpenGroundCampfire(entities: EntityStore, rect: GroundRect): boolean {
  const fires = [...campfireEntities(entities), ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === "campfire")];
  return fires.some((fire) => foundationUnderCampfire(entities, fire.position) === undefined && rectsOverlap(rect, campfire.footprint(fire.position, 0)));
}

/** Whether a log, debarked log, stick, piece of bark, bedroll, pile, or planted torch lies on `rect`, edges included. */
function hasThingsLyingOn(entities: EntityStore, rect: GroundRect): boolean {
  return lyingThings(entities).some(({ position }) => isInRect(rect, position));
}

/**
 * Whether `rect` keeps clear of standing trees, young trees, and every structure: any blueprint, a finished roof, a finished woodpile,
 * a finished wall or door frame, a piece of furniture, a sled, or a finished work station such as a sawhorse.
 * A wall or door frame covers only the line it stands on, so it is in the way only of something that reaches across that line.
 * `ignoreFreelyPlaced` lets it go over furniture and sleds, and their blueprints, as a roof does.
 * `ignoreCabinRoofs` lets it go under a finished cabin roof or roof frame, or a blueprint of either, as furniture does. A lean-to is still in the way.
 * `ignoreRoofFrames` lets it go over a finished roof frame, as a roof does.
 * `ignoreFireplaces` lets it go over a fireplace or chimney, finished or as a blueprint, as a roof frame and a roof do.
 */
function isClearOfTreesAndStructures(
  entities: EntityStore,
  rect: GroundRect,
  {
    ignoreFreelyPlaced = false,
    ignoreCabinRoofs = false,
    ignoreRoofFrames = false,
    ignoreFireplaces = false,
  }: { ignoreFreelyPlaced?: boolean; ignoreCabinRoofs?: boolean; ignoreRoofFrames?: boolean; ignoreFireplaces?: boolean } = {},
): boolean {
  const nearTrees = widenRect(rect, TREE_CLEARANCE_METRES);
  for (const tree of treeEntities(entities)) if (isInRect(nearTrees, tree.position)) return false;
  // A planted sapling is in the way too, since it grows into a tree where it stands. A sapling on a stump goes with its stump.
  for (const tree of growingTreeEntities(entities)) if ((isYoungTree(tree.growth) || tree.stump !== true) && isInRect(nearTrees, tree.position)) return false;
  for (const blueprint of blueprintEntities(entities)) {
    const { structure } = blueprint.blueprint;
    if ((ignoreFreelyPlaced && isPlacedFreely(structure)) || (ignoreCabinRoofs && (structure === "roof" || structure === "roofFrame"))) continue;
    if ((ignoreFireplaces && isFireplaceOrChimney(structure)) || liesUnderfoot(structure)) continue;
    if (rectsOverlap(rect, footprintOfEntity(blueprint))) return false;
  }
  for (const roofed of roofEntities(entities)) {
    // A lean-to's roof is part of the lean-to, so it is always in the way. Only a cabin's roof may be over something.
    if (ignoreCabinRoofs && roofed.cabinRoof === true) continue;
    if (rectsOverlap(rect, roofed.roof)) return false;
  }
  if (!ignoreCabinRoofs && !ignoreRoofFrames) {
    for (const frame of roofFrameEntities(entities)) if (rectsOverlap(rect, footprintOfEntity(frame))) return false;
  }
  if (!ignoreFreelyPlaced && !isClearOfFreelyPlaced(entities, rect)) return false;
  // Every other finished structure is in the way, so a new kind of structure is in the way unless it says otherwise.
  for (const { entity, kind } of finishedStructures(entities)) {
    if (CHECKED_APART.has(kind) || isPlacedFreely(kind) || liesUnderfoot(kind) || (ignoreFireplaces && isFireplaceOrChimney(kind))) continue;
    if (rectsOverlap(rect, footprintOfEntity(entity))) return false;
  }
  return true;
}

/**
 * Finished structures `isClearOfTreesAndStructures` checks in their own way, or not at all.
 * A lean-to and a roof section are checked by their roofs, and a roof frame by its own rule. Each placement rule decides about foundations and campfires itself.
 */
const CHECKED_APART: ReadonlySet<StructureKind> = new Set<StructureKind>(["foundation", "campfire", "leanTo", "roofFrame", "roof"]);

/** Whether `rect` keeps clear of every finished piece of furniture and sled, and every blueprint of one. */
function isClearOfFreelyPlaced(entities: EntityStore, rect: GroundRect): boolean {
  return placedStructures(entities).every(({ entity, kind }) => !isPlacedFreely(kind) || !rectsOverlap(rect, footprintOfEntity(entity)));
}

/** Whether a structure is placed freely rather than on the building grid: furniture and the sled. */
export function isPlacedFreely(kind: StructureKind): boolean {
  return structureOf(kind).placement === "anywhere";
}

/** Whether a material is carried to a blueprint on the player's shoulder, rather than taken from the backpack. */
export function isDelivered(material: BuildMaterial): material is DeliveredMaterial {
  return material === "log" || material === "debarkedLog";
}

/** Whether a blueprint keeps a material once it has it: one carried to it on the shoulder, planks, or stone. See KeptMaterial. */
export function isKept(material: BuildMaterial): material is KeptMaterial {
  return isDelivered(material) || isTaken(material);
}

/** Whether a blueprint takes a material from the backpack and from piles near it: planks or stone. See TakenMaterial. */
export function isTaken(material: BuildMaterial): material is TakenMaterial {
  return (TAKEN_MATERIALS as readonly BuildMaterial[]).includes(material);
}

/**
 * What a blueprint or finished structure of `kind` costs: the cost it was placed with, if that differs from its structure's cost now,
 * or else its structure's cost. A swap blueprint costs nothing, because the logs of the wall it replaces pay for it.
 */
export function costOf(entity: Entity, kind: StructureKind): readonly MaterialCost[] {
  if (entity.swapsWall === true) return [];
  return entity.builtCost ?? structureOf(kind).cost;
}

/**
 * What kind of structure an entity is: a blueprint of any structure, or a finished campfire, lean-to, foundation,
 * log wall, door frame, roof frame, roof section, fireplace, chimney, woodpile, piece of furniture, work station, or sled. Undefined for anything else.
 */
export function structureKindOf(entity: Entity): StructureKind | undefined {
  if (entity.blueprint !== undefined) return entity.blueprint.structure;
  return STRUCTURES.find((definition) => isFinishedAs(definition, entity))?.kind;
}

/** Whether an entity is a finished structure of this kind: it has the kind's marker, holding the kind's name where the marker holds a name. */
function isFinishedAs({ kind, finishedAs }: StructureDefinition, entity: Entity): boolean {
  const marker: unknown = entity[finishedAs];
  return marker !== undefined && (typeof marker !== "string" || marker === kind);
}

/** An entity that is a blueprint or a finished structure, standing somewhere. */
export type PlacedStructure = Entity & { position: Vec3 } & { [Marker in "blueprint" | FinishedMarker]: Required<Pick<Entity, Marker>> }[
    "blueprint" | FinishedMarker];

/** Every marker component, once each, even where several kinds share one. */
const FINISHED_MARKERS: readonly FinishedMarker[] = [...new Set(STRUCTURES.map(({ finishedAs }) => finishedAs))];

/** Every finished structure, of every kind, with its kind. Blueprints are not among them. */
export function finishedStructures(entities: EntityStore): { entity: PlacedStructure; kind: StructureKind }[] {
  return FINISHED_MARKERS.flatMap((marker) =>
    [...entities.with(marker, "position")].flatMap((entity) => {
      const kind = structureKindOf(entity);
      return kind === undefined ? [] : [{ entity: entity, kind }];
    }),
  );
}

/** Every blueprint and every finished structure, with its kind. */
export function placedStructures(entities: EntityStore): { entity: PlacedStructure; kind: StructureKind }[] {
  const blueprints = [...blueprintEntities(entities)].map((entity) => ({ entity, kind: entity.blueprint.structure }));
  return [...blueprints, ...finishedStructures(entities)];
}

/** Whether an entity is a blueprint or a finished structure, standing somewhere. */
export function isPlacedStructure(entity: Entity): entity is PlacedStructure {
  return structureKindOf(entity) !== undefined && entity.position !== undefined;
}

/** The ground a blueprint or finished structure covers where it stands, facing the way it faces. */
export function footprintOfEntity(entity: PlacedStructure): GroundRect {
  const kind = structureKindOf(entity);
  if (kind === undefined) throw new Error("Not a structure");
  return structureOf(kind).footprint({ x: entity.position.x, z: entity.position.z }, entity.facing?.turns ?? 0);
}
