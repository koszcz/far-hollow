// The structures placed anywhere, wherever the mouse points, off the building grid: furniture and the sled.
// Each stands on the ground or on a foundation's deck, never half on and half off one.
import { BUILD_GRID_METRES, isOnGridSquare, snapToGridSquare } from "./build-grid";
import { campfireEntities, stumpEntities, walkBlockerSpotEntities, type EntityStore } from "./entities";
import { foundationOn, standingHeightAt } from "./foundations";
import { FURNITURE, type FurnitureDefinition } from "./furniture";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { roomAround } from "./rooms";
import { isClearOfTreesAndStructures } from "./structure-clearance";
import { FURNITURE_KINDS, isInRect, rectsOverlap, turnedRect, type FurnitureKind, type GroundRect } from "./structure-kind";
import { isPlacedFreely, structureKindOf } from "./structure-queries";
import { furnitureShape, SHAPES, SLED_LENGTH_METRES, SLED_WIDTH_METRES } from "./structure-shapes";
import type { PlacementSite, StructureDefinition } from "./structure-types";
import { isRiverWater } from "./valley";
import { isWalkable } from "./walk-map";

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
    ...furnitureShape(piece),
    cost: piece.cost,
    ...(piece.tool === undefined ? {} : { tool: piece.tool }),
    buildSeconds: piece.buildSeconds,
    snap: (_site, at) => ({ x: at.x, z: at.z }),
    heightAt: ({ entities, valley }, spot) => standingHeightAt(entities, valley.terrain, spot),
    canPlace: (site, spot, turns) =>
      canPlaceFreely(site, spot, turns, halfX, halfZ) && (piece.needsRoom !== true || isInOneRoom(site.entities, spot, turns, halfX, halfZ)),
    ...(piece.needsRoom === true
      ? { placementRefusal: ({ entities }, spot, turns) => (isInOneRoom(entities, spot, turns, halfX, halfZ) ? undefined : { kind: "needsRoom" }) }
      : {}),
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
export const FURNITURE_STRUCTURES = Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, freelyPlaced(FURNITURE[kind])])) as {
  readonly [Kind in FurnitureKind]: StructureDefinition & { readonly kind: Kind };
};

/** How many logs a sled costs: one for each runner. Construction spends one at the start of each stage. */
export const SLED_LOG_COST = 2;
/** How many sticks a sled costs: the cross pieces laid over the runners. */
export const SLED_STICK_COST = 4;
/** How long the player holds the build action to build a sled, in seconds. */
export const SLED_BUILD_SECONDS = 10;
/**
 * A sled: two log runners with sticks laid across them, for dragging logs. It is placed freely, wherever the mouse points,
 * and R turns it. Its runners run along x when it faces the default way.
 * It blocks no walking, since the player will drag it about. It starts empty.
 */
export const sled: StructureDefinition & { readonly kind: "sled" } = {
  ...SHAPES.sled,
  cost: [
    { material: "log", count: SLED_LOG_COST },
    { material: "stick", count: SLED_STICK_COST },
  ],
  tool: "axe",
  buildSeconds: SLED_BUILD_SECONDS,
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
  for (const fire of campfireEntities(entities)) if (rectsOverlap(rect, SHAPES.campfire.footprint(fire.position, 0))) return false;
  for (const frame of walkBlockerSpotEntities(entities)) {
    // Furniture can block walking at spots too, but only the ground it covers is in the way.
    const kind = structureKindOf(frame);
    if (kind !== undefined && isPlacedFreely(kind)) continue;
    for (const square of frame.blocksWalkingSpots) if (rectsOverlap(rect, gridSquareAround(square))) return false;
  }
  return isClearOfTreesAndStructures(entities, rect, { ignoreCabinRoofs: true });
}

/** Whether a piece placed freely at `spot`, facing `turns`, stands wholly inside one room: every corner lies on a square of it. */
function isInOneRoom(entities: EntityStore, spot: GroundPoint, turns: QuarterTurns, halfX: number, halfZ: number): boolean {
  const room = roomAround(entities, snapToGridSquare(spot));
  if (room === undefined) return false;
  const inside = turnedRect(spot, halfX - EDGE_INSET_METRES, halfZ - EDGE_INSET_METRES, turns);
  const corners = [inside.min, inside.max, { x: inside.min.x, z: inside.max.z }, { x: inside.max.x, z: inside.min.z }];
  return corners.every((corner) => room.some((square) => isOnGridSquare(square, corner)));
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
