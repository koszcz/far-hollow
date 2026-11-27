import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { StructureKind } from "./api";
import { REAL_MS_PER_GAME_MINUTE } from "./clock";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { FATIGUE_DRAIN_PER_HOUR, FATIGUE_RECOVERY_PER_HOUR } from "./needs";
import { BEDS_SAVE_VERSION, readSave, SAVE_VERSION, STOOLS_SAVE_VERSION, writeSave } from "./save";
import { STOOL_BUILD_SECONDS, STOOL_PLANK_COST } from "./furniture/stool";
import { isWalkable } from "./walk-map";
import { piecesOf } from "./test-steps";

describe("the stool in the build menu", () => {
  it("lists the stool as furniture, with its cost of 2 planks and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(STOOL_PLANK_COST).toBe(2);
    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "stool",
      cost: [{ material: "plank", count: 2 }],
      placement: "anywhere",
    });
  });
});

describe("placing a stool", () => {
  it("goes exactly where the mouse points, off the building grid, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("stool", at, 3);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });

    send(game, place("stool", at.x, at.z, 3));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "stool", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    expect(blueprint.facing).toEqual({ turns: 3 });
  });
});

describe("where a stool cannot go", () => {
  it("refuses a spot over a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");

    expect(game.client.checkPlacement("stool", { x: tree.position.x + 0.2, z: tree.position.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap a structure, such as a foundation blueprint or a campfire", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    send(game, place("campfire", square.x + 3, square.z, 0));

    expect(game.client.checkPlacement("stool", { x: square.x + 0.3, z: square.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("stool", { x: square.x + 3, z: square.z + 0.3 }, 0).allowed).toBe(false);
  });

  it("refuses to overlap other furniture, finished or as a blueprint, and stops furniture going over it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 0));
    expect(game.client.checkPlacement("stool", { x: square.x + 0.3, z: square.z + 0.5 }, 0).allowed).toBe(false);

    send(game, place("stool", square.x + 2, square.z, 0));
    expect(game.client.checkPlacement("stool", { x: square.x + 2.3, z: square.z }, 0).allowed).toBe(false);
    buildFully(game, blueprintOf(game, "stool"));
    expect(piecesOf(game.entities, "stool").length).toBe(1);
    for (const structure of ["stool", "chest", "bed"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2.2, z: square.z + 0.1 }, 0).allowed).toBe(false);
    }
  });
});

describe("building a stool", () => {
  it("takes its 2 planks over two trips if need be, needs no tool, and shows its stages as it goes", () => {
    const game = createGame({ seed: 42 });
    const blueprint = stoolBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const backpack = onlyPlayer(game).backpack;
    delete backpack.contents.axe;
    delete backpack.contents.knife;
    delete backpack.contents.drawknife;
    delete backpack.contents.saw;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: STOOL_PLANK_COST }]);

    // The first trip brings 1 plank. The stool builds its legs and stops.
    backpack.contents.plank = 1;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, STOOL_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);
    expect(blueprint.blueprint).toMatchObject({ materialsSpent: 1, delivered: { plank: 1 } });
    expect(blueprint.blueprint?.progress).toBeCloseTo(1 / 2, 5);
    expect(game.client.getView().action).toBeNull();

    // The second trip brings the rest, and more. It takes only what it still needs.
    backpack.contents.plank = 3;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, STOOL_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.furniture).toBe("stool");
    expect(backpack.contents.plank).toBe(2);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = stoolBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.plank = 1;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, STOOL_BUILD_SECONDS + 5);

    expect(blueprint.furniture).toBe("stool");
    expect(onlyPlayer(game).backpack.contents.plank).toBe(1);
  });
});

describe("a finished stool", () => {
  it("blocks walking where it stands", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("stool", square.x, square.z, 0));
    buildFully(game, blueprintOf(game, "stool"));

    expect(isWalkable(game.walkMap, square)).toBe(false);
    expect(isWalkable(game.walkMap, { x: square.x + 1, z: square.z })).toBe(true);
  });

  it("is what E reaches, beside the player", () => {
    const game = createGame({ seed: 42 });
    const stool = finishedStoolNearPlayer(game);

    expect(game.client.nearestInReach()).toEqual({ kind: "furniture", id: idOf(game, stool), furniture: "stool" });
  });
});

