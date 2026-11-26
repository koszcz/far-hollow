// Names shared by entities and the structure catalogue in structures.ts. Kept apart so neither imports the other.
import { turnOffset, type QuarterTurns } from "./quarter-turns";
import type { GroundPoint } from "./ground-point";

/** Every structure the build menu can list. Each later shelter structure adds its name here and its entry to STRUCTURES. */
export type StructureKind =
  | "campfire"
  | "leanTo"
  | "foundation"
  | "floor"
  | EdgePieceKind
  | "roofFrame"
  | "roof"
  | "door"
  | "shutters"
  | "fireplace"
  | "chimney"
  | "woodpile"
  | FurnitureKind
  | WorkStationKind
  | "sled";

/** The work stations the build menu can list. A work station is a built object where the player does one kind of processing. */
export const WORK_STATION_KINDS = ["sawhorse"] as const;
export type WorkStationKind = (typeof WORK_STATION_KINDS)[number];

/**
 * The pieces of furniture the build menu can list, in the order it lists them. Furniture is placed freely and does not snap to the building grid.
 * This is the only list that names every piece. See src/sim/furniture.ts for what a new piece adds.
 */
export const FURNITURE_KINDS = ["chest", "shelf", "bed", "table", "stool", "rainBarrel", "dryingRack", "woodBox"] as const;
export type FurnitureKind = (typeof FURNITURE_KINDS)[number];

/** A record with one entry for each piece of furniture, each made by `make`. */
export function byFurnitureKind<T>(make: (kind: FurnitureKind) => T): Record<FurnitureKind, T> {
  return Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, make(kind)])) as Record<FurnitureKind, T>;
}

/**
 * Each host and its add-on. An add-on is a building piece the player builds from the finished piece it goes on, its host,
 * not from the build menu. The build menu lists every other structure.
 */
export const ADD_ON_OF_HOST = { doorFrame: "door", window: "shutters", roofFrame: "roof", fireplace: "chimney" } as const;
export type HostKind = keyof typeof ADD_ON_OF_HOST;
export type AddOnKind = (typeof ADD_ON_OF_HOST)[HostKind];
/** Every structure the build menu lists: every structure but the add-ons. */
export type BuildMenuKind = Exclude<StructureKind, AddOnKind>;

/** Whether a structure is a host, which offers to build its add-on once finished. */
export function isHost(kind: StructureKind): kind is HostKind {
  return Object.hasOwn(ADD_ON_OF_HOST, kind);
}

/** Whether a structure is an add-on, which the build menu does not list. */
export function isAddOn(kind: StructureKind): kind is AddOnKind {
  return Object.values<StructureKind>(ADD_ON_OF_HOST).includes(kind);
}

/** The building pieces that stand on the edge of a foundation square, on the line between it and the square beside it. */
export const EDGE_PIECE_KINDS = ["logWall", "doorFrame", "window"] as const;
export type EdgePieceKind = (typeof EDGE_PIECE_KINDS)[number];

/**
 * How a blueprint follows the mouse while the player places it:
 * on the ground at a grid point or square, on a finished foundation square, on the edge of a foundation square, over a square with walls, on a finished roof frame,
 * in a finished door frame, in a finished window, on a finished fireplace, or anywhere, off the grid. Furniture and the sled are placed anywhere.
 * A floor goes `underfoot`: on a finished foundation square, one after another, with a Shift-drag placing a row.
 */
export type Placement =
  "onGround" | "onFoundation" | "underfoot" | "onEdge" | "overWalls" | "onFrame" | "inDoorFrame" | "inWindow" | "onFireplace" | "anywhere";

/** Whether the player places blueprints with this placement one after another: build mode stays open after each, and a Shift-drag places a row. Only `underfoot` does. */
export function isPlacedInRows(placement: Placement): boolean {
  return placement === "underfoot";
}

/** The four sides of a grid square, as `edgeMiddle` in edge-pieces.ts numbers them. */
export const SIDES: readonly QuarterTurns[] = [0, 1, 2, 3];

/**
 * The materials the player carries to a blueprint on their shoulder, one at a time, such as a debarked log.
 * They are too big for the backpack, so construction spends them from what was carried to the blueprint.
 * A sled is built from logs with their bark on. Every other structure that costs logs takes debarked logs.
 */
export type DeliveredMaterial = "log" | "debarkedLog";

/**
 * The materials a blueprint keeps once it has them, until construction spends them: everything carried to it on the shoulder, planks, and stone.
 * Building a blueprint that costs planks or stone takes as many from the backpack as it still needs, or as many as there are.
 * The player can bring the rest on later trips.
 */
export type KeptMaterial = DeliveredMaterial | TakenMaterial;

/** The materials a blueprint takes from the backpack and from piles near it, and keeps until construction spends them. */
export const TAKEN_MATERIALS = ["plank", "stone"] as const;
export type TakenMaterial = (typeof TAKEN_MATERIALS)[number];

/** A rectangle of ground with sides along x and z, from its `min` corner to its `max` corner, in metres. */
export interface GroundRect {
  readonly min: GroundPoint;
  readonly max: GroundPoint;
}

/** The rectangle covering a box of `halfX` by `halfZ` metres either side of `centre`, turned the way the structure faces. */
export function turnedRect(centre: GroundPoint, halfX: number, halfZ: number, turns: QuarterTurns): GroundRect {
  const corner = turnOffset({ x: halfX, z: halfZ }, turns);
  const reachX = Math.abs(corner.x);
  const reachZ = Math.abs(corner.z);
  return { min: { x: centre.x - reachX, z: centre.z - reachZ }, max: { x: centre.x + reachX, z: centre.z + reachZ } };
}

/** The rectangle `metres` wider on every side. */
export function widenRect(rect: GroundRect, metres: number): GroundRect {
  return { min: { x: rect.min.x - metres, z: rect.min.z - metres }, max: { x: rect.max.x + metres, z: rect.max.z + metres } };
}

/** Whether a spot lies in a rectangle, edges included. */
export function isInRect(rect: GroundRect, spot: GroundPoint): boolean {
  return spot.x >= rect.min.x && spot.x <= rect.max.x && spot.z >= rect.min.z && spot.z <= rect.max.z;
}

/** Whether two rectangles share some ground. Rectangles that only touch along an edge do not. */
export function rectsOverlap(a: GroundRect, b: GroundRect): boolean {
  return a.min.x < b.max.x && b.min.x < a.max.x && a.min.z < b.max.z && b.min.z < a.max.z;
}
