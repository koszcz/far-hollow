import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { type QuarterTurns } from "./quarter-turns";
import { FIREPLACE_BUILD_SECONDS, FIREPLACE_STONE_COST, LOG_WALL_LOG_COST, type StructureKind } from "./structures";
import { FIREPLACES_SAVE_VERSION, readSave, SAVE_VERSION, STONE_SAVE_VERSION, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("the fireplace in the build menu", () => {
  it("lists the fireplace with its cost of 12 stone and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(FIREPLACE_STONE_COST).toBe(12);
    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "fireplace",
      cost: [{ material: "stone", count: 12 }],
      placement: "onFoundation",
    });
  });
});

describe("where a fireplace can go", () => {
  it("snaps to the foundation square under the mouse, at the height of its deck, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);

    for (const turns of [0, 1, 2, 3] as const) {
      const check = game.client.checkPlacement("fireplace", { x: square.x + 0.3, z: square.z - 0.2 }, turns);
      expect(check.allowed).toBe(true);
      expect(check.spot).toMatchObject({ x: square.x, z: square.z });
      expect(check.spot.y).toBeCloseTo(foundation.position.y, 5);
      expect(check.turns).toBe(turns);
    }
  });

  it("needs a finished foundation under it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    expect(game.client.checkPlacement("fireplace", square, 0).allowed).toBe(false);

    send(game, place("foundation", square, 0));
    expect(game.client.checkPlacement("fireplace", square, 0).allowed).toBe(false);
  });

  it("goes on a square with walls and a roof frame, or with none", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    finishedPieceAt(game, "logWall", beside, 0);
    finishedPieceAt(game, "logWall", beside, 1);
    game.entities.add({ roofFrame: true, facing: { turns: 0 }, position: { x: beside.x, y: 0, z: beside.z } });

    expect(game.client.checkPlacement("fireplace", square, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("fireplace", beside, 2).allowed).toBe(true);
  });

  it("does not go on a square with a campfire, a campfire blueprint, or furniture", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    const further = { x: square.x + 2, z: square.z };
    for (const at of [square, beside, further]) finishedFoundationAt(game, at);
    game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, onFoundation: square, position: { x: square.x, y: 0, z: square.z } });
    game.entities.add({ blueprint: { structure: "campfire", progress: 0, materialsSpent: 0, delivered: {} }, position: { x: beside.x, y: 0, z: beside.z } });
    game.entities.add({ furniture: "stool", facing: { turns: 0 }, position: { x: further.x + 0.3, y: 0, z: further.z } });

    for (const at of [square, beside, further]) expect(game.client.checkPlacement("fireplace", at, 0).allowed).toBe(false);
  });

  it("does not go on a square that holds a fireplace or its blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("fireplace", square, 0));

    expect(game.client.checkPlacement("fireplace", square, 1).allowed).toBe(false);
  });
});

describe("what a fireplace keeps off its square", () => {
  it("keeps campfires and furniture off a square with a fireplace or its blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("fireplace", square, 0));
    finish(game, lastBlueprint(game, "fireplace"));
    send(game, place("fireplace", beside, 0));

    for (const at of [square, beside]) {
      expect(game.client.checkPlacement("campfire", at, 0).allowed).toBe(false);
      expect(game.client.checkPlacement("stool", at, 0).allowed).toBe(false);
    }
  });

  it("lets a roof frame and a roof go over it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    send(game, place("fireplace", square, 0));
    finish(game, lastBlueprint(game, "fireplace"));

    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(true);
  });
});

describe("walking past a fireplace", () => {
  it("is blocked by the blueprint and by the finished fireplace", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    expect(isWalkable(game.walkMap, square)).toBe(true);

    send(game, place("fireplace", square, 0));
    expect(isWalkable(game.walkMap, square)).toBe(false);

    finish(game, lastBlueprint(game, "fireplace"));
    expect(isWalkable(game.walkMap, square)).toBe(false);
  });
});

