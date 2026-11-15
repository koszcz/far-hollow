import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { LARGE_VALLEY_UPGRADES, PLANK_CHESTS_SAVE_VERSION, readSave, RENAMED_NOT_EMPTY_NOTICE_SAVE_VERSION, writeSave } from "./save";
import { CHEST_BUILD_SECONDS, CHEST_PLANK_COST } from "./structures";
import { isWalkable } from "./walk-map";

/** Loads a save made before the valley shrank, the way the game loaded it then. */
const readLargeValleySave = (data: unknown) => readSave(data, LARGE_VALLEY_UPGRADES);

describe("taking down a chest", () => {
  it("gives back its 4 planks in the backpack once it is empty", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    const logsBefore = debarkedLogsOnGround(game);
    expect(planksInBackpack(game)).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, chest) });
    stepUntil(game, () => !game.entities.has(chest));

    expect(CHEST_PLANK_COST).toBe(4);
    expect(planksInBackpack(game)).toBe(4);
    expect(debarkedLogsOnGround(game)).toBe(logsBefore);
  });

  it("gives back the 2 debarked logs of a chest from a save made before chests cost planks", () => {
    const game = loadAsOlderSave(createGame({ seed: 42 }), buildChest);
    const chest = game.entities.with("chest", "position").first;
    if (chest === undefined) throw new Error("No chest");
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, chest) });
    stepUntil(game, () => !game.entities.has(chest));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 2);
    expect(planksInBackpack(game)).toBe(0);
  });

  it("is refused while the chest holds anything, and the player is told to empty it first", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    chest.chest.contents.knife = 1;

    send(game, { type: "takeDown", pieceId: idOf(game, chest) });
    expect(game.client.getView().notice?.kind).toBe("stillHoldsSomething");
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

    stepUntil(game, () => game.client.getView().notice?.kind === "stillHoldsSomething" || !game.entities.has(chest));

    expect(game.entities.has(chest)).toBe(true);
    expect(game.client.getView().action).toBeNull();
  });
});

describe("taking down a chest blueprint", () => {
  it("removes it at once and gives back every plank it took, spent or not", () => {
    const game = createGame({ seed: 42 });
    const blueprint = placeChest(game);
    onlyPlayer(game).backpack.contents.plank = 3;
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    // Building the first stage spends one of the 3 planks the blueprint took.
    stepUntil(game, () => (blueprint.blueprint?.materialsSpent ?? 0) > 0);
    expect(blueprint.blueprint).toMatchObject({ materialsSpent: 1, delivered: { plank: 3 } });
    expect(planksInBackpack(game)).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().action).toBeNull();
    expect(planksInBackpack(game)).toBe(3);
  });

  it("lays every debarked log delivered to a chest blueprint from an older save on the ground", () => {
    const game = loadAsOlderSave(createGame({ seed: 42 }), (older) => {
      const blueprint = placeChest(older);
      // A blueprint from before chests cost planks, with one of its 2 debarked logs carried to it.
      blueprint.blueprint = { structure: "chest", progress: 0, materialsSpent: 0, delivered: { debarkedLog: 1 } };
    });
    const blueprint = onlyBlueprint(game);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 1);
    expect(planksInBackpack(game)).toBe(0);
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
    expect(game.client.getView().notice?.kind).toBe("stillHoldsSomething");
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

describe("saving the notice that a chest or woodpile still holds something", () => {
  it("keeps the notice from a save made before it was renamed", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; notice: unknown };
    save.version = RENAMED_NOT_EMPTY_NOTICE_SAVE_VERSION - 1;
    save.notice = { kind: "storageNotEmpty", untilMinutes: 10_000 };

    const loaded = readLargeValleySave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView().notice?.kind).toBe("stillHoldsSomething");
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

/** Places a chest blueprint near the player. */
function placeChest(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const square = openSquareNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "chest", turns: 0, x: square.x, z: square.z });
  return onlyBlueprint(game);
}

/** Places a chest near the player and builds it from planks in the backpack, as the player would. */
function buildChest(game: Game): Entity & Required<Pick<Entity, "chest" | "position">> {
  const blueprint = placeChest(game);
  onlyPlayer(game).backpack.contents.plank = CHEST_PLANK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.entities.with("chest").size > 0);
  const chest = game.entities.with("chest", "position").first;
  if (chest === undefined) throw new Error("No chest");
  return chest;
}

/**
 * Sets up a game with `setUp`, saves it as a save from before chests cost planks, and loads it.
 * Its chests and chest blueprints load as the older save would hold them.
 */
function loadAsOlderSave(game: Game, setUp: (game: Game) => unknown): Game {
  setUp(game);
  const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
  save.version = PLANK_CHESTS_SAVE_VERSION - 1;
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error("The save did not load");
  return loaded.game;
}

/** How many planks the player has in the backpack. */
function planksInBackpack(game: Game): number {
  return onlyPlayer(game).backpack.contents.plank ?? 0;
}

/** How many debarked logs lie on the ground. */
function debarkedLogsOnGround(game: Game): number {
  return game.entities.with("debarkedLog").size;
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 30; distance += 1) {
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
