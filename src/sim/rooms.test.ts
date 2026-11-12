import { describe, expect, it } from "bun:test";
import { isWarmedByCampfire } from "./campfires";
import { edgeMiddle } from "./edge-pieces";
import { createEntityStore, type EntityStore } from "./entities";
import { foundationOn } from "./foundations";
import { findRooms, roomAround } from "./rooms";
import type { EdgePieceKind, QuarterTurns } from "./structure-kind";
import type { GroundPoint } from "./valley";

describe("finding rooms", () => {
  it("finds one foundation square closed in by four log walls, with a roof", () => {
    const entities = createEntityStore();
    const square = { x: 0.5, z: 0.5 };
    cabin(entities, [square]);

    expect(findRooms(entities)).toEqual([[square]]);
  });

  it("counts a door frame as closed", () => {
    const entities = createEntityStore();
    const square = { x: 0.5, z: 0.5 };
    cabin(entities, [square], { door: { square, side: 0 } });

    expect(findRooms(entities)).toEqual([[square]]);
  });

  it("finds no room when one wall is missing", () => {
    const entities = createEntityStore();
    const right = { x: 1.5, z: 0.5 };
    cabin(entities, [{ x: 0.5, z: 0.5 }, right]);
    removePiece(entities, right, 3);

    expect(findRooms(entities)).toEqual([]);
  });

  it("finds no room when one square has no roof", () => {
    const entities = createEntityStore();
    const squares = [
      { x: 0.5, z: 0.5 },
      { x: 1.5, z: 0.5 },
    ];
    cabin(entities, squares);
    const roof = entities.with("cabinRoof", "position").entities.find(({ position }) => position.x === 1.5);
    if (roof === undefined) throw new Error("No roof");
    entities.remove(roof);

    expect(findRooms(entities)).toEqual([]);
  });

  it("joins squares with no wall between them into one room", () => {
    const entities = createEntityStore();
    const squares = [
      { x: 0.5, z: 0.5 },
      { x: 1.5, z: 0.5 },
      { x: 1.5, z: 1.5 },
    ];
    cabin(entities, squares);

    const rooms = findRooms(entities);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toHaveLength(3);
    expect(rooms[0]).toEqual<unknown>(expect.arrayContaining(squares));
  });

  it("splits squares with a wall between them into two rooms", () => {
    const entities = createEntityStore();
    const left = { x: 0.5, z: 0.5 };
    const right = { x: 1.5, z: 0.5 };
    cabin(entities, [left, right]);
    pieceAt(entities, "logWall", left, 3);

    expect(findRooms(entities)).toEqual<unknown>(expect.arrayContaining([[left], [right]]));
    expect(findRooms(entities)).toHaveLength(2);
    expect(roomAround(entities, left)).toEqual([left]);
  });

  it("changes as soon as a piece is taken down or put back", () => {
    const entities = createEntityStore();
    const square = { x: 0.5, z: 0.5 };
    cabin(entities, [square]);

    removePiece(entities, square, 2);
    expect(findRooms(entities)).toEqual([]);
    expect(roomAround(entities, square)).toBeUndefined();

    pieceAt(entities, "doorFrame", square, 2);
    expect(roomAround(entities, square)).toEqual([square]);
  });

  it("finds no room on open ground or on a bare foundation", () => {
    const entities = createEntityStore();
    const square = { x: 0.5, z: 0.5 };
    expect(roomAround(entities, square)).toBeUndefined();

    foundationAt(entities, square);
    expect(findRooms(entities)).toEqual([]);
    expect(roomAround(entities, square)).toBeUndefined();
  });
});

