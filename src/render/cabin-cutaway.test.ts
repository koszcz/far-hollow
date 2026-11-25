import { describe, expect, it } from "bun:test";
import { createEntityStore, type EntityStore, type Vec3 } from "../sim/entities";
import type { QuarterTurns } from "../sim/quarter-turns";
import { structureOf } from "../sim/structures";
import { cabinCutaway, isBetweenCameraAndPlayer } from "./cabin-cutaway";

// A cabin two squares long along x, from x = 0 to 2 and z = 0 to 1, with its door in the middle of the +z side.
const WEST = { x: 0.5, z: 0.5 };
const EAST = { x: 1.5, z: 0.5 };
const DOOR = { x: 0.5, y: 0, z: 1 };
/** Each outer edge of the cabin: its middle and the way the piece on it faces. */
const NORTH_EDGES = [DOOR, { x: 1.5, y: 0, z: 1 }];
const SOUTH_EDGES = [
  { x: 0.5, y: 0, z: 0 },
  { x: 1.5, y: 0, z: 0 },
];
const EAST_EDGE = { x: 2, y: 0, z: 0.5 };
const WEST_EDGE = { x: 0, y: 0, z: 0.5 };
/** Up and away beyond the cabin's +x, +z corner. */
const CORNER_CAMERA = { x: 10, y: 8, z: 10 };

function cabin(roofOn = true): EntityStore {
  const entities = createEntityStore();
  for (const square of [WEST, EAST]) {
    entities.add({ foundation: true, facing: { turns: 0 }, position: { x: square.x, y: 0, z: square.z } });
    for (const kind of roofOn ? (["roofFrame", "roof"] as const) : (["roofFrame"] as const)) {
      entities.add({ ...structureOf(kind).finish(square, 0, entities), facing: { turns: 0 }, position: { x: square.x, y: 0, z: square.z } });
    }
  }
  const wall = (position: Vec3, turns: QuarterTurns, kind: "logWall" | "doorFrame" = "logWall") =>
    entities.add({ edgePiece: kind, facing: { turns }, position });
  wall(DOOR, 0, "doorFrame");
  wall(NORTH_EDGES[1] ?? DOOR, 0);
  for (const edge of SOUTH_EDGES) wall(edge, 0);
  wall(EAST_EDGE, 1);
  wall(WEST_EDGE, 1);
  return entities;
}

describe("what hides and fades in each wall mode", () => {
  const inside = { x: WEST.x, y: 0, z: WEST.z };
  const outside = { x: 20, y: 0, z: 20 };

  it("in walls up, hides no roof and fades no side, with the player inside or outside", () => {
    const entities = cabin();
    for (const player of [inside, outside]) {
      const cutaway = cabinCutaway(entities, "wallsUp", CORNER_CAMERA, player);
      expect(cutaway.roof).toEqual([]);
      for (const edge of [...NORTH_EDGES, ...SOUTH_EDGES]) expect(cutaway.fades(edge, 0)).toBe(isBetweenCameraAndPlayer(edge, 0, CORNER_CAMERA, player));
      for (const edge of [EAST_EDGE, WEST_EDGE]) expect(cutaway.fades(edge, 1)).toBe(isBetweenCameraAndPlayer(edge, 1, CORNER_CAMERA, player));
    }
    expect(cabinCutaway(entities, "wallsUp", CORNER_CAMERA, outside).fades(EAST_EDGE, 1)).toBe(false);
  });

  it("in cutaway, hides the whole roof and fades only the sides facing the camera, with the player inside or outside", () => {
    const entities = cabin();
    for (const player of [inside, outside]) {
      const cutaway = cabinCutaway(entities, "cutaway", CORNER_CAMERA, player);
      expect(cutaway.roof.length).toBe(4);
      for (const edge of NORTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(true);
      expect(cutaway.fades(EAST_EDGE, 1)).toBe(true);
      for (const edge of SOUTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(false);
      expect(cutaway.fades(WEST_EDGE, 1)).toBe(false);
    }
  });

  it("in walls down, hides the whole roof and fades every side, with the player inside or outside", () => {
    const entities = cabin();
    for (const player of [inside, outside]) {
      const cutaway = cabinCutaway(entities, "wallsDown", CORNER_CAMERA, player);
      expect(cutaway.roof.length).toBe(4);
      for (const edge of [...NORTH_EDGES, ...SOUTH_EDGES]) expect(cutaway.fades(edge, 0)).toBe(true);
      for (const edge of [EAST_EDGE, WEST_EDGE]) expect(cutaway.fades(edge, 1)).toBe(true);
    }
  });

  it("treats a cabin with only its roof frames up as a cabin", () => {
    const entities = cabin(false);
    const cutaway = cabinCutaway(entities, "cutaway", CORNER_CAMERA, outside);
    expect(cutaway.roof.length).toBe(2);
    for (const edge of NORTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(true);
    for (const edge of SOUTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(false);
  });

  it("fades a whole side in cutaway, even the part far from the line between the camera and the player", () => {
    const entities = cabin();
    const camera = { x: 0.5, y: 8, z: 10 };
    const far = NORTH_EDGES[1] ?? DOOR;
    expect(isBetweenCameraAndPlayer(far, 0, camera, inside)).toBe(false);
    expect(cabinCutaway(entities, "cutaway", camera, inside).fades(far, 0)).toBe(true);
  });

  it("fades a side between the camera and the player in every wall mode", () => {
    const entities = cabin();
    // Behind the cabin, looking through its door side at the player.
    for (const mode of ["wallsUp", "cutaway", "wallsDown"] as const) {
      expect(cabinCutaway(entities, mode, { x: 0.5, y: 4, z: 8 }, { x: 0.5, y: 0, z: -1 }).fades(DOOR, 0)).toBe(true);
    }
  });
});