describe("sitting on a stool", () => {
  it("walks the player to the stool first, then sits them down beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("stool", square.x, square.z, 0));
    const stool = blueprintOf(game, "stool");
    buildFully(game, stool);
    walkTo(game, { x: square.x + 6, z: square.z });
    expect(game.client.getView().sittingOn).toBeNull();

    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    stepUntil(game, () => game.client.getView().sittingOn !== null);

    expect(game.client.getView().sittingOn).toBe(idOf(game, stool));
    const { x, z } = onlyPlayer(game).position;
    expect(Math.hypot(x - square.x, z - square.z)).toBeLessThan(2);
    expect(isWalkable(game.walkMap, { x, z })).toBe(true);
  });

  it("brings fatigue back at a quarter of the rate of sleep in the open, with time at normal speed", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);
    onlyPlayer(game).needs.fatigue.level = 0.5;
    const before = minutesOfDay(game.client.getView().time);

    // Ten real seconds pass ten game minutes, as they do while standing.
    runSeconds(game, 10);

    const minutes = minutesOfDay(game.client.getView().time) - before;
    expect(minutes).toBeCloseTo((10 * 1000) / REAL_MS_PER_GAME_MINUTE, 0);
    const restedPerHour = FATIGUE_RECOVERY_PER_HOUR / 4;
    expect(onlyPlayer(game).needs.fatigue.level).toBeCloseTo(0.5 + (restedPerHour * minutes) / 60, 4);
    expect(game.client.getView().sittingOn).not.toBeNull();
  });

  it("rests through skipped time without standing up", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);
    onlyPlayer(game).needs.fatigue.level = 0.5;

    send(game, { type: "skipTime", hours: 2 });

    expect(game.client.getView().sittingOn).not.toBeNull();
    expect(onlyPlayer(game).needs.fatigue.level).toBeCloseTo(0.5 + 2 * (FATIGUE_RECOVERY_PER_HOUR / 4), 2);
  });

  it("stops the rest when the player stands, and fatigue drains again", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);
    send(game, { type: "walkTo", x: onlyPlayer(game).position.x + 3, z: onlyPlayer(game).position.z });
    stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
    onlyPlayer(game).needs.fatigue.level = 0.5;

    send(game, { type: "skipTime", hours: 2 });

    expect(onlyPlayer(game).needs.fatigue.level).toBeCloseTo(0.5 - 2 * FATIGUE_DRAIN_PER_HOUR, 2);
  });

  it("stands the player up as soon as they walk", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);
    const { x, z } = onlyPlayer(game).position;

    send(game, { type: "walkTo", x: x + 3, z });

    expect(game.client.getView().sittingOn).toBeNull();
    expect(onlyPlayer(game).walkPath).toBeDefined();
  });

  it("stands the player up as soon as they act, such as eating or dropping something", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);
    onlyPlayer(game).backpack.contents.berries = 2;

    send(game, { type: "eat", food: "berries" });
    expect(game.client.getView().sittingOn).toBeNull();

    sitAgain(game);
    send(game, { type: "dropFromBackpack", content: "stick" });
    expect(game.client.getView().sittingOn).toBeNull();
  });

  it("keeps the player sitting through a pause", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);

    send(game, { type: "setPaused", paused: true });
    send(game, { type: "setPaused", paused: false });

    expect(game.client.getView().sittingOn).not.toBeNull();
  });

  it("does not change the respawn point", () => {
    const game = createGame({ seed: 42 });
    const respawn = { ...onlyPlayer(game).respawnPoint };

    sitOnNewStool(game);

    expect(onlyPlayer(game).respawnPoint).toEqual(respawn);
    expect(game.client.getView().lastSleep).toBeNull();
  });
});

