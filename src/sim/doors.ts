// Doors: plank doors hung in finished door frames. A door is not an edge piece. It hangs in one, so the frame keeps the edge.
// A door never blocks walking. It opens by itself while the player is near the middle of its frame and shuts once they leave.
// Whether a door stands open is worked out from where the player is each time it is asked for. It is never stored or saved.
import { isSameEdge } from "./edge-pieces";
import { type Entity, type EntityStore, type Vec3 } from "./entities";
import { blueprintEntities, doorEntities, edgePieceEntities } from "./entity-queries";
import { groundDistance, nearestWithin, type GroundPoint } from "./ground-point";

/** A door stands open while the player is within this many metres of the middle of its frame. */
export const DOOR_OPEN_METRES = 1;

/** Whether a door whose frame has its middle at `door` stands open with the player at `player`: within DOOR_OPEN_METRES of it. */
export function isDoorOpen(door: GroundPoint, player: GroundPoint): boolean {
  return groundDistance(door, player) <= DOOR_OPEN_METRES;
}

/** The finished door frame on the edge with this middle, or undefined if the edge holds none. */
export function doorFrameOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return edgePieceEntities(entities).entities.find((piece) => piece.edgePiece === "doorFrame" && isSameEdge(piece.position, edge));
}

/** The finished door frame nearest `at`, within `reach` metres of the middle of its edge. */
export function nearestDoorFrame(entities: EntityStore, at: GroundPoint, reach: number): (Entity & { position: Vec3 }) | undefined {
  return nearestWithin(
    at,
    edgePieceEntities(entities).entities.filter((piece) => piece.edgePiece === "doorFrame"),
    reach,
  );
}

/** The finished door on the edge with this middle, if any. */
export function finishedDoorOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return doorEntities(entities).entities.find((door) => isSameEdge(door.position, edge));
}

/** Whether a door hangs on the edge with this middle, finished or as a blueprint. */
export function hasDoor(entities: EntityStore, edge: GroundPoint): boolean {
  if (finishedDoorOn(entities, edge) !== undefined) return true;
  return blueprintEntities(entities).entities.some(({ blueprint, position }) => blueprint.structure === "door" && isSameEdge(position, edge));
}
