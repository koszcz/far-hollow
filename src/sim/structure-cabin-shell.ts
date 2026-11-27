// The shell of a cabin: foundation, floor, log walls, door frames, windows, roof frame, and roof.
// Each is built on the building grid, a square or an edge at a time.
import { isOnGridSquare, snapToGridSquare } from "./build-grid";
import { blocksWalking, edgeMiddle, edgePieceOn, foundationsBeside, isEdgeTaken, meetsOpeningAtCorner, squaresBeside } from "./edge-pieces";
import { blueprintEntities, campfireEntities, foundationEntities, roofFrameEntities, stumpEntities, type Entity, type EntityStore } from "./entities";
import { floorJoin, foundationDeckTop, foundationOn, raiseFloors, type FloorJoin } from "./foundations";
import { floorOn } from "./floors";
import type { GroundPoint } from "./ground-point";
import { hasThingsLyingOn, isClearOfTreesAndStructures, overlapsOpenGroundCampfire, standsOnFoundation } from "./structure-clearance";
import { isInRect, rectsOverlap, SIDES, turnedRect, type EdgePieceKind } from "./structure-kind";
import { FOUNDATION_HALF_METRES, SHAPES } from "./structure-shapes";
import type { PlacementSite, StructureDefinition, StructureShape } from "./structure-types";
import { canSwapForWall, swappableWallOn } from "./wall-swaps";
import { isRiverWater, terrainHeightAt } from "./valley";
import { cellIndexAt } from "./walk-map";

/** How many debarked logs a foundation costs. Construction spends one at the start of each stage. */
export const FOUNDATION_LOG_COST = 4;
/** How long the player holds the build action to build a foundation, in seconds. */
export const FOUNDATION_BUILD_SECONDS = 12;
/** A stump this close to a foundation's square, in metres, counts as under it. */
const STUMP_MARGIN_METRES = 0.3;

export const foundation: StructureDefinition & { readonly kind: "foundation" } = {
  ...SHAPES.foundation,
  cost: [{ material: "debarkedLog", count: FOUNDATION_LOG_COST }],
  buildSeconds: FOUNDATION_BUILD_SECONDS,
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
    for (const fire of campfireEntities(entities)) if (rectsOverlap(rect, SHAPES.campfire.footprint(fire.position, 0))) return false;
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

/** How many planks a floor costs. Construction spends one at the start of each stage. */
export const FLOOR_PLANK_COST = 2;
/** How long the player holds the build action to build a floor, in seconds. */
export const FLOOR_BUILD_SECONDS = 4;

/**
 * A floor: planks laid flush across the deck of one finished foundation square. It changes only how the square looks.
 * It lies underfoot, so nothing on the square is in its way, and it is in the way of nothing. A square holds one floor.
 */
export const floor: StructureDefinition & { readonly kind: "floor" } = {
  ...SHAPES.floor,
  cost: [{ material: "plank", count: FLOOR_PLANK_COST }],
  buildSeconds: FLOOR_BUILD_SECONDS,
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => foundationOn(entities, spot) !== undefined && floorOn(entities, spot) === undefined,
  finish: () => ({ floor: true }),
};

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
function edgePiece<Kind extends EdgePieceKind>(
  shape: StructureShape<Kind>,
  logCost: number,
  buildSeconds: number,
): StructureDefinition & { readonly kind: Kind } {
  const { kind, footprint } = shape;
  /** Whether a blueprint at `spot` would be a swap: this piece on a finished log wall that has no swap on it yet. */
  const isSwap = (entities: EntityStore, spot: GroundPoint) => canSwapForWall(kind) && swappableWallOn(entities, spot) !== undefined;
  /** Whether the edge holds a piece or blueprint this one may not go on. A log wall it would swap does not count. */
  const isTaken = (entities: EntityStore, spot: GroundPoint) => isEdgeTaken(entities, spot) && !isSwap(entities, spot);
  return {
    ...shape,
    cost: [{ material: "debarkedLog", count: logCost }],
    buildSeconds,
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

export const logWall = edgePiece(SHAPES.logWall, LOG_WALL_LOG_COST, LOG_WALL_BUILD_SECONDS);
export const doorFrame = edgePiece(SHAPES.doorFrame, DOOR_FRAME_LOG_COST, DOOR_FRAME_BUILD_SECONDS);
export const windowPiece = edgePiece(SHAPES.window, WINDOW_LOG_COST, WINDOW_BUILD_SECONDS);

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
export const roofFrame: StructureDefinition & { readonly kind: "roofFrame" } = {
  ...SHAPES.roofFrame,
  cost: [{ material: "debarkedLog", count: ROOF_FRAME_LOG_COST }],
  buildSeconds: ROOF_FRAME_BUILD_SECONDS,
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
export const roof: StructureDefinition & { readonly kind: "roof" } = {
  ...SHAPES.roof,
  cost: [{ material: "plank", count: ROOF_PLANK_COST }],
  buildSeconds: ROOF_BUILD_SECONDS,
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