describe("taking down a stool", () => {
  it("stands a player sitting on it up first, then gives back both planks and lets the player walk there again", () => {
    const game = createGame({ seed: 42 });
    const stool = sitOnNewStool(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    send(game, { type: "takeDown", pieceId: idOf(game, stool) });
    expect(game.client.getView().sittingOn).toBeNull();
    stepUntil(game, () => piecesOf(game.entities, "stool").length === 0);

    expect(backpack.contents.plank).toBe(STOOL_PLANK_COST);
    expect(isWalkable(game.walkMap, stool.position)).toBe(true);
  });

  it("gives back the plank a stool blueprint has had so far", () => {
    const game = createGame({ seed: 42 });
    const blueprint = stoolBlueprintNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 1;
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, STOOL_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("blueprint").size === 0);

    expect(backpack.contents.plank).toBe(1);
  });
});

describe("saving stools", () => {
  it("raises the save version for stools, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(STOOLS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(STOOLS_SAVE_VERSION).toBeGreaterThan(BEDS_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = STOOLS_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps stools and stool blueprints, with which way they face and the planks a blueprint has had", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("stool", square.x, square.z, 1));
    buildFully(game, blueprintOf(game, "stool"));
    send(game, place("stool", square.x, square.z + 2, 2));
    blueprintOf(game, "stool").blueprint = { structure: "stool", progress: 0.5, materialsSpent: 1, delivered: { plank: 1 } };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const stools = piecesOf(loaded.game.entities, "stool");
    expect(stools.map(({ position, facing }) => ({ x: position.x, z: position.z, facing }))).toEqual([{ x: square.x, z: square.z, facing: { turns: 1 } }]);
    expect(isWalkable(loaded.game.walkMap, square)).toBe(false);
    const blueprint = blueprintOf(loaded.game, "stool");
    expect(blueprint.blueprint).toEqual({ structure: "stool", progress: 0.5, materialsSpent: 1, delivered: { plank: 1 } });
    expect(blueprint.facing).toEqual({ turns: 2 });
  });

  it("does not save sitting, so a loaded game starts with the player standing", () => {
    const game = createGame({ seed: 42 });
    sitOnNewStool(game);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().sittingOn).toBeNull();
    expect(loaded.game.entities.with("sitting").size).toBe(0);
    expect(piecesOf(loaded.game.entities, "stool").length).toBe(1);
  });
});

/** Places a stool blueprint on open ground near the player, facing the default way. */
function stoolBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("stool", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Builds a stool on open ground 2 m from the player, facing the default way, so the player stands within reach of it. */
function finishedStoolNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game, 2);
  send(game, place("stool", square.x, square.z, 0));
  const stool = blueprintOf(game, "stool");
  buildFully(game, stool);
  return stool;
}

/** Builds a stool near the player and sits them on it. */
function sitOnNewStool(game: Game) {
  const stool = finishedStoolNearPlayer(game);
  send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
  stepUntil(game, () => game.client.getView().sittingOn !== null);
  return stool;
}

/** Sits the player back on the only stool. */
function sitAgain(game: Game): void {
  const stool = piecesOf(game.entities, "stool")[0];
  if (stool === undefined) throw new Error("No stool");
  send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
  stepUntil(game, () => game.client.getView().sittingOn !== null);
}

/** How many game minutes into the game a time of day is. */
function minutesOfDay(time: { day: number; hour: number; minute: number }): number {
  return (time.day * 24 + time.hour) * 60 + time.minute;
}

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", x: to.x, z: to.z });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

/** Gives the player the planks a blueprint still needs and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  for (const { material, has, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    if (material === "plank") contents.plank = (contents.plank ?? 0) + needs - has;
  }
  while (blueprint.blueprint !== undefined) {
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined || game.client.getView().action === null);
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
      const open = [-3, -2, -1, 0, 1, 2, 3].every((ax) =>
        [-3, -2, -1, 0, 1, 2, 3].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })),
      );
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

function blueprintOf(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => entity.blueprint.structure === structure);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
  return blueprint;
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
  const player = game.entities.with("player", "position", "backpack", "needs", "respawnPoint").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
