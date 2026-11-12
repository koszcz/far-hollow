// What may share ground with a cabin's building pieces, and where things land on a foundation's deck.
import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, type Game } from "./game";
import { structureOf, type EdgePieceKind, type QuarterTurns, type StructureKind } from "./structures";
import type { GroundPoint } from "./valley";
import { isWalkable } from "./walk-map";

describe("a lean-to and foundations", () => {
  it("cannot go over a finished foundation", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    finishedFoundationAt(game, { x: spot.x + 0.5, z: spot.z + 0.5 });

    expect(game.client.checkPlacement("leanTo", spot, 0).allowed).toBe(false);
  });

  it("holds up a foundation it stands over, such as one from an older save", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    const foundation = finishedFoundationAt(game, { x: spot.x + 0.5, z: spot.z + 0.5 });
    finished(game, "leanTo", spot, 0, foundation.position.y);

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });

    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
  });
});

describe("a campfire beside a cabin", () => {
  it("cannot go on open ground where it would overlap a foundation", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const corner = { x: square.x + 0.5, z: square.z + 0.5 };

    // Just off the foundation, the campfire snaps to the grid point at its corner.
    const check = game.client.checkPlacement("campfire", { x: corner.x + 0.1, z: corner.z + 0.1 }, 0);

    expect(check.spot).toMatchObject(corner);
    expect(check.allowed).toBe(false);
  });

  it("cannot go on open ground where it would overlap a log wall", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedEdge(game, "logWall", square, 0);
    // Without the foundation, only the wall is in the way of a campfire at the grid point where the wall ends.
    game.entities.remove(foundationOn(game, square));
    const wallEnd = { x: square.x + 0.5, z: square.z + 0.5 };

    const check = game.client.checkPlacement("campfire", wallEnd, 0);

    expect(check.spot).toMatchObject(wallEnd);
    expect(check.allowed).toBe(false);
  });

  it("keeps a log wall or door frame off the edge it stands across, finished or as a blueprint", () => {
    for (const kind of ["finished", "blueprint"] as const) {
      const game = createGame({ seed: 42 });
      const square = openSquareNearPlayer(game);
      finishedFoundationAt(game, square);
      const onEdge = { x: square.x + 0.5, z: square.z + 0.5 };
      const y = foundationDeckTop(game.valley.terrain, square);
      if (kind === "finished") game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { ...onEdge, y } });
      else game.entities.add({ blueprint: { structure: "campfire", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 }, position: { ...onEdge, y } });

      expect(game.client.checkPlacement("logWall", square, 0).allowed).toBe(false);
      expect(game.client.checkPlacement("doorFrame", square, 3).allowed).toBe(false);
      // The far edges of the square are clear of it.
      expect(game.client.checkPlacement("logWall", square, 2).allowed).toBe(true);
    }
  });
});

describe("things lying where a foundation or roof frame would go", () => {
  it("keep a foundation off their square", () => {
    for (const thing of lyingThings()) {
      const game = createGame({ seed: 42 });
      const square = openSquareNearPlayer(game);
      game.entities.add({ ...thing, position: { x: square.x + 0.2, y: 0, z: square.z - 0.1 } });

      expect(game.client.checkPlacement("foundation", square, 0).allowed).toBe(false);
    }
  });

  it("keep a roof frame off the square they lie on", () => {
    for (const thing of lyingThings()) {
      const game = createGame({ seed: 42 });
      const square = openSquareNearPlayer(game);
      const foundation = finishedFoundationAt(game, square);
      finishedEdge(game, "logWall", square, 2);
      expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(true);
      game.entities.add({ ...thing, position: { x: square.x + 0.2, y: foundation.position.y, z: square.z } });

      expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);
    }
  });
});

describe("things set down on a foundation", () => {
  it("lie on its deck: a dropped debarked log and a laid bedroll", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    walkTo(game, square);
    expect(onlyPlayer(game).position.y).toBeCloseTo(foundation.position.y, 5);

    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "dropLog" });
    send(game, { type: "layBedroll" });

    expect(game.entities.with("debarkedLog", "position").first?.position.y).toBeCloseTo(foundation.position.y, 5);
    expect(game.entities.with("bedroll", "position").first?.position.y).toBeCloseTo(foundation.position.y, 5);
  });

  it("include the player waking after a collapse at a bedroll on a deck", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    walkTo(game, square);
    send(game, { type: "layBedroll" });
    const bedroll = game.entities.with("bedroll", "position").first;
    if (bedroll === undefined) throw new Error("No bedroll");
    send(game, { type: "skipTime", hours: 12 }); // 20:00, with no fire.

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });

    expect(game.client.getView().notice?.kind).toBe("collapsed");
    expect(onlyPlayer(game).position.y).toBeCloseTo(foundation.position.y, 5);
  });
});

/** The components of each thing that can lie on the ground: a log, a debarked log, a stick, a piece of bark, and a bedroll. */
function lyingThings(): Entity[] {
  return [{ log: { heading: 0 } }, { debarkedLog: { heading: 0 } }, { stick: true }, { bark: true }, { bedroll: true }];
}

/** Puts a finished foundation on a square, as if the player had built it. */
function finishedFoundationAt(game: Game, square: GroundPoint) {
  return finished(game, "foundation", square, 0, foundationDeckTop(game.valley.terrain, square));
}

/** Adds a finished structure, as if the player had built it. */
function finished(game: Game, kind: Exclude<StructureKind, EdgePieceKind>, spot: GroundPoint, turns: QuarterTurns, y: number) {
  return game.entities.add({ ...structureOf(kind).finish(spot, turns, game.entities), facing: { turns }, position: { x: spot.x, y, z: spot.z } });
}

/** Adds a finished log wall or door frame on one side of a square, as if the player had built it. */
function finishedEdge(game: Game, kind: EdgePieceKind, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  const y = foundationDeckTop(game.valley.terrain, square);
  return game.entities.add({ ...structureOf(kind).finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y, z: edge.z } });
}

function foundationOn(game: Game, square: GroundPoint): Entity {
  const foundation = game.entities.with("foundation", "position").entities.find(({ position }) => position.x === square.x && position.z === square.z);
  if (foundation === undefined) throw new Error("No foundation there");
  return foundation;
}

/** A spot near the player where a lean-to blueprint is allowed facing any way, with room to walk round it. */
function openLeanToSpot(game: Game): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 40; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const turns = [0, 1, 2, 3] as const;
      const roomy = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([ax = 0, az = 0]) =>
        turns.every((turn) => game.client.checkPlacement("leanTo", { x: spot.x + ax, z: spot.z + az }, turn).allowed),
      );
      if (roomy) return spot;
    }
  }
  throw new Error("No open spot");
}

/** The middle of a building-grid square a few metres from the player, with open ground two squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-2, -1, 0, 1, 2];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function walkTo(game: Game, to: GroundPoint): void {
  send(game, { type: "walkTo", ...to });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
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
