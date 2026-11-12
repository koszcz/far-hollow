import { describe, expect, it } from "bun:test";
import type { Command, StructureKind } from "./api";
import { workStationEntities, type Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { LARGE_VALLEY_UPGRADES, readSave, SAVE_VERSION, SAWHORSES_SAVE_VERSION, writeSave } from "./save";
import { SAWHORSE_BUILD_SECONDS } from "./structures";
import { isWalkable } from "./walk-map";

/** Loads a save made before the valley shrank, the way the game loaded it then. */
const readLargeValleySave = (data: unknown) => readSave(data, LARGE_VALLEY_UPGRADES);

describe("the sawhorse in the build menu", () => {
  it("lists the sawhorse with its cost of 2 debarked logs and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().buildMenu).toContainEqual({ structure: "sawhorse", cost: [{ material: "debarkedLog", count: 2 }], placement: "onGround" });
  });
});

describe("placing a sawhorse", () => {
  it("goes on the nearest grid point on open ground, with no foundation, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    // The middle of a square is half a metre from the nearest grid point, which is its corner.
    const at = { x: square.x + 0.4, z: square.z + 0.4 };

    const check = game.client.checkPlacement("sawhorse", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: square.x + 0.5, z: square.z + 0.5 });

    send(game, place("sawhorse", at.x, at.z, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "sawhorse", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: square.x + 0.5, z: square.z + 0.5 });
    expect(blueprint.facing).toEqual({ turns: 1 });
    expect(game.entities.with("foundation").size).toBe(0);
  });

  it("covers 1.2 m along its beam, so turning it changes where a second sawhorse fits beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const spot = { x: square.x + 0.5, z: square.z + 0.5 };
    send(game, place("sawhorse", spot.x, spot.z, 0));

    // One grid point along x, a second sawhorse facing the same way would overlap the first, end to end.
    // Turned a quarter turn, its beam runs along z and it clears the first one's end.
    expect(game.client.checkPlacement("sawhorse", { x: spot.x + 1, z: spot.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("sawhorse", { x: spot.x + 1, z: spot.z }, 1).allowed).toBe(true);
  });

  it("refuses a spot by a standing tree or on a foundation", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTo(game, game.entities.with("tree", "position").entities);
    expect(game.client.checkPlacement("sawhorse", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);

    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    expect(game.client.checkPlacement("sawhorse", { x: square.x + 0.5, z: square.z + 0.5 }, 0).allowed).toBe(false);
  });
});

describe("building a sawhorse", () => {
  it("takes the debarked logs carried to it and the build action, and finishes as a sawhorse work station", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sawhorseBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    deliverLogs(game, blueprint, 1);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "debarkedLog", has: 1, needs: 2 }]);

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, SAWHORSE_BUILD_SECONDS + 1);
    // One log builds only the first stage, and a blueprint is not yet a work station.
    expect(blueprint.blueprint?.progress).toBeCloseTo(1 / 2, 5);
    expect(workStationEntities(game.entities).size).toBe(0);

    deliverLogs(game, blueprint, 1);
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, SAWHORSE_BUILD_SECONDS + 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.workStation).toBe("sawhorse");
    expect(blueprint.facing).toEqual({ turns: 2 });
    expect(workStationEntities(game.entities).entities).toEqual<unknown>([blueprint]);
  });

  it("needs no tool", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sawhorseBlueprintNearPlayer(game);
    delete onlyPlayer(game).backpack.contents.axe;

    buildFully(game, blueprint);

    expect(blueprint.workStation).toBe("sawhorse");
  });

  it("blocks walking where it stands once finished, and keeps other structures off it", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sawhorseBlueprintNearPlayer(game);
    buildFully(game, blueprint);
    const { x, z } = blueprint.position;

    for (const [dx, dz] of [
      [0.5, 0.2],
      [-0.5, 0.2],
      [0.5, -0.2],
      [-0.5, -0.2],
    ] as const) {
      expect(isWalkable(game.walkMap, { x: x + dx, z: z + dz })).toBe(false);
    }
    for (const structure of ["campfire", "woodpile", "sawhorse"] as const) {
      expect(game.client.checkPlacement(structure, { x, z }, 0).allowed).toBe(false);
    }
    expect(game.client.checkPlacement("chest", { x: x + 0.2, z }, 0).allowed).toBe(false);
  });
});

