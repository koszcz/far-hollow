import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { QuarterTurns } from "./quarter-turns";
import { APPROACHES_SAVE_VERSION, FLOORS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { type StructureKind } from "./structure-kind";
import { FLOOR_BUILD_SECONDS, FLOOR_PLANK_COST } from "./structure-cabin-shell";
import { isWalkable } from "./walk-map";

describe("the floor in the build menu", () => {
  it("lists the floor with its cost of 2 planks and no tool, placed underfoot on a foundation", () => {
    const game = createGame({ seed: 42 });

    expect(FLOOR_PLANK_COST).toBe(2);
    expect(FLOOR_BUILD_SECONDS).toBe(4);
    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "floor",
      cost: [{ material: "plank", count: 2 }],
      placement: "underfoot",
      fixedFacing: true,
      inRows: true,
    });
  });
});

describe("where a floor can go", () => {
  it("snaps to the middle of the finished foundation square under the mouse, at the height of its deck", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);

    const check = game.client.checkPlacement("floor", { x: square.x + 0.3, z: square.z - 0.2 }, 0);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: square.x, z: square.z });
    expect(check.spot.y).toBeCloseTo(foundation.position.y, 5);
  });

  it("needs a finished foundation under it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    expect(game.client.checkPlacement("floor", square, 0).allowed).toBe(false);

    send(game, place("foundation", square));
    expect(game.client.checkPlacement("floor", square, 0).allowed).toBe(false);
  });

  it("takes one floor a square: a square with a floor or a floor blueprint takes no second one", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("floor", square));
    send(game, place("floor", beside));
    finish(game, lastBlueprint(game, "floor"));

    expect(game.client.checkPlacement("floor", square, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("floor", beside, 0).allowed).toBe(false);
  });

  it("goes on a square that holds furniture, a campfire, a fireplace, or walls, and nothing has to move", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const squares = [0, 1, 2, 3].map((dx) => ({ x: square.x + dx, z: square.z }));
    for (const at of squares) finishedFoundationAt(game, at);
    const [withTable, withFire, withFireplace, withWall] = squares as [Square, Square, Square, Square];
    const table = game.entities.add({ furniture: "table", facing: { turns: 0 }, position: { x: withTable.x, y: 0, z: withTable.z } });
    game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, onFoundation: withFire, position: { x: withFire.x, y: 0, z: withFire.z } });
    game.entities.add({ fireplace: { lit: false, fuelMinutes: 0 }, facing: { turns: 0 }, position: { x: withFireplace.x, y: 0, z: withFireplace.z } });
    game.entities.add({ edgePiece: "logWall", facing: { turns: 0 }, position: { x: withWall.x, y: 0, z: withWall.z + 0.5 } });

    for (const at of squares) expect(game.client.checkPlacement("floor", at, 0).allowed).toBe(true);
    expect(table.position).toEqual({ x: withTable.x, y: 0, z: withTable.z });
  });

  it("goes on a square with a fireplace blueprint, and a fireplace can go on a floor", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("fireplace", square));
    send(game, place("floor", beside));

    expect(game.client.checkPlacement("floor", square, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("fireplace", beside, 0).allowed).toBe(true);
  });

  it("lets furniture and a campfire go on a floor or its blueprint", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("floor", square));
    finish(game, lastBlueprint(game, "floor"));
    send(game, place("floor", beside));

    for (const at of [square, beside]) expect(game.client.checkPlacement("stool", at, 0).allowed).toBe(true);
  });
});

describe("building a floor", () => {
  it("takes 4 seconds of work in all, with 2 planks from the backpack and no tool", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("floor", square));
    const blueprint = lastBlueprint(game, "floor");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { plank: FLOOR_PLANK_COST };
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: FLOOR_PLANK_COST }]);

    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, FLOOR_BUILD_SECONDS - 0.5);
    expect(blueprint.blueprint).toBeDefined();
    expect(game.client.getView().backpack.plank ?? 0).toBe(0);
    runSeconds(game, 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.floor).toBe(true);
  });

  it("keeps the planks it has been given over several trips, and takes planks from a parked sled beside it and piles within 2 m", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("floor", square));
    const blueprint = lastBlueprint(game, "floor");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { plank: 1 };

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, FLOOR_BUILD_SECONDS + 2);
    expect(blueprint.blueprint).toMatchObject({ delivered: { plank: 1 }, materialsSpent: 1 });
    expect(game.client.describeBlueprint(id)?.lacks).toEqual({ kind: "material", material: "plank" });

    // A pile 1.5 m from the blueprint holds the last plank. One 3 m away is left alone.
    const near = game.entities.add({ pile: { content: "plank", count: 1 }, position: { x: square.x, y: 0, z: square.z - 0.5 - 1.5 } });
    const far = game.entities.add({ pile: { content: "plank", count: 3 }, position: { x: square.x, y: 0, z: square.z + 0.5 + 3 } });
    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(game.entities.has(near)).toBe(false);
    expect(far.pile.count).toBe(3);
    expect(blueprint.floor).toBe(true);
  });

  it("takes planks from a sled parked beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("floor", square));
    const blueprint = lastBlueprint(game, "floor");
    const sled = game.entities.add({
      sled: { log: 0, debarkedLog: 0, plank: 3 },
      facing: { turns: 0 },
      position: { x: square.x, y: 0, z: square.z - 2 },
    });
    onlyPlayer(game).backpack.contents = {};

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(sled.sled.plank).toBe(1);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const planksBefore = game.client.getView().backpack.plank;
    send(game, place("floor", square));
    const blueprint = lastBlueprint(game, "floor");

    finish(game, blueprint);

    expect(blueprint.floor).toBe(true);
    expect(game.client.getView().backpack.plank).toBe(planksBefore);
  });
});

