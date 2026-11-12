import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { edgePieceOn } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { DOOR_FRAME_LOG_COST, LOG_WALL_BUILD_SECONDS, LOG_WALL_LOG_COST, type QuarterTurns, type StructureKind } from "./structures";
import { isWalkable } from "./walk-map";

describe("log walls and door frames in the build menu", () => {
  it("lists the log wall and the door frame, each with its cost in debarked logs", () => {
    const game = createGame({ seed: 42 });
    const menu = game.client.getView().buildMenu;

    expect(menu).toContainEqual({ structure: "logWall", cost: [{ material: "debarkedLog", count: LOG_WALL_LOG_COST }], placement: "onEdge" });
    expect(menu).toContainEqual({ structure: "doorFrame", cost: [{ material: "debarkedLog", count: DOOR_FRAME_LOG_COST }], placement: "onEdge" });
  });
});

describe("snapping a wall to the edge of a foundation", () => {
  it("snaps to the edge of the finished foundation under the mouse, and R picks which edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    const near = { x: square.x + 0.2, z: square.z - 0.1 };

    const spots = ([0, 1, 2, 3] as const).map((turns) => game.client.checkPlacement("logWall", near, turns));

    expect(spots.map(({ spot }) => [spot.x - square.x, spot.z - square.z])).toEqual([
      [0, 0.5],
      [-0.5, 0],
      [0, -0.5],
      [0.5, 0],
    ]);
    for (const { allowed, spot } of spots) {
      expect(allowed).toBe(true);
      // It stands on the deck.
      expect(spot.y).toBeCloseTo(foundation.position.y, 5);
    }
  });

  it("snaps a door frame the same way", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);

    const check = game.client.checkPlacement("doorFrame", square, 3);

    expect(check).toMatchObject({ allowed: true, spot: { x: square.x + 0.5, z: square.z } });
  });

  it("refuses an edge with no finished foundation beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    expect(game.client.checkPlacement("logWall", square, 0).allowed).toBe(false);
    // A foundation blueprint is not enough.
    send(game, { type: "placeBlueprint", structure: "foundation", turns: 0, x: square.x, z: square.z });
    expect(game.client.checkPlacement("logWall", square, 0).allowed).toBe(false);
    send(game, place("logWall", square, 0));
    expect(game.entities.with("blueprint").entities.every(({ blueprint }) => blueprint.structure === "foundation")).toBe(true);
  });

  it("places a blueprint on the edge, facing the way R picked", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);

    send(game, place("logWall", square, 1));

    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "logWall", progress: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: square.x - 0.5, z: square.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });
});

describe("one piece on each edge", () => {
  it("refuses a second wall or door frame on the same edge of one foundation", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);

    send(game, place("logWall", square, 0));

    expect(game.client.checkPlacement("logWall", square, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("doorFrame", square, 0).allowed).toBe(false);
    // The other edges are still free.
    expect(game.client.checkPlacement("doorFrame", square, 2).allowed).toBe(true);
  });

  it("refuses the edge where two foundations meet, once either has a piece on it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);

    // The +x edge of the first square is the -x edge of the one beside it.
    send(game, place("doorFrame", square, 3));
    expect(game.client.checkPlacement("logWall", beside, 1)).toMatchObject({ allowed: false, spot: { x: square.x + 0.5, z: square.z } });
    send(game, place("logWall", beside, 1));

    expect(game.entities.with("blueprint").size).toBe(1);
  });

  it("refuses the shared edge once a finished piece stands on it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x, z: square.z + 1 };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);

    finishedPieceAt(game, "logWall", square, 0);

    expect(game.client.checkPlacement("doorFrame", beside, 2).allowed).toBe(false);
    expect(game.client.checkPlacement("doorFrame", beside, 0).allowed).toBe(true);
  });
});

describe("no door frames at corners", () => {
  it("refuses a door frame where a wall meets its end at a corner", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("logWall", square, 1));

    // The +z and -z edges each share a corner with the -x wall. The +x edge does not.
    expect(game.client.checkPlacement("doorFrame", square, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("doorFrame", square, 2).allowed).toBe(false);
    expect(game.client.checkPlacement("doorFrame", square, 3).allowed).toBe(true);
    // Walls still meet at corners.
    expect(game.client.checkPlacement("logWall", square, 0).allowed).toBe(true);
  });

  it("refuses a wall that would meet a door frame at a corner, whichever is placed first", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "doorFrame", square, 0);

    expect(game.client.checkPlacement("logWall", square, 1).allowed).toBe(false);
    expect(game.client.checkPlacement("logWall", square, 3).allowed).toBe(false);
    expect(game.client.checkPlacement("logWall", square, 2).allowed).toBe(true);
  });

  it("allows a door frame in line with walls on either side", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const left = { x: square.x - 1, z: square.z };
    const right = { x: square.x + 1, z: square.z };
    for (const each of [left, square, right]) finishedFoundationAt(game, each);
    send(game, place("logWall", left, 0));
    send(game, place("logWall", right, 0));

    expect(game.client.checkPlacement("doorFrame", square, 0).allowed).toBe(true);
  });
});