describe("taking down a sawhorse", () => {
  it("takes a finished sawhorse down over time and lays both debarked logs on the ground", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = sawhorseBlueprintNearPlayer(game);
    buildFully(game, sawhorse);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, sawhorse) });
    stepUntil(game, () => game.client.getView().action?.kind === "takeDown");
    expect(game.entities.has(sawhorse)).toBe(true);
    stepUntil(game, () => !game.entities.has(sawhorse));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 2);
    expect(isWalkable(game.walkMap, sawhorse.position)).toBe(true);
  });

  it("removes a blueprint at once and lays every debarked log delivered to it on the ground", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sawhorseBlueprintNearPlayer(game);
    deliverLogs(game, blueprint, 1);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 1);
  });
});

describe("saving sawhorses", () => {
  it("keeps finished sawhorses and sawhorse blueprints, with which way they face", () => {
    const game = createGame({ seed: 42 });
    const finished = sawhorseBlueprintNearPlayer(game);
    buildFully(game, finished);
    send(game, place("sawhorse", finished.position.x + 3, finished.position.z, 3));

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const stations = workStationEntities(loaded.game.entities).entities;
    expect(stations.map(({ workStation, position, facing }) => ({ workStation, x: position.x, z: position.z, facing }))).toEqual([
      { workStation: "sawhorse", x: finished.position.x, z: finished.position.z, facing: { turns: 2 } },
    ]);
    expect(isWalkable(loaded.game.walkMap, finished.position)).toBe(false);
    const plans = loaded.game.entities.with("blueprint", "position").entities;
    expect(plans.map(({ blueprint, position, facing }) => ({ structure: blueprint.structure, x: position.x, facing }))).toEqual([
      { structure: "sawhorse", x: finished.position.x + 3, facing: { turns: 3 } },
    ]);
  });

  it("raises the save version, and loads a save from before sawhorses with none in it", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = SAWHORSES_SAVE_VERSION - 1;

    const loaded = readLargeValleySave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    // Version 16 was the newest save version before the crafting feature.
    expect(SAWHORSES_SAVE_VERSION).toBeGreaterThan(16);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(SAWHORSES_SAVE_VERSION);
    expect(workStationEntities(loaded.game.entities).size).toBe(0);
  });
});

/** How many debarked logs lie on the ground. */
function debarkedLogsOnGround(game: Game): number {
  return game.entities.with("debarkedLog", "position").size;
}

/** Places a sawhorse blueprint on open ground near the player, facing a half turn. */
function sawhorseBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("sawhorse", square.x + 0.5, square.z + 0.5, 2));
  return onlyBlueprint(game);
}

/** Carries the logs a blueprint needs to it and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const needs = game.client.describeBlueprint(idOf(game, blueprint))?.deliveries[0]?.needs ?? 0;
  deliverLogs(game, blueprint, needs);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Carries `count` debarked logs to a blueprint, one at a time. */
function deliverLogs(game: Game, blueprint: Entity, count: number): void {
  for (let i = 0; i < count; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game, from = 3): { x: number; z: number } {
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
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

function nearestTo<T extends Entity & { position: { x: number; z: number } }>(game: Game, candidates: T[]): T {
  const { x, z } = onlyPlayer(game).position;
  const sorted = [...candidates].sort((a, b) => Math.hypot(a.position.x - x, a.position.z - z) - Math.hypot(b.position.x - x, b.position.z - z));
  const nearest = sorted[0];
  if (nearest === undefined) throw new Error("Nothing to pick");
  return nearest;
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
