import { describe, expect, it } from "bun:test";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { readSave, SNUG_ROOM_NOTICE_SAVE_VERSION, writeSave } from "./save";
import { structureOf, type EdgePieceKind } from "./structures";
import { isWalkable } from "./walk-map";

describe("warmth in a snug room", () => {
  it("drains half as much in one night hour as in the same room without a door", () => {
    const snug = createGame({ seed: 42 });
    const [snugSquare] = cabinNearPlayer(snug, { door: true });
    const draughty = createGame({ seed: 42 });
    const [draughtySquare] = cabinNearPlayer(draughty, { door: false });
    standOn(snug, snugSquare);
    standOn(draughty, draughtySquare);

    const snugLoss = warmthLostInOneNightHour(snug);
    const draughtyLoss = warmthLostInOneNightHour(draughty);

    expect(draughtyLoss).toBeCloseTo(0.25, 2);
    expect(snugLoss).toBeCloseTo(draughtyLoss / 2, 2);
  });

  it("drains at the usual rate once the door is taken down", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game, { door: true });
    standOn(game, square);
    game.entities.remove(onlyDoor(game));

    expect(warmthLostInOneNightHour(game)).toBeCloseTo(0.25, 2);
  });

  it("rises by a lit fireplace in the room at night, as fast as in the same room without a door", () => {
    const rises = (door: boolean): number => {
      const game = createGame({ seed: 42 });
      const [first, second] = cabinNearPlayer(game, { door });
      standOn(game, first);
      game.client.send({ type: "skipTime", hours: 12 }); // 20:00, night starts.
      game.step();
      game.entities.add({ fireplace: { lit: true, fuelMinutes: 600 }, facing: { turns: 0 }, position: { x: second.x, y: deckTop(game, second), z: second.z } });
      onlyPlayer(game).needs.warmth.level = 0.2;
      game.client.send({ type: "skipTime", hours: 1 });
      game.step();
      return game.client.getView().warmth - 0.2;
    };

    expect(rises(true)).toBeGreaterThan(0);
    expect(rises(true)).toBeCloseTo(rises(false), 5);
  });

  it("stops being snug once the player takes down a floor, so warmth drains at the usual rate", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = cabinNearPlayer(game, { door: true });
    standOn(game, second);
    const floor = game.entities.with("floor", "position").entities.find(({ position }) => position.x === first.x && position.z === first.z);
    if (floor === undefined) throw new Error("No floor");

    game.client.send({ type: "takeDown", pieceId: idOf(game, floor) });
    stepUntil(game, () => !game.entities.has(floor));

    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);
    expect(warmthLostInOneNightHour(game)).toBeCloseTo(0.25, 2);
  });
});

describe("the snug room banner", () => {
  it("shows the first time the player stands in a snug room, and only once", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game, { door: true });
    game.step();
    expect(game.client.getView().notice).toBeNull();

    standOn(game, square);
    game.step();
    expect(game.client.getView().notice).toEqual({ kind: "snugRoomKeepsOutCold" });

    game.client.send({ type: "skipTime", hours: 1 });
    game.step();
    expect(game.client.getView().notice).toBeNull();
    walkOutAndBackIn(game, square);
    expect(game.client.getView().notice).toBeNull();
  });

  it("waits for a notice the same step shows to go, then shows, so no other notice swallows it", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game, { door: true });
    const foundation = game.entities.with("foundation", "position").entities.find(({ position }) => position.x === square.x && position.z === square.z);
    if (foundation === undefined) throw new Error("No foundation");
    standOn(game, square);
    // The floor holds the foundation up, so the game refuses to take it down and says so.
    game.client.send({ type: "takeDown", pieceId: idOf(game, foundation) });
    game.step();
    expect(game.client.getView().notice).toEqual({ kind: "holdsUpPiece" });
    expect(game.progress().snugRoomNoticeShown).toBe(false);

    stepUntil(game, () => game.client.getView().notice?.kind !== "holdsUpPiece");

    expect(game.client.getView().notice).toEqual({ kind: "snugRoomKeepsOutCold" });
    expect(game.progress().snugRoomNoticeShown).toBe(true);
  });

  it("does not show again after a save and load", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game, { door: true });
    standOn(game, square);
    game.step();
    game.client.send({ type: "skipTime", hours: 1 });
    game.step();

    const loaded = load(structuredClone(writeSave(game)));
    walkOutAndBackIn(loaded, square);

    expect(loaded.client.getView().notice).toBeNull();
    expect(loaded.progress().snugRoomNoticeShown).toBe(true);
  });

  it("is not yet shown in an older save, so it shows after loading", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game, { door: true });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as Record<string, unknown>;
    save.version = SNUG_ROOM_NOTICE_SAVE_VERSION - 1;
    delete save.snugRoomNoticeShown;

    const loaded = load(save);
    expect(loaded.progress().snugRoomNoticeShown).toBe(false);
    standOn(loaded, square);
    loaded.step();

    expect(loaded.client.getView().notice).toEqual({ kind: "snugRoomKeepsOutCold" });
  });
});

