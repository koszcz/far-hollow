import { describe, expect, it } from "vitest";
import type { BackpackContent, Command } from "./api";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import { readSave, SAVE_VERSION, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("opening a chest", () => {
  it("walks the player to a chest they click and opens it, empty at first", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    walkAway(game);
    expect(game.client.getView().openChest).toBeNull();

    open(game, chest);

    expect(game.client.getView().openChest).toEqual({ id: idOf(game, chest), contents: {}, weight: 0, weightLimit: 60 });
  });

  it("closes when the player walks away, and stays closed when they come back", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    open(game, chest);

    const player = onlyPlayer(game);
    send(game, { type: "walkTo", x: player.position.x - 15, z: player.position.z });
    expect(game.client.getView().openChest).toBeNull();
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    send(game, { type: "walkTo", x: chest.position.x + 1.1, z: chest.position.z });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

    expect(game.client.getView().openChest).toBeNull();
  });

  it("closes for good once the player is out of reach, even if nothing else they did closed it", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    open(game, chest);
    const player = onlyPlayer(game);
    const beside = { ...player.position };

    // Something moves the player away without starting a new task, as waking at the respawn point after a collapse does.
    player.position.x -= 10;
    game.step();
    expect(game.client.getView().openChest).toBeNull();
    Object.assign(player.position, beside);
    game.step();

    expect(game.client.getView().openChest).toBeNull();
  });

  it("moves nothing while the chest is closed", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    give(game, "stick", 2);
    send(game, { type: "walkTo", x: chest.position.x + 1.1, z: chest.position.z });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "stick", all: true });

    expect(chest.chest.contents).toEqual({});
    expect(game.client.getView().backpack.stick).toBe(2);
  });
});

describe("moving one thing", () => {
  it("moves one of a kind from the backpack into the open chest, and one back out", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    give(game, "stick", 3);
    open(game, chest);

    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "stick", all: false });
    expect(game.client.getView().backpack.stick).toBe(2);
    expect(game.client.getView().openChest?.contents).toEqual({ stick: 1 });
    expect(game.client.getView().openChest?.weight).toBe(0.5);

    send(game, { type: "takeFromChest", chestId: idOf(game, chest), content: "stick", all: false });
    expect(game.client.getView().backpack.stick).toBe(3);
    expect(game.client.getView().openChest?.contents).toEqual({});
  });

  it("moves tools and food as well as materials", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    give(game, "berries", 2);
    open(game, chest);

    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "axe", all: false });
    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "berries", all: false });

    expect(game.client.getView().openChest?.contents).toEqual({ axe: 1, berries: 1 });
    expect(game.client.getView().backpack.axe ?? 0).toBe(0);
  });
});

describe("moving all of a kind", () => {
  it("puts all of a kind from the backpack into the chest with a shift-click", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    give(game, "stick", 7);
    open(game, chest);

    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "stick", all: true });

    expect(game.client.getView().backpack.stick ?? 0).toBe(0);
    expect(game.client.getView().openChest?.contents).toEqual({ stick: 7 });
  });

  it("takes as many of a kind as fit in the backpack, and leaves the rest in the chest", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    chest.chest.contents.firewood = 30;
    open(game, chest);
    // The starting backpack weighs 4.9 kg, so 10 pieces of firewood at 1.5 kg fill it to 19.9 kg of its 20.
    expect(game.client.getView().backpackWeight).toBeCloseTo(4.9, 5);

    send(game, { type: "takeFromChest", chestId: idOf(game, chest), content: "firewood", all: true });

    expect(game.client.getView().backpack.firewood).toBe(10);
    expect(game.client.getView().openChest?.contents).toEqual({ firewood: 20 });
  });
});

describe("the chest's weight limit", () => {
  it("holds up to 60 kg: a shift-click puts in as many as fit, and the rest stay in the backpack", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    give(game, "firewood", 45);
    open(game, chest);

    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "firewood", all: true });

    expect(game.client.getView().openChest).toMatchObject({ contents: { firewood: 40 }, weight: 60, weightLimit: 60 });
    expect(game.client.getView().backpack.firewood).toBe(5);
  });

  it("refuses even one more once full, and tells the player", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    chest.chest.contents.firewood = 40;
    give(game, "stick", 1);
    open(game, chest);

    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "stick", all: false });

    expect(game.client.getView().backpack.stick).toBe(1);
    expect(game.client.getView().openChest?.contents).toEqual({ firewood: 40 });
    expect(game.client.getView().notice).toBe("chestFull");
  });

  it("tells the player when the backpack has no room for what they take", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    chest.chest.contents.firewood = 1;
    give(game, "stick", 30);
    open(game, chest);

    send(game, { type: "takeFromChest", chestId: idOf(game, chest), content: "firewood", all: false });

    expect(game.client.getView().openChest?.contents).toEqual({ firewood: 1 });
    expect(game.client.getView().notice).toBe("backpackFull");
  });

  it("never takes a log or debarked log", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    open(game, chest);

    for (const log of ["log", "debarkedLog"]) {
      send(game, { type: "putInChest", chestId: idOf(game, chest), content: log as BackpackContent, all: true });
    }

    expect(game.client.getView().openChest?.contents).toEqual({});
  });
});

describe("saving what a chest holds", () => {
  it("keeps each chest's contents", () => {
    const game = createGame({ seed: 42 });
    const chest = buildChest(game);
    give(game, "stick", 4);
    open(game, chest);
    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "stick", all: true });
    send(game, { type: "putInChest", chestId: idOf(game, chest), content: "pot", all: false });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.entities.with("chest").entities.map(({ chest: { contents } }) => contents)).toEqual([{ stick: 4, pot: 1 }]);
  });

  it("upgrades a chest saved before chests held anything to an empty chest", () => {
    const game = createGame({ seed: 42 });
    buildChest(game);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Record<string, unknown> }[] };
    // How a version 9 save stored a finished chest.
    for (const { components } of save.entities) if ("chest" in components) components.chest = {};
    save.version = 9;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(SAVE_VERSION).toBeGreaterThan(9);
    expect(loaded.game.entities.with("chest").entities.map(({ chest }) => chest)).toEqual([{ contents: {} }]);
  });

  it("turns away a save whose chest holds a log", () => {
    const game = createGame({ seed: 42 });
    buildChest(game);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if ("chest" in components) components.chest = { contents: { log: 1 } };

    expect(readSave(save).ok).toBe(false);
  });
});

/** Places a chest near the player and builds it, as the player would. */
function buildChest(game: Game): Entity & Required<Pick<Entity, "chest" | "position">> {
  const square = openSquareNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "chest", turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  const needs = game.client.describeBlueprint(idOf(game, blueprint))?.deliveries[0]?.needs ?? 0;
  for (let i = 0; i < needs; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.entities.with("chest").size > 0);
  const chest = game.entities.with("chest", "position").first;
  if (chest === undefined) throw new Error("No chest");
  return chest;
}

function open(game: Game, chest: Entity): void {
  send(game, { type: "openChest", chestId: idOf(game, chest) });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

function walkAway(game: Game): void {
  const player = onlyPlayer(game);
  send(game, { type: "walkTo", x: player.position.x - 15, z: player.position.z });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
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

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  backpack.contents[content] = (backpack.contents[content] ?? 0) + count;
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