describe("which pieces stand on a foundation square's edges", () => {
  it("names the finished piece on each side of a square, seen from either square beside the edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);

    // Both pieces on the square run along z, so the door frame stands at no corner.
    finishedPieceAt(game, "logWall", square, 1);
    finishedPieceAt(game, "doorFrame", square, 3);
    send(game, place("logWall", beside, 3));

    expect(([0, 1, 2, 3] as const).map((side) => edgePieceOn(game.entities, square, side))).toEqual([undefined, "logWall", undefined, "doorFrame"]);
    expect(edgePieceOn(game.entities, beside, 1)).toBe("doorFrame");
    // A blueprint is not a finished piece.
    expect(edgePieceOn(game.entities, beside, 3)).toBeUndefined();
  });
});

describe("building a log wall", () => {
  it("spends delivered debarked logs stage by stage, like a foundation, and finishes on the edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("logWall", square, 0));
    const blueprint = onlyBlueprint(game);
    const id = idOf(game, blueprint);

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, 2);
    // Nothing is built before a log is delivered.
    expect(blueprint.blueprint?.progress).toBe(0);

    for (let i = 0; i < LOG_WALL_LOG_COST; i += 1) {
      game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
      send(game, { type: "deliverToBlueprint", blueprintId: id });
      stepUntil(game, () => game.client.getView().carrying === null);
    }
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "debarkedLog", has: LOG_WALL_LOG_COST, needs: LOG_WALL_LOG_COST }]);
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, LOG_WALL_BUILD_SECONDS + 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.edgePiece).toBe("logWall");
    expect(blueprint.position).toMatchObject({ x: square.x, z: square.z + 0.5 });
  });
});

describe("walking around walls", () => {
  it("cannot walk into a foundation square with a finished wall on every side", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    for (const side of [0, 1, 2, 3] as const) finishedPieceAt(game, "logWall", square, side);
    const player = onlyPlayer(game);

    send(game, { type: "walkTo", x: square.x, z: square.z });
    stepUntil(game, () => player.walkPath === undefined);

    expect(isOnSquare(player.position, square)).toBe(false);
    expect(Math.hypot(player.position.x - square.x, player.position.z - square.z)).toBeLessThan(1.6);
  });

  it("walks in through a door frame, and only through it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    // Three squares in a row, walled all round, with the door in the middle of the +z side, away from the corners.
    const left = { x: square.x - 1, z: square.z };
    const right = { x: square.x + 1, z: square.z };
    for (const each of [left, square, right]) finishedFoundationAt(game, each);
    for (const each of [left, square, right]) finishedPieceAt(game, "logWall", each, 2);
    finishedPieceAt(game, "logWall", left, 0);
    finishedPieceAt(game, "logWall", right, 0);
    finishedPieceAt(game, "logWall", left, 1);
    finishedPieceAt(game, "logWall", right, 3);
    finishedPieceAt(game, "doorFrame", square, 0);
    const player = onlyPlayer(game);
    // Start on the far side from the door, so the way in goes round the walls.
    send(game, { type: "walkTo", x: square.x, z: square.z - 2 });
    stepUntil(game, () => player.walkPath === undefined);

    const trail: { x: number; z: number }[] = [];
    send(game, { type: "walkTo", x: square.x, z: square.z });
    stepUntil(game, () => {
      trail.push({ x: player.position.x, z: player.position.z });
      return player.walkPath === undefined;
    });

    expect(player.position).toMatchObject({ x: square.x, z: square.z });
    // The player came in from the +z side, where the door frame is.
    const cameIn = trail.findIndex((spot) => isOnSquare(spot, square));
    expect(trail[cameIn - 1]?.z).toBeGreaterThan(square.z + 0.5);
  });

  it("lets the player walk across a wall's edge while it is still a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    for (const side of [0, 1, 2, 3] as const) send(game, place("logWall", square, side));
    const player = onlyPlayer(game);

    send(game, { type: "walkTo", x: square.x, z: square.z });
    stepUntil(game, () => player.walkPath === undefined);

    expect(player.position).toMatchObject({ x: square.x, z: square.z });
  });
});

function isOnSquare(spot: { x: number; z: number }, square: { x: number; z: number }): boolean {
  return Math.abs(spot.x - square.x) < 0.5 && Math.abs(spot.z - square.z) < 0.5;
}

/** Places a blueprint and builds it through to the end, delivering every debarked log it needs. */
function finishedPieceAt(game: Game, structure: "logWall" | "doorFrame", square: { x: number; z: number }, turns: QuarterTurns): Entity {
  send(game, place(structure, square, turns));
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.structure !== structure) throw new Error("The blueprint was not placed");
  const cost = structure === "logWall" ? LOG_WALL_LOG_COST : DOOR_FRAME_LOG_COST;
  for (let i = 0; i < cost; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

/** Puts a finished foundation on a square, as if the player had built it. */
function finishedFoundationAt(game: Game, square: { x: number; z: number }) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground two squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-2, -1, 0, 1, 2];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
}

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
