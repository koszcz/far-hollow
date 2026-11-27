// Swapping a finished log wall for a window or door frame. The player places the new piece's blueprint on the wall: a swap blueprint.
// The wall stands whole until the swap finishes, so it still blocks walking, closes the room, and holds up any roof frame.
// When the swap finishes, the wall goes and the blueprint turns into the new piece, built from the wall's own logs.
// The logs the new piece does not need go on the ground near the player, on their side of the wall.
import { hasOpening, isEdgePiece, isSameEdge } from "./edge-pieces";
import { type Entity, type EntityStore, type Vec3 } from "./entities";
import { blueprintEntities, edgePieceEntities } from "./entity-queries";
import type { GroundPoint } from "./ground-point";
import type { StructureKind } from "./structure-kind";

/** Whether a structure can be built in place of a finished log wall: a window or a door frame. */
export function canSwapForWall(kind: StructureKind): boolean {
  return isEdgePiece(kind) && hasOpening(kind);
}

/**
 * The finished log wall on the edge with this middle that a swap could go on, or undefined if there is none.
 * A wall that already has a swap blueprint on it takes no other.
 */
export function swappableWallOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  const wall = wallOn(entities, edge);
  if (wall === undefined || swapBlueprintOn(entities, edge) !== undefined) return undefined;
  return wall;
}

/** The swap blueprint on the edge with this middle, if there is one. */
export function swapBlueprintOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return blueprintEntities(entities).entities.find((blueprint) => blueprint.swapsWall === true && isSameEdge(blueprint.position, edge));
}

/** The finished log wall on the edge with this middle, if there is one. */
export function wallOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return edgePieceEntities(entities).entities.find((piece) => piece.edgePiece === "logWall" && isSameEdge(piece.position, edge));
}