describe("building a fireplace", () => {
  it("takes 24 seconds of work in all, with 12 stone from the backpack and no tool", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("fireplace", square, 0));
    const blueprint = lastBlueprint(game, "fireplace");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { stone: FIREPLACE_STONE_COST };
    expect(FIREPLACE_BUILD_SECONDS).toBe(24);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "stone", has: 0, needs: FIREPLACE_STONE_COST }]);

    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, FIREPLACE_BUILD_SECONDS - 0.5);
    expect(blueprint.blueprint).toBeDefined();
    expect(game.client.getView().backpack.stone ?? 0).toBe(0);
    expect(blueprint.blueprint?.delivered).toEqual({ stone: FIREPLACE_STONE_COST });
    runSeconds(game, 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.fireplace).toBeDefined();
    expect(blueprint.facing).toEqual({ turns: 0 });
  });

  it("keeps the stone it has been given over several trips, and takes stone from piles within 2 m", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("fireplace", square, 2));
    const blueprint = lastBlueprint(game, "fireplace");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { stone: 5 };

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, FIREPLACE_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toMatchObject({ delivered: { stone: 5 }, materialsSpent: 5 });
    expect(game.client.getView().action).toBeNull();
    expect(game.client.describeBlueprint(id)?.lacks).toEqual({ kind: "material", material: "stone" });

    // A second trip brings 3 more in the backpack. A pile 1.5 m from the blueprint holds the last 4, and one 3 m away is left alone.
    onlyPlayer(game).backpack.contents = { stone: 3 };
    const near = stonePileAt(game, { x: square.x, z: square.z - 0.5 - 1.5 }, 4);
    const far = stonePileAt(game, { x: square.x, z: square.z + 0.5 + 3 }, 4);
    expect(game.client.describeBlueprint(id)?.lacks).toBeNull();
    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(game.client.getView().backpack.stone ?? 0).toBe(0);
    expect(game.entities.has(near)).toBe(false);
    expect(far.pile?.count).toBe(4);
    expect(blueprint.fireplace).toBeDefined();
  });

  it("spends no stone in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const stoneBefore = game.client.getView().backpack.stone;
    send(game, place("fireplace", square, 0));
    const blueprint = lastBlueprint(game, "fireplace");

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(game.client.getView().backpack.stone).toBe(stoneBefore);
  });
});

describe("taking down a fireplace", () => {
  it("gives back every stone a blueprint has been given", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("fireplace", square, 0));
    const blueprint = lastBlueprint(game, "fireplace");
    onlyPlayer(game).backpack.contents = { stone: 5 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined);
    expect(game.client.getView().backpack.stone ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().backpack.stone).toBe(5);
    expect(isWalkable(game.walkMap, square)).toBe(true);
  });

  it("gives back all 12 stone of a finished fireplace, in a pile for the ones that do not fit in the backpack", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("fireplace", square, 0));
    const fireplace = lastBlueprint(game, "fireplace");
    finish(game, fireplace);
    onlyPlayer(game).backpack.contents = {};

    send(game, { type: "takeDown", pieceId: idOf(game, fireplace) });
    stepUntil(game, () => !game.entities.has(fireplace));

    // The backpack holds 20 kg, so 10 stone of 2 kg each. The last 2 lie in a pile.
    expect(game.client.getView().backpack.stone).toBe(10);
    const piles = game.entities.with("pile", "position").entities.filter(({ pile }) => pile.content === "stone");
    expect(piles.reduce((total, { pile }) => total + pile.count, 0)).toBe(2);
    expect(isWalkable(game.walkMap, square)).toBe(true);
  });

  it("holds up the foundation under it, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    send(game, place("fireplace", square, 0));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    runSeconds(game, 10);
    expect(game.entities.has(foundation)).toBe(true);

    finish(game, lastBlueprint(game, "fireplace"));
    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    runSeconds(game, 10);
    expect(game.entities.has(foundation)).toBe(true);
  });
});

describe("saving fireplaces", () => {
  it("restores a fireplace blueprint with its stone, and a finished fireplace, both still blocking walking", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 2, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("fireplace", square, 3));
    finish(game, lastBlueprint(game, "fireplace"));
    send(game, place("fireplace", beside, 1));
    const blueprint = lastBlueprint(game, "fireplace");
    onlyPlayer(game).backpack.contents = { stone: 4 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const fireplaces = loaded.game.entities.with("fireplace", "position").entities;
    expect(fireplaces).toHaveLength(1);
    expect(fireplaces[0]?.facing).toEqual({ turns: 3 });
    expect(lastBlueprint(loaded.game, "fireplace").blueprint).toMatchObject({ delivered: { stone: 4 }, materialsSpent: 4 });
    expect(isWalkable(loaded.game.walkMap, square)).toBe(false);
    expect(isWalkable(loaded.game.walkMap, beside)).toBe(false);
  });

  it("raises the save version, and loads a save from before fireplaces unchanged", () => {
    const game = createGame({ seed: 42 });
    expect(FIREPLACES_SAVE_VERSION).toBeGreaterThan(STONE_SAVE_VERSION);
    expect(FIREPLACES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const old = { ...writeSave(game), version: FIREPLACES_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));

    expect(loaded.ok).toBe(true);
  });
});

/** Gives the player a fireplace's stone and builds a fireplace blueprint to the end. */
function finish(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.stone = (contents.stone ?? 0) + FIREPLACE_STONE_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Lays a pile of stone on the ground at a spot. */
function stonePileAt(game: Game, at: { x: number; z: number }, count: number): Entity {
  return game.entities.add({ pile: { content: "stone", count }, position: { x: at.x, y: 0, z: at.z } });
}

/** Places a wall blueprint and builds it through to the end, delivering every debarked log it needs. */
function finishedPieceAt(game: Game, structure: "logWall", square: { x: number; z: number }, turns: QuarterTurns): Entity {
  send(game, place(structure, square, turns));
  const blueprint = lastBlueprint(game, structure);
  for (let i = 0; i < LOG_WALL_LOG_COST; i += 1) {
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

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
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
      const reach = [-3, -2, -1, 0, 1, 2, 3, 4];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns): Command {
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
