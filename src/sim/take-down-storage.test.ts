import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { CHEST_BUILD_SECONDS, CHEST_LOG_COST } from "./structures";
import { isWalkable } from "./walk-map";

describe("taking down a chest", () => {
  it("gives back its 2 debarked logs on the ground once it is empty", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, chest) });
    stepUntil(game, () => !game.entities.has(chest));

    expect(CHEST_LOG_COST).toBe(2);
    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 2);
  });

  it("is refused while the chest holds anything, and the player is told to empty it first", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    chest.chest.contents.knife = 1;

    send(game, { type: "takeDown", pieceId: idOf(game, chest) });
    expect(game.client.getView().notice).toBe("storageNotEmpty");
    runSeconds(game, CHEST_BUILD_SECONDS);

    expect(game.entities.has(chest)).toBe(true);
    expect(chest.chest.contents).toEqual({ knife: 1 });
  });

  it("is refused if something goes in the chest while it is being taken down", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    send(game, { type: "takeDown", pieceId: idOf(game, chest) });
    stepUntil(game, () => game.client.getView().action?.kind === "takeDown");
    chest.chest.contents.firewood = 2;

    stepUntil(game, () => game.client.getView().notice === "storageNotEmpty" || !game.entities.has(chest));

    expect(game.entities.has(chest)).toBe(true);
    expect(game.client.getView().action).toBeNull();
  });
});

describe("taking down a chest blueprint", () => {
  it("removes it at once and lays every debarked log delivered to it on the ground", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "chest", turns: 0, x: square.x, z: square.z });
    const blueprint = onlyBlueprint(game);
    deliverLog(game, blueprint);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().action).toBeNull();
    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 1);
  });
});

describe("taking down a woodpile", () => {
  it("removes an empty woodpile and frees its ground", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    const { x, z } = woodpile.position;
    expect(game.client.checkPlacement("woodpile", { x, z }, 0).allowed).toBe(false);

    send(game, { type: "takeDown", pieceId: idOf(game, woodpile) });
    stepUntil(game, () => !game.entities.has(woodpile));

    expect(game.client.checkPlacement("woodpile", { x, z }, 0).allowed).toBe(true);
  });

  it("is refused while anything is stacked on it, and the player is told to empty it first", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.log = 1;

    send(game, { type: "takeDown", pieceId: idOf(game, woodpile) });
    expect(game.client.getView().notice).toBe("storageNotEmpty");
    runSeconds(game, 10);

    expect(game.entities.has(woodpile)).toBe(true);
    expect(woodpile.woodpile).toEqual({ log: 1, debarkedLog: 0, firewood: 0 });
  });

  it("removes a woodpile blueprint at once", () => {
    const game = createGame({ seed: 42 });
    const spot = openSquareNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "woodpile", turns: 0, x: spot.x, z: spot.z });
    const blueprint = onlyBlueprint(game);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().action).toBeNull();
  });
});

/** Places a woodpile blueprint near the player and builds it. */
function buildWoodpile(game: Game): Entity & Required<Pick<Entity, "woodpile" | "position">> {
  const spot = openSquareNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "woodpile", turns: 0, x: spot.x, z: spot.z });
  send(game, { type: "build", blueprintId: idOf(game, onlyBlueprint(game)) });
  stepUntil(game, () => game.entities.with("woodpile").size > 0);
  const woodpile = game.entities.with("woodpile", "position").first;
  if (woodpile === undefined) throw new Error("No woodpile");
  return woodpile;
}

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

/** Places a chest near the player and builds it, as the player would. */
function buildChest(game: Game): Entity & Required<Pick<Entity, "chest" | "position">> {
  const square = openSquareNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "chest", turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  for (let i = 0; i < CHEST_LOG_COST; i += 1) deliverLog(game, blueprint);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.entities.with("chest").size > 0);
  const chest = game.entities.with("chest", "position").first;
  if (chest === undefined) throw new Error("No chest");
  return chest;
}

/** Puts a debarked log on the player's shoulder and carries it to a blueprint. */
function deliverLog(game: Game, blueprint: Entity): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
  send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().carrying === null);
}

/** How many debarked logs lie on the ground. */
function debarkedLogsOnGround(game: Game): number {
  return game.entities.with("debarkedLog").size;
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 30; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open) return square;
    }
  }
  throw new Error("No open square");
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