describe("warmth in a room", () => {
  /** A long room of eight squares in a row, from x = 0.5 to x = 7.5. */
  const longRoom = Array.from({ length: 8 }, (_, i) => ({ x: i + 0.5, z: 0.5 }));

  it("reaches every square of the room from a lit campfire, however far", () => {
    const entities = createEntityStore();
    cabin(entities, longRoom);
    campfireAt(entities, { x: 0.5, z: 0.5 }, true);

    expect(isWarmedByCampfire(entities, { x: 7.5, z: 0.5 })).toBe(true);
    expect(isWarmedByCampfire(entities, { x: 7.9, z: 0.1 })).toBe(true);
  });

  it("does not come from a campfire that is out", () => {
    const entities = createEntityStore();
    cabin(entities, longRoom);
    campfireAt(entities, { x: 0.5, z: 0.5 }, false);

    expect(isWarmedByCampfire(entities, { x: 7.5, z: 0.5 })).toBe(false);
  });

  it("stops when the room is opened up", () => {
    const entities = createEntityStore();
    cabin(entities, longRoom);
    campfireAt(entities, { x: 0.5, z: 0.5 }, true);
    removePiece(entities, { x: 7.5, z: 0.5 }, 3);

    expect(isWarmedByCampfire(entities, { x: 7.5, z: 0.5 })).toBe(false);
    // Close to the fire, it still warms as any campfire does.
    expect(isWarmedByCampfire(entities, { x: 2.5, z: 0.5 })).toBe(true);
  });

  it("does not reach a room from a campfire outside it", () => {
    const entities = createEntityStore();
    cabin(entities, longRoom);
    campfireAt(entities, { x: -3, z: 0.5 }, true);

    expect(isWarmedByCampfire(entities, { x: 0.5, z: 0.5 })).toBe(true);
    expect(isWarmedByCampfire(entities, { x: 7.5, z: 0.5 })).toBe(false);
  });

  it("does not reach a room from a campfire on the ground at its outside corner", () => {
    const entities = createEntityStore();
    cabin(entities, longRoom);
    campfireAt(entities, { x: 0, z: 0 }, true);

    expect(isWarmedByCampfire(entities, { x: 7.5, z: 0.5 })).toBe(false);
  });

  it("does not reach another room", () => {
    const entities = createEntityStore();
    cabin(entities, longRoom);
    pieceAt(entities, "logWall", { x: 3.5, z: 0.5 }, 3);
    campfireAt(entities, { x: 0.5, z: 0.5 }, true);

    expect(isWarmedByCampfire(entities, { x: 3.5, z: 0.5 })).toBe(true);
    expect(isWarmedByCampfire(entities, { x: 6.5, z: 0.5 })).toBe(false);
  });
});

/** Adds a finished campfire. One on the middle of a foundation's square stands on that foundation, as a built one does. */
function campfireAt(entities: EntityStore, at: GroundPoint, lit: boolean): void {
  const foundation = foundationOn(entities, at);
  const onFoundation =
    foundation !== undefined && foundation.position.x === at.x && foundation.position.z === at.z ? { onFoundation: { x: at.x, z: at.z } } : {};
  entities.add({ campfire: { lit, fuelMinutes: lit ? 60 : 0 }, position: { x: at.x, y: 1, z: at.z }, ...onFoundation });
}

/** Adds finished foundations, roofs, and log walls on every outside edge of a set of squares. */
function cabin(entities: EntityStore, squares: readonly GroundPoint[], options: { door?: { square: GroundPoint; side: QuarterTurns } } = {}): void {
  for (const square of squares) foundationAt(entities, square);
  for (const square of squares) roofAt(entities, square);
  for (const square of squares) {
    for (const side of SIDES) {
      if (squares.some((other) => isSquareBeside(square, side, other))) continue;
      const isDoor = options.door?.square === square && options.door.side === side;
      pieceAt(entities, isDoor ? "doorFrame" : "logWall", square, side);
    }
  }
}

function foundationAt(entities: EntityStore, square: GroundPoint): void {
  entities.add({ foundation: true, facing: { turns: 0 }, position: { x: square.x, y: 1, z: square.z } });
}

function roofAt(entities: EntityStore, square: GroundPoint): void {
  const roof = { min: { x: square.x - 0.5, z: square.z - 0.5 }, max: { x: square.x + 0.5, z: square.z + 0.5 } };
  entities.add({ cabinRoof: true, roof, position: { x: square.x, y: 1, z: square.z } });
}

function pieceAt(entities: EntityStore, kind: EdgePieceKind, square: GroundPoint, side: QuarterTurns): void {
  const edge = edgeMiddle(square, side);
  entities.add({ edgePiece: kind, facing: { turns: side }, position: { x: edge.x, y: 1, z: edge.z } });
}

function removePiece(entities: EntityStore, square: GroundPoint, side: QuarterTurns): void {
  const edge = edgeMiddle(square, side);
  const piece = entities
    .with("edgePiece", "position")
    .entities.find(({ position }) => Math.abs(position.x - edge.x) < 1e-6 && Math.abs(position.z - edge.z) < 1e-6);
  if (piece === undefined) throw new Error("No piece on that edge");
  entities.remove(piece);
}

function isSquareBeside(square: GroundPoint, side: QuarterTurns, other: GroundPoint): boolean {
  const edge = edgeMiddle(square, side);
  const beyond = { x: 2 * edge.x - square.x, z: 2 * edge.z - square.z };
  return Math.abs(beyond.x - other.x) < 1e-6 && Math.abs(beyond.z - other.z) < 1e-6;
}

const SIDES: readonly QuarterTurns[] = [0, 1, 2, 3];