describe("snug rooms for the debug overlay", () => {
  it("says whether each room is snug", () => {
    const game = createGame({ seed: 42 });
    cabinNearPlayer(game, { door: true });
    expect(game.client.describeRooms()).toMatchObject([{ snug: true }]);

    game.entities.remove(onlyDoor(game));
    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);
  });
});

/** Moves the clock to 20:00, when night starts, then returns how much warmth one more game hour there drains. */
function warmthLostInOneNightHour(game: Game): number {
  game.client.send({ type: "skipTime", hours: 12 }); // 20:00, night starts.
  game.step();
  const before = game.client.getView().warmth;
  game.client.send({ type: "skipTime", hours: 1 });
  game.step();
  return before - game.client.getView().warmth;
}

/** Puts the player on open ground outside, steps, and then back on the square, and steps again. */
function walkOutAndBackIn(game: Game, square: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position = { x: square.x, y: player.position.y, z: square.z - 3 };
  player.previousPosition = { ...player.position };
  game.step();
  standOn(game, square);
  game.step();
}

/**
 * Builds a finished room of two foundation squares in a row along +x near the player, with a floor on each square,
 * log walls all round except a door frame on the first square's outer end, and a roof on every square.
 * With `door`, a finished door hangs in the frame. Returns the squares' middles.
 */
function cabinNearPlayer(game: Game, { door }: { door: boolean }): [GroundPoint, GroundPoint] {
  const start = openRowNearPlayer(game, 2);
  const squares: [GroundPoint, GroundPoint] = [start, { x: start.x + 1, z: start.z }];
  for (const square of squares) finished(game, "foundation", square);
  for (const square of squares) finished(game, "roof", square);
  for (const square of squares) game.entities.add({ floor: true, position: { x: square.x, y: deckTop(game, square), z: square.z } });
  const [first, second] = squares;
  for (const side of [0, 2] as const) {
    finishedEdge(game, "logWall", first, side);
    finishedEdge(game, "logWall", second, side);
  }
  finishedEdge(game, "doorFrame", first, 1);
  finishedEdge(game, "logWall", second, 3);
  if (door) {
    const edge = edgeMiddle(first, 1);
    game.entities.add({ door: true, facing: { turns: 1 }, position: { x: edge.x, y: deckTop(game, first), z: edge.z } });
  }
  return squares;
}

function deckTop(game: Game, square: GroundPoint): number {
  return foundationDeckTop(game.valley.terrain, square);
}

/** Adds a finished structure, as if the player had built it. */
function finished(game: Game, kind: "foundation" | "roof", square: GroundPoint): Entity {
  return game.entities.add({
    ...structureOf(kind).finish(square, 0, game.entities),
    facing: { turns: 0 },
    position: { x: square.x, y: deckTop(game, square), z: square.z },
  });
}

function finishedEdge(game: Game, kind: EdgePieceKind, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  return game.entities.add({ ...structureOf(kind).finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y: 0, z: edge.z } });
}

function onlyDoor(game: Game): Entity {
  const door = game.entities.with("door", "position").first;
  if (door === undefined) throw new Error("No door");
  return door;
}

/** Puts the player straight onto a square, as if they had walked there. */
function standOn(game: Game, square: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position = { x: square.x, y: deckTop(game, square), z: square.z };
  player.previousPosition = { ...player.position };
}

/** The middle of the first square of an open row of squares near the player, with open ground a square all round it. */
function openRowNearPlayer(game: Game, length: number): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 40; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const start = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const xs = Array.from({ length: length + 2 }, (_, i) => start.x - 1 + i);
      const open = xs.every((x) => [-1, 0, 1].every((az) => isWalkable(game.walkMap, { x, z: start.z + az })));
      const placeable = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z })).every(
        (square) => game.client.checkPlacement("foundation", square, 0).allowed,
      );
      if (open && placeable) return start;
    }
  }
  throw new Error("No open row");
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function load(save: unknown): Game {
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error("The save did not load");
  return loaded.game;
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "previousPosition", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}
