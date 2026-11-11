import { describe, expect, it } from "vitest";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST, structureOf, type EdgePieceKind, type QuarterTurns } from "./structures";
import type { GroundPoint } from "./valley";
import { isWalkable } from "./walk-map";

describe("a campfire in a room", () => {
  it("can go on a foundation inside a room, in the middle of its square, at the height of the deck", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 2);
    const [first] = squares;

    const check = game.client.checkPlacement("campfire", { x: first.x + 0.3, z: first.z - 0.2 }, 0);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: first.x, z: first.z });
    expect(check.spot.y).toBeCloseTo(foundationDeckTop(game.valley.terrain, first), 5);
  });

  it("cannot go on a foundation that is not in a room", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 2);
    const [first, second] = squares;

    takeDown(game, wallOn(game, second, 3));

    expect(game.client.checkPlacement("campfire", first, 0).allowed).toBe(false);
  });

  it("is built standing on the foundation, and says which square it is on", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 2);
    standOn(game, second);

    const campfire = buildCampfire(game, first);

    expect(campfire.onFoundation).toEqual({ x: first.x, z: first.z });
    expect(campfire.position?.y).toBeCloseTo(foundationDeckTop(game.valley.terrain, first), 5);
  });

  it("keeps the player warm at night at the far end of a long room when lit", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 7);
    const [first] = squares;
    const far = squares.at(-1) ?? first;
    standOn(game, squares[1]);
    const campfire = buildCampfire(game, first);
    standOn(game, far);

    game.client.send({ type: "skipTime", hours: 14 }); // 22:00, two hours into the night.
    game.step();
    const chilled = game.client.getView().warmth;
    expect(chilled).toBeLessThan(0.6);

    if (campfire.campfire === undefined) throw new Error("No campfire");
    campfire.campfire.fuelMinutes = 8 * 60;
    campfire.campfire.lit = true;
    runGameMinutes(game, 30);

    expect(game.client.getView().warmth).toBeGreaterThan(chilled + 0.2);
  });
});

describe("rooms for the debug overlay", () => {
  it("lists each room's squares, and whether a lit campfire heats it", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.describeRooms()).toEqual([]);

    const squares = roomNearPlayer(game, 3);
    const [first, second] = squares;
    const byX = (a: GroundPoint, b: GroundPoint) => a.x - b.x;
    const rooms = () => game.client.describeRooms().map((room) => ({ squares: [...room.squares].sort(byX), heated: room.heated }));
    expect(rooms()).toEqual([{ squares, heated: false }]);

    standOn(game, second);
    const campfire = buildCampfire(game, first);
    if (campfire.campfire === undefined) throw new Error("No campfire");
    campfire.campfire.fuelMinutes = 60;
    campfire.campfire.lit = true;
    expect(rooms()).toEqual([{ squares, heated: true }]);

    takeDown(game, wallOn(game, first, 1));
    expect(game.client.describeRooms()).toEqual([]);
  });
});

/**
 * Builds a finished room of `length` foundation squares in a row along +x near the player, with log walls all round and a roof
 * on every square. Returns the squares' middles, in order.
 */
function roomNearPlayer(game: Game, length: number): [GroundPoint, GroundPoint, ...GroundPoint[]] {
  const start = openRowNearPlayer(game, length);
  const squares = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z }));
  for (const square of squares) finished(game, "foundation", square, 0, foundationDeckTop(game.valley.terrain, square));
  squares.forEach((square, i) => {
    const sides: QuarterTurns[] = [0, 2];
    if (i === 0) sides.push(1);
    if (i === length - 1) sides.push(3);
    for (const side of sides) finishedEdge(game, "logWall", square, side);
  });
  for (const square of squares) finished(game, "roof", square, 0, foundationDeckTop(game.valley.terrain, square));
  const [first, second, ...rest] = squares;
  if (first === undefined || second === undefined) throw new Error("A room here needs at least two squares");
  return [first, second, ...rest];
}

/** Adds a finished structure, as if the player had built it. */
function finished(game: Game, kind: "foundation" | "roof", square: GroundPoint, turns: QuarterTurns, y: number): Entity {
  return game.entities.add({ ...structureOf(kind).finish(square, turns, game.entities), facing: { turns }, position: { x: square.x, y, z: square.z } });
}

function finishedEdge(game: Game, kind: EdgePieceKind, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  return game.entities.add({ ...structureOf(kind).finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y: 0, z: edge.z } });
}

function wallOn(game: Game, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  const wall = game.entities.with("edgePiece", "position").entities.find(({ position }) => Math.abs(position.x - edge.x) < 1e-6 && Math.abs(position.z - edge.z) < 1e-6);
  if (wall === undefined) throw new Error("No wall there");
  return wall;
}

function takeDown(game: Game, entity: Entity): void {
  game.entities.remove(entity);
}

/** Puts the player straight onto a square, as if they had walked there. */
function standOn(game: Game, square: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  player.previousPosition = { ...player.position };
}

/** Places a campfire blueprint on a square and builds it, from where the player stands. */
function buildCampfire(game: Game, square: GroundPoint): Entity {
  const backpack = onlyPlayer(game).backpack;
  backpack.contents.stick = (backpack.contents.stick ?? 0) + CAMPFIRE_STICK_COST;
  game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: square.x, z: square.z });
  game.step();
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("The blueprint was not placed");
  const id = game.entities.id(blueprint);
  if (id === undefined) throw new Error("No id");
  game.client.send({ type: "build", blueprintId: id });
  game.step();
  for (let i = 0; i < (CAMPFIRE_BUILD_SECONDS + 1) * STEPS_PER_SECOND; i += 1) game.step();
  const campfire = game.entities.with("campfire", "position").first;
  if (campfire === undefined) throw new Error("No campfire");
  return campfire;
}

/** The middle of the first square of an open row of squares near the player, with open ground a square all round it. */
function openRowNearPlayer(game: Game, length: number): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 40; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0]] as const) {
      const start = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const xs = Array.from({ length: length + 2 }, (_, i) => start.x - 1 + i);
      const open = xs.every((x) => [-1, 0, 1].every((az) => isWalkable(game.walkMap, { x, z: start.z + az })));
      const placeable = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z })).every((square) => game.client.checkPlacement("foundation", square, 0).allowed);
      if (open && placeable) return start;
    }
  }
  throw new Error("No open row");
}

function runGameMinutes(game: Game, minutes: number): void {
  for (let i = 0; i < minutes * STEPS_PER_SECOND; i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "previousPosition", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}
