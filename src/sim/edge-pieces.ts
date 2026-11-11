// Where log walls and door frames stand: on the edges of foundation squares.
// Two squares side by side share the edge between them, and that edge has one middle.
// A wall or door frame sits at the middle of its edge, so one edge holds at most one piece, seen from either square.
import { BUILD_GRID_METRES, isOnGridSquare } from "./build-grid";
import { blueprintEntities, edgePieceEntities, foundationEntities, type Entity, type EntityStore } from "./entities";
import { turnOffset, type EdgePieceKind, type QuarterTurns } from "./structure-kind";
import type { GroundPoint } from "./valley";

/** Two edge middles closer than this, in metres, are the same edge. */
const SAME_EDGE_METRES = 1e-6;

/**
 * The middle of one edge of the grid square with this middle.
 * `side` is the way a log wall or door frame on that edge faces: 0 is the +z edge, 1 the -x edge, 2 the -z edge, and 3 the +x edge.
 */
export function edgeMiddle(square: GroundPoint, side: QuarterTurns): GroundPoint {
  const offset = turnOffset({ x: 0, z: BUILD_GRID_METRES / 2 }, side);
  return { x: square.x + offset.x, z: square.z + offset.z };
}

/** The middles of the two grid squares either side of an edge: first the square whose `side` edge it is, then the square beyond. */
export function squaresBeside(edge: GroundPoint, side: QuarterTurns): [GroundPoint, GroundPoint] {
  const offset = turnOffset({ x: 0, z: BUILD_GRID_METRES / 2 }, side);
  return [
    { x: edge.x - offset.x, z: edge.z - offset.z },
    { x: edge.x + offset.x, z: edge.z + offset.z },
  ];
}

/** Whether two spots are the middle of the same edge. */
export function isSameEdge(a: GroundPoint, b: GroundPoint): boolean {
  return Math.abs(a.x - b.x) < SAME_EDGE_METRES && Math.abs(a.z - b.z) < SAME_EDGE_METRES;
}

/**
 * The finished log wall or door frame on one side of the grid square with this middle, or undefined if that edge is open.
 * `side` is as for `edgeMiddle`. A piece placed from the square beside it counts too, since the two squares share the edge.
 */
export function edgePieceOn(entities: EntityStore, square: GroundPoint, side: QuarterTurns): EdgePieceKind | undefined {
  const edge = edgeMiddle(square, side);
  for (const piece of edgePieceEntities(entities)) if (isSameEdge(piece.position, edge)) return piece.edgePiece;
  return undefined;
}

/** Whether a log wall or door frame stands on an edge, finished or as a blueprint. */
export function isEdgeTaken(entities: EntityStore, edge: GroundPoint): boolean {
  for (const piece of edgePieceEntities(entities)) if (isSameEdge(piece.position, edge)) return true;
  for (const blueprint of blueprintEntities(entities)) {
    if (isEdgePiece(blueprint.blueprint.piece) && isSameEdge(blueprint.position, edge)) return true;
  }
  return false;
}

/** The finished foundations on either side of an edge. A wall or door frame needs at least one. */
export function foundationsBeside(entities: EntityStore, edge: GroundPoint, side: QuarterTurns): (Entity & { position: NonNullable<Entity["position"]> })[] {
  const squares = squaresBeside(edge, side);
  return foundationEntities(entities).entities.filter((foundation) => squares.some((square) => isOnGridSquare(foundation.position, square)));
}

/** Whether a structure stands on the edge of a foundation square, rather than covering ground. */
export function isEdgePiece(kind: string): kind is EdgePieceKind {
  return kind === "logWall" || kind === "doorFrame";
}
