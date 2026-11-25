import { describe, expect, it } from "bun:test";
import { createEntityStore, type EntityStore, type Vec3 } from "../sim/entities";
import type { QuarterTurns } from "../sim/quarter-turns";
import { structureOf } from "../sim/structures";
import { cabinCutaway, everyCabinCutaway, isBetweenCameraAndPlayer, noCabinCutaway } from "./cabin-cutaway";

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

describe("the cabin cutaway turned on and off by hand", () => {
  it("on, hides the whole roof and fades every side facing the camera, even with the player outside", () => {
    const entities = cabin();
    const cutaway = everyCabinCutaway(entities, CORNER_CAMERA, { x: 6, y: 0, z: 6 });

    expect(cutaway.roof.length).toBe(4);
    for (const edge of NORTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(true);
    expect(cutaway.fades(EAST_EDGE, 1)).toBe(true);
    for (const edge of SOUTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(false);
    expect(cutaway.fades(WEST_EDGE, 1)).toBe(false);
  });

  it("off, hides no roof and fades only a wall between the camera and the player, even with the player inside", () => {
    const player = { x: WEST.x, y: 0, z: WEST.z };
    const cutaway = noCabinCutaway(CORNER_CAMERA, player);

    expect(cutaway.roof).toEqual([]);
    for (const edge of SOUTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(false);
    expect(cutaway.fades(EAST_EDGE, 1)).toBe(isBetweenCameraAndPlayer(EAST_EDGE, 1, CORNER_CAMERA, player));
  });
});

describe("the cabin cutaway", () => {
  it("hides the whole roof and fades every side facing the camera while the player is inside", () => {
    const entities = cabin();
    const cutaway = cabinCutaway(entities, CORNER_CAMERA, { x: WEST.x, y: 0, z: WEST.z });

    expect(cutaway.roof.length).toBe(4);
    for (const edge of NORTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(true);
    expect(cutaway.fades(EAST_EDGE, 1)).toBe(true);
    for (const edge of SOUTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(false);
    expect(cutaway.fades(WEST_EDGE, 1)).toBe(false);
  });

  it("treats a cabin with only its roof frames up as a cabin", () => {
    const entities = cabin(false);
    const cutaway = cabinCutaway(entities, CORNER_CAMERA, { x: EAST.x, y: 0, z: EAST.z });

    expect(cutaway.roof.length).toBe(2);
    for (const edge of NORTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(true);
    expect(cutaway.fades(EAST_EDGE, 1)).toBe(true);
    for (const edge of SOUTH_EDGES) expect(cutaway.fades(edge, 0)).toBe(false);
    expect(cutaway.fades(WEST_EDGE, 1)).toBe(false);
  });

  it("fades a whole side, even the part far from the line between the camera and the player", () => {
    const entities = cabin();
    const camera = { x: 0.5, y: 8, z: 10 };
    const player = { x: WEST.x, y: 0, z: WEST.z };
    const far = NORTH_EDGES[1] ?? DOOR;
    expect(isBetweenCameraAndPlayer(far, 0, camera, player)).toBe(false);
    expect(cabinCutaway(entities, camera, player).fades(far, 0)).toBe(true);
  });

  it("counts a player standing in the doorway as inside", () => {
    const entities = cabin();
    const inDoorway = cabinCutaway(entities, CORNER_CAMERA, { x: DOOR.x, y: 0, z: DOOR.z + 0.3 });
    expect(inDoorway.roof.length).toBe(4);
    expect(inDoorway.fades(EAST_EDGE, 1)).toBe(true);

    const pastDoorway = cabinCutaway(entities, CORNER_CAMERA, { x: DOOR.x, y: 0, z: DOOR.z + 0.8 });
    expect(pastDoorway.roof).toEqual([]);
  });

  it("hides nothing and fades only pieces in the way while the player is outside", () => {
    const entities = cabin();
    const away = cabinCutaway(entities, CORNER_CAMERA, { x: 20, y: 0, z: 20 });
    expect(away.roof).toEqual([]);
    for (const edge of NORTH_EDGES) expect(away.fades(edge, 0)).toBe(false);
    expect(away.fades(EAST_EDGE, 1)).toBe(false);

    // Behind the cabin, the side between the camera and the player still fades.
    const behind = cabinCutaway(entities, { x: 0.5, y: 4, z: 8 }, { x: 0.5, y: 0, z: -1 });
    expect(behind.fades(DOOR, 0)).toBe(true);
  });
});