describe("walking on a floor", () => {
  it("leaves the square open to walk on, at the height of the deck", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    send(game, place("floor", square));
    expect(isWalkable(game.walkMap, square)).toBe(true);
    finish(game, lastBlueprint(game, "floor"));

    expect(isWalkable(game.walkMap, square)).toBe(true);
    send(game, { type: "walkTo", x: square.x, z: square.z });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    expect(onlyPlayer(game).position.y).toBeCloseTo(foundation.position.y, 5);
  });
});

describe("taking down a floor", () => {
  it("gives back the plank a blueprint has been given", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("floor", square));
    const blueprint = lastBlueprint(game, "floor");
    onlyPlayer(game).backpack.contents = { plank: 1 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);
    expect(game.client.getView().backpack.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().backpack.plank).toBe(1);
  });

  it("gives back 2 planks from a floor under a table, and the table stays where it was", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("floor", square));
    const floor = lastBlueprint(game, "floor");
    finish(game, floor);
    const table = game.entities.add({ furniture: "table", facing: { turns: 0 }, position: { x: square.x, y: floor.position.y, z: square.z } });
    const tableAt = { ...table.position };
    onlyPlayer(game).backpack.contents = {};
    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, floor) })).toBeNull();

    send(game, { type: "takeDown", pieceId: idOf(game, floor) });
    stepUntil(game, () => !game.entities.has(floor));

    expect(game.client.getView().backpack.plank).toBe(2);
    expect(game.entities.has(table)).toBe(true);
    expect(table.position).toEqual(tableAt);
  });
});

describe("taking down the foundation under a floor", () => {
  it("refuses while the foundation holds a floor blueprint, and allows it once the floor is gone", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    send(game, place("floor", square));
    const takeDownFoundation: Command = { type: "takeDown", pieceId: idOf(game, foundation) };

    expect(game.client.refusal(takeDownFoundation)).toEqual({ kind: "holdsUpPiece" });

    send(game, { type: "takeDown", pieceId: idOf(game, lastBlueprint(game, "floor")) });
    stepUntil(game, () => game.entities.with("blueprint").first === undefined);
    expect(game.client.refusal(takeDownFoundation)).toBeNull();
  });

  it("refuses while the foundation holds a finished floor", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    send(game, place("floor", square));
    finish(game, lastBlueprint(game, "floor"));

    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, foundation) })).toEqual({ kind: "holdsUpPiece" });
  });
});

describe("saving floors", () => {
  it("restores a floor blueprint with its planks, and a finished floor", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 2, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    game.entities.add({ floor: true, facing: { turns: 0 }, position: { x: square.x, y: 0, z: square.z } });
    send(game, place("floor", beside));
    const blueprint = lastBlueprint(game, "floor");
    onlyPlayer(game).backpack.contents = { plank: 1 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.with("floor", "position").entities).toHaveLength(1);
    expect(lastBlueprint(loaded.game, "floor").blueprint).toMatchObject({ delivered: { plank: 1 }, materialsSpent: 1 });
  });

  it("raises the save version, and loads a save from before floors with no floors", () => {
    const game = createGame({ seed: 42 });
    expect(FLOORS_SAVE_VERSION).toBeGreaterThan(APPROACHES_SAVE_VERSION);
    expect(FLOORS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const old = { ...writeSave(game), version: FLOORS_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));

    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.entities.with("floor").entities).toHaveLength(0);
  });
});

type Square = { x: number; z: number };

/** Builds a floor blueprint through to the end. The game must build for free. */
function finish(game: Game, blueprint: Entity): void {
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Puts a finished foundation on a square, as if the player had built it. */
function finishedFoundationAt(game: Game, square: Square) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): Square {
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
      const reach = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, at: Square, turns: QuarterTurns = 0): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
}

function lastBlueprint(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities
    .with("blueprint", "position")
    .entities.filter((entity) => entity.blueprint.structure === structure)
    .at(-1);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
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
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
