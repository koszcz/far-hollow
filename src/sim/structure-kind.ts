// Names shared by entities and the structure catalogue in structures.ts. Kept apart so neither imports the other.
import type { GroundPoint } from "./valley";

/** Every structure the build menu can list. Each later shelter structure adds its name here and its entry to STRUCTURES. */
export type StructureKind = "campfire" | "leanTo" | "foundation" | EdgePieceKind | "roof" | "woodpile" | FurnitureKind | WorkStationKind;

/** The work stations the build menu can list. A work station is a built object where the player does one kind of processing. */
export type WorkStationKind = "sawhorse";

/** The pieces of furniture the build menu can list. Furniture is placed freely and does not snap to the building grid. */
export type FurnitureKind = "chest";

/** The building pieces that stand on the edge of a foundation square, on the line between it and the square beside it. */
export type EdgePieceKind = "logWall" | "doorFrame";

/** Which way a structure faces: how many quarter turns clockwise, seen from above, from 0 to 3. */
export type QuarterTurns = 0 | 1 | 2 | 3;

/** The four sides of a grid square, as `edgeMiddle` in edge-pieces.ts numbers them. */
export const SIDES: readonly QuarterTurns[] = [0, 1, 2, 3];

/**
 * The materials the player carries to a blueprint on their shoulder, one at a time, such as a debarked log.
 * They are too big for the backpack, so construction spends them from what was carried to the blueprint.
 */
export type DeliveredMaterial = "debarkedLog";

/** A rectangle of ground with sides along x and z, from its `min` corner to its `max` corner, in metres. */
export interface GroundRect {
  readonly min: GroundPoint;
  readonly max: GroundPoint;
}

/**
 * Turns an offset from a structure's centre the way the structure faces.
 * It matches how the renderer turns a structure's shape, so the drawn shape and the game's rules line up.
 */
export function turnOffset(offset: GroundPoint, turns: QuarterTurns): GroundPoint {
  switch (turns) {
    case 0:
      return { x: offset.x, z: offset.z };
    case 1:
      return { x: -offset.z, z: offset.x };
    case 2:
      return { x: -offset.x, z: -offset.z };
    case 3:
      return { x: offset.z, z: -offset.x };
  }
}

/** The rectangle covering a box of `halfX` by `halfZ` metres either side of `centre`, turned the way the structure faces. */
export function turnedRect(centre: GroundPoint, halfX: number, halfZ: number, turns: QuarterTurns): GroundRect {
  const corner = turnOffset({ x: halfX, z: halfZ }, turns);
  const reachX = Math.abs(corner.x);
  const reachZ = Math.abs(corner.z);
  return { min: { x: centre.x - reachX, z: centre.z - reachZ }, max: { x: centre.x + reachX, z: centre.z + reachZ } };
}

/** Whether a spot lies in a rectangle, edges included. */
export function isInRect(rect: GroundRect, spot: GroundPoint): boolean {
  return spot.x >= rect.min.x && spot.x <= rect.max.x && spot.z >= rect.min.z && spot.z <= rect.max.z;
}

/** Whether two rectangles share some ground. Rectangles that only touch along an edge do not. */
export function rectsOverlap(a: GroundRect, b: GroundRect): boolean {
  return a.min.x < b.max.x && b.min.x < a.max.x && a.min.z < b.max.z && b.min.z < a.max.z;
}
