// Windows and their shutters. A window is an edge piece: a log wall with an opening in it, and no glass.
// Shutters hang in a finished window, the way a door hangs in a door frame. They are not an edge piece, so the window keeps the edge.
// The player opens and closes them by hand (see shutters.ts). They stay as the player left them, and they never block walking.
import { isSameEdge } from "./edge-pieces";
import { blueprintEntities, edgePieceEntities, shuttersEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import { nearestWithin, type GroundPoint } from "./ground-point";

/** The finished window on the edge with this middle, or undefined if the edge holds none. */
export function windowOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return edgePieceEntities(entities).entities.find((piece) => piece.edgePiece === "window" && isSameEdge(piece.position, edge));
}

/** The finished window nearest `at` with no shutters, finished or as a blueprint, within `reach` metres of the middle of its edge. */
export function nearestBareWindow(entities: EntityStore, at: GroundPoint, reach: number): (Entity & { position: Vec3 }) | undefined {
  return nearestWithin(
    at,
    edgePieceEntities(entities).entities.filter((piece) => piece.edgePiece === "window" && !hasShutters(entities, piece.position)),
    reach,
  );
}

/** The finished shutters on the edge with this middle, if any. */
export function finishedShuttersOn(entities: EntityStore, edge: GroundPoint): (Entity & { position: Vec3; shutters: { open: boolean } }) | undefined {
  return shuttersEntities(entities).entities.find((shutters) => isSameEdge(shutters.position, edge));
}

/** Whether shutters hang on the edge with this middle, finished or as a blueprint. */
export function hasShutters(entities: EntityStore, edge: GroundPoint): boolean {
  if (finishedShuttersOn(entities, edge) !== undefined) return true;
  return blueprintEntities(entities).entities.some(({ blueprint, position }) => blueprint.structure === "shutters" && isSameEdge(position, edge));
}

/** Whether the window on the edge with this middle keeps the room closed: it has finished shutters, and they are closed. */
export function isWindowShut(entities: EntityStore, edge: GroundPoint): boolean {
  return finishedShuttersOn(entities, edge)?.shutters.open === false;
}
