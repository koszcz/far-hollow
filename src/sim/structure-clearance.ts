// The placement rules that look at other structures: whether ground is free of trees and structures, and what stands on a foundation.
// Each structure's own file calls them from its canPlace. They read only structure shapes, never a whole definition.
import { isOnGridSquare } from "./build-grid";
import { edgeMiddle, isEdgeTaken } from "./edge-pieces";
import {
  blueprintEntities,
  cabinRoofEntities,
  campfireEntities,
  edgePieceEntities,
  fireplaceEntities,
  floorEntities,
  foundationEntities,
  furnitureEntities,
  growingTreeEntities,
  leanToEntities,
  lyingThings,
  roofEntities,
  roofFrameEntities,
  treeEntities,
  type EntityStore,
} from "./entities";
import { foundationOn } from "./foundations";
import type { GroundPoint } from "./ground-point";
import { isInRect, rectsOverlap, SIDES, widenRect, type GroundRect, type StructureKind } from "./structure-kind";
import { finishedStructures, footprintOfEntity, isPlacedFreely, liesUnderfoot, placedStructures, structureKindOf } from "./structure-queries";
import { SHAPES } from "./structure-shapes";
import type { PlacementSite } from "./structure-types";
import { isYoungTree } from "./tree-growth";
import { isWalkable } from "./walk-map";

/** The finished foundation a campfire at `spot` would stand on: one whose square has `spot` as its middle. */
export function foundationUnderCampfire(entities: EntityStore, spot: GroundPoint) {
  const foundation = foundationOn(entities, spot);
  if (foundation === undefined) return undefined;
  return foundation.position.x === spot.x && foundation.position.z === spot.z ? foundation : undefined;
}

/**
 * Whether anything stands on the foundation square with this middle, finished or as a blueprint:
 * a log wall or door frame on one of its edges, a campfire, fireplace, or floor whose centre is on it, or a roof frame, roof section, lean-to, piece of furniture, or sled
 * over any of it. A structure placed freely, such as a piece of furniture, stands on every foundation its base reaches over.
 * `ignoreFloors` leaves out a floor of planks, finished or as a blueprint.
 */
export function standsOnFoundation(entities: EntityStore, square: GroundPoint, { ignoreFloors = false }: { ignoreFloors?: boolean } = {}): boolean {
  if (SIDES.some((side) => isEdgeTaken(entities, edgeMiddle(square, side)))) return true;
  const rect = SHAPES.foundation.footprint(square, 0);
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

/** A standing tree's trunk and lowest branches reach this far from the foot of its trunk, in metres. Nothing is built over them. */
const TREE_CLEARANCE_METRES = 0.5;

/**
 * Whether a structure covering `rect` fits there: on ground the player can walk on, clear of standing trees,
 * and not over another blueprint, a finished roof, or a finished foundation.
 */
export function isClearFor({ entities, walkMap }: PlacementSite, rect: GroundRect): boolean {
  for (let x = rect.min.x + 0.5; x < rect.max.x; x += 1) {
    for (let z = rect.min.z + 0.5; z < rect.max.z; z += 1) {
      if (!isWalkable(walkMap, { x, z })) return false;
    }
  }
  // A foundation is walkable, but a lean-to stands on the ground, not on a deck.
  for (const built of foundationEntities(entities)) if (rectsOverlap(rect, SHAPES.foundation.footprint(built.position, 0))) return false;
  return isClearOfTreesAndStructures(entities, rect);
}

/** The structures a cabin is built from. */
const CABIN_PIECES: ReadonlySet<StructureKind> = new Set<StructureKind>(["foundation", "logWall", "doorFrame", "window", "roofFrame", "roof"]);

/**
 * Whether `rect` overlaps any foundation, log wall, door frame, window, roof frame, or roof section, finished or as a blueprint.
 * A wall or door frame covers only the line it stands on, so it overlaps only a rectangle that reaches across that line.
 */
export function overlapsCabinPiece(entities: EntityStore, rect: GroundRect): boolean {
  for (const built of foundationEntities(entities)) if (rectsOverlap(rect, SHAPES.foundation.footprint(built.position, 0))) return true;
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
export function overlapsOpenGroundCampfire(entities: EntityStore, rect: GroundRect): boolean {
  const fires = [...campfireEntities(entities), ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === "campfire")];
  return fires.some(
    (fire) => foundationUnderCampfire(entities, fire.position) === undefined && rectsOverlap(rect, SHAPES.campfire.footprint(fire.position, 0)),
  );
}

/** Whether a log, debarked log, stick, piece of bark, bedroll, pile, or planted torch lies on `rect`, edges included. */
export function hasThingsLyingOn(entities: EntityStore, rect: GroundRect): boolean {
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
export function isClearOfTreesAndStructures(
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
export function isClearOfFreelyPlaced(entities: EntityStore, rect: GroundRect): boolean {
  return placedStructures(entities).every(({ entity, kind }) => !isPlacedFreely(kind) || !rectsOverlap(rect, footprintOfEntity(entity)));
}

/** Whether a structure is a fireplace or a chimney, which a roof frame and a roof section may go over. */
function isFireplaceOrChimney(kind: StructureKind): boolean {
  return kind === "fireplace" || kind === "chimney";
}
