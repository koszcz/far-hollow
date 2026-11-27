// Where log walls, door frames, and windows stand: on the edges of foundation squares.
// Two squares side by side share the edge between them, and that edge has one middle.
// An edge piece sits at the middle of its edge, so one edge holds at most one piece, seen from either square.
import { BUILD_GRID_METRES, isOnGridSquare } from "./build-grid";
import { type Entity, type EntityStore } from "./entities";
import { blueprintEntities, edgePieceEntities, foundationEntities } from "./entity-queries";
import { EDGE_PIECE_KINDS, type EdgePieceKind } from "./structure-kind";
import { areAtRightAngles, turnOffset, type QuarterTurns } from "./quarter-turns";
import { addGroundPoints, type GroundPoint, subtractGroundPoints } from "./ground-point";

/** Two edge middles closer than this, in metres, are the same edge. */
const SAME_EDGE_METRES = 1e-6;

/**
 * The middle of one edge of the grid square with this middle.
 * `side` is the way a log wall or door frame on that edge faces: 0 is the +z edge, 1 the -x edge, 2 the -z edge, and 3 the +x edge.
 */
export function edgeMiddle(square: GroundPoint, side: QuarterTurns): GroundPoint {
  const offset = turnOffset({ x: 0, z: BUILD_GRID_METRES / 2 }, side);
  return addGroundPoints(square, offset);
}

/** The middles of the two grid squares either side of an edge: first the square whose `side` edge it is, then the square beyond. */
export function squaresBeside(edge: GroundPoint, side: QuarterTurns): [GroundPoint, GroundPoint] {
  const offset = turnOffset({ x: 0, z: BUILD_GRID_METRES / 2 }, side);
  return [subtractGroundPoints(edge, offset), addGroundPoints(edge, offset)];
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
    if (isEdgePiece(blueprint.blueprint.structure) && isSameEdge(blueprint.position, edge)) return true;
  }
  return false;
}

/** The finished foundations on either side of an edge. A wall or door frame needs at least one. */
export function foundationsBeside(entities: EntityStore, edge: GroundPoint, side: QuarterTurns): (Entity & { position: NonNullable<Entity["position"]> })[] {
  const squares = squaresBeside(edge, side);
  return foundationEntities(entities).entities.filter((foundation) => squares.some((square) => isOnGridSquare(foundation.position, square)));
}

/** The two ends of the edge with this middle, for a piece facing `turns`. Each end is a corner of the building grid. */
export function edgeEnds(edge: GroundPoint, turns: QuarterTurns): [GroundPoint, GroundPoint] {
  const half = turnOffset({ x: BUILD_GRID_METRES / 2, z: 0 }, turns);
  return [subtractGroundPoints(edge, half), addGroundPoints(edge, half)];
}

/**
 * Whether a piece of this kind on this edge would meet a door frame or window at a corner, or be a door frame or window meeting
 * any edge piece there. Two pieces meet at a corner when they run different ways and an end of one is at an end of the other.
 * A door frame or window never stands at a corner, because a log cabin's corner needs crossed logs on both sides.
 * Blueprints count, so it does not matter which piece the player places first.
 */
export function meetsOpeningAtCorner(entities: EntityStore, kind: EdgePieceKind, edge: GroundPoint, turns: QuarterTurns): boolean {
  const ends = edgeEnds(edge, turns);
  const pieces: { kind: EdgePieceKind; position: GroundPoint; turns: QuarterTurns }[] = [];
  for (const piece of edgePieceEntities(entities)) pieces.push({ kind: piece.edgePiece, position: piece.position, turns: piece.facing?.turns ?? 0 });
  for (const blueprint of blueprintEntities(entities)) {
    const piece = blueprint.blueprint.structure;
    if (isEdgePiece(piece)) pieces.push({ kind: piece, position: blueprint.position, turns: blueprint.facing?.turns ?? 0 });
  }
  return pieces.some(
    (piece) =>
      (hasOpening(kind) || hasOpening(piece.kind)) &&
      areAtRightAngles(piece.turns, turns) &&
      edgeEnds(piece.position, piece.turns).some((end) => ends.some((own) => isSameEdge(end, own))),
  );
}

/** Whether a structure stands on the edge of a foundation square, rather than covering ground. */
export function isEdgePiece(kind: string): kind is EdgePieceKind {
  return (EDGE_PIECE_KINDS as readonly string[]).includes(kind);
}

/**
 * What sets each kind of edge piece apart.
 * - `hasOpening`: it has an opening in it, so it never stands at a corner.
 * - `blocksWalking`: the player cannot walk through it.
 * - `isLaidInCourses`: it is built of log courses that cross the courses of the piece beside it at a corner.
 *   One running along z sits lower than one running along x, so the corners interlock.
 */
const EDGE_PIECE_TRAITS: Readonly<Record<EdgePieceKind, { hasOpening: boolean; blocksWalking: boolean; isLaidInCourses: boolean }>> = {
  logWall: { hasOpening: false, blocksWalking: true, isLaidInCourses: true },
  doorFrame: { hasOpening: true, blocksWalking: false, isLaidInCourses: false },
  window: { hasOpening: true, blocksWalking: true, isLaidInCourses: true },
};

/** Whether an edge piece has an opening in it, as a door frame and a window do, so it never stands at a corner. */
export function hasOpening(kind: EdgePieceKind): boolean {
  return EDGE_PIECE_TRAITS[kind].hasOpening;
}

/** Whether an edge piece stops the player walking across its edge, as a log wall and a window do. A door frame leaves the doorway open. */
export function blocksWalking(kind: EdgePieceKind): boolean {
  return EDGE_PIECE_TRAITS[kind].blocksWalking;
}

/** Whether an edge piece is built of log courses that interlock at corners, as a log wall and a window are. A door frame is not. */
export function isLaidInCourses(kind: EdgePieceKind): boolean {
  return EDGE_PIECE_TRAITS[kind].isLaidInCourses;
}
