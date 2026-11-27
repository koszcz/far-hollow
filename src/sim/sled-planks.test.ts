import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { StructureKind } from "./api";
import type { Entity, SledLoad } from "./entities";
import { createGame, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { SLED_PLANKS_SAVE_VERSION } from "./save-versions";
import { SLED_STICK_COST } from "./structures";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("how much a sled holds", () => {
  it("holds 24 planks when it has no logs, and 4 planks in each log space", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const sledId = idOf(game, sled);

    expect(game.client.describeSled(sledId)).toMatchObject({ total: 0, capacity: 6, logsThatFit: 6, planksThatFit: 24 });
    sled.sled = { log: 5, debarkedLog: 0, plank: 0 };
    expect(game.client.describeSled(sledId)).toMatchObject({ total: 5, logsThatFit: 1, planksThatFit: 4 });
    sled.sled = { log: 2, debarkedLog: 1, plank: 6 };
    expect(game.client.describeSled(sledId)).toMatchObject({ total: 4.5, logsThatFit: 1, planksThatFit: 6 });
  });

  it("lets logs and planks share a sled, and keeps a log off when no whole log space is free", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const sledId = idOf(game, sled);
    sled.sled = { log: 5, debarkedLog: 0, plank: 1 };

    shoulder(game, "debarkedLog");
    sendAndSettle(game, { type: "loadSled", sledId });

    expect(sled.sled).toEqual({ log: 5, debarkedLog: 0, plank: 1 });
    expect(game.client.getView().carrying).toBe("debarkedLog");

    sled.sled = { log: 4, debarkedLog: 0, plank: 4 };
    sendAndSettle(game, { type: "loadSled", sledId });
    expect(sled.sled).toEqual({ log: 4, debarkedLog: 1, plank: 4 });
    expect(game.client.getView().carrying).toBeNull();
  });
});

describe("loading planks on a sled", () => {
  it("moves every plank from the backpack onto the sled, walking the player to it first", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    give(game, 6);
    walkAway(game, sled);

    sendAndSettle(game, { type: "loadPlanksOnSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 0, debarkedLog: 0, plank: 6 });
    expect(game.client.getView().backpack.plank ?? 0).toBe(0);
  });

  it("moves only as many planks as the sled has room for, and leaves the rest in the backpack", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 5, debarkedLog: 0, plank: 1 };
    give(game, 6);

    sendAndSettle(game, { type: "loadPlanksOnSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 5, debarkedLog: 0, plank: 4 });
    expect(game.client.getView().backpack.plank).toBe(3);
  });
});

describe("taking planks from a sled", () => {
  it("moves every plank into the backpack when they all fit", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 1, debarkedLog: 0, plank: 3 };

    sendAndSettle(game, { type: "takePlanksFromSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0, plank: 0 });
    expect(game.client.getView().backpack.plank).toBe(3);
    expect(game.client.getView().notice).toBeNull();
  });

  it("moves as many as fit, and leaves the rest on the sled", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 0, debarkedLog: 0, plank: 24 };
    const roomKg = 20 - game.client.getView().backpackWeight;
    const fit = Math.floor(roomKg / 2 + 1e-9);
    expect(fit).toBeGreaterThan(0);
    expect(fit).toBeLessThan(24);

    sendAndSettle(game, { type: "takePlanksFromSled", sledId: idOf(game, sled) });

    expect(game.client.getView().backpack.plank).toBe(fit);
    expect(sled.sled.plank).toBe(24 - fit);
  });

  it("says the backpack is full when no plank fits", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 0, debarkedLog: 0, plank: 2 };
    fillBackpack(game);

    sendAndSettle(game, { type: "takePlanksFromSled", sledId: idOf(game, sled) });

    expect(sled.sled.plank).toBe(2);
    expect(game.client.getView().notice).toEqual({ kind: "backpackFull" });
  });
});

describe("tipping out a sled with planks", () => {
  it("lays the logs beside it and drops every plank in one pile beside it", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 2, debarkedLog: 0, plank: 7 };

    sendAndSettle(game, { type: "tipOutSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 0, debarkedLog: 0, plank: 0 });
    const piles = plankPilesNear(game, sled);
    expect(piles.map(({ pile }) => pile)).toEqual([{ content: "plank", count: 7 }]);
  });

  it("puts the logs on a woodpile next to the sled, but never the planks", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const woodpile = woodpileBeside(game, sled);
    sled.sled = { log: 2, debarkedLog: 0, plank: 5 };

    sendAndSettle(game, { type: "tipOutSled", sledId: idOf(game, sled) });

    expect(woodpile.woodpile).toEqual({ log: 2, debarkedLog: 0, firewood: 0 });
    expect(plankPilesNear(game, sled).map(({ pile }) => pile)).toEqual([{ content: "plank", count: 5 }]);
  });
});

describe("taking down a sled with planks", () => {
  it("drops its planks in one pile beside it", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 0, debarkedLog: 0, plank: 9 };
    const where = { ...sled.position };

    send(game, { type: "takeDown", pieceId: idOf(game, sled) });
    stepUntil(game, () => !game.entities.has(sled));

    expect(plankPilesNear(game, { position: where }).map(({ pile }) => pile)).toEqual([{ content: "plank", count: 9 }]);
  });
});

describe("saving planks on a sled", () => {
  it("keeps the planks on each sled", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 1, debarkedLog: 2, plank: 11 };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");
    expect(loaded.game.entities.with("sled").first?.sled).toEqual({ log: 1, debarkedLog: 2, plank: 11 });
  });

  it("raises the save version, and loads a sled from an older save with no planks on it", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 3, debarkedLog: 1, plank: 0 };
    const save = JSON.parse(JSON.stringify({ ...writeSave(game), version: SLED_PLANKS_SAVE_VERSION - 1 })) as {
      entities: { components: Record<string, unknown> }[];
    };
    for (const { components } of save.entities) if (components.sled !== undefined) components.sled = { log: 3, debarkedLog: 1 };

    expect(SLED_PLANKS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The older save did not load");
    expect(loaded.game.entities.with("sled").first?.sled).toEqual({ log: 3, debarkedLog: 1, plank: 0 });
  });
});

/** The plank piles within a few metres of a spot. */
function plankPilesNear(game: Game, near: { position: { x: number; z: number } }) {
  return game.entities
    .with("pile", "position")
    .entities.filter(({ pile, position }) => pile.content === "plank" && Math.hypot(position.x - near.position.x, position.z - near.position.z) < 3);
}

/** Builds a woodpile on the grid point just off one side of a sled. */
function woodpileBeside(game: Game, sled: Entity & { position: { x: number; z: number } }) {
  send(game, place("woodpile", Math.round(sled.position.x), Math.round(sled.position.z) + 1, 0));
  const blueprint = onlyBlueprint(game);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
  const woodpile = game.entities.with("woodpile", "position").first;
  if (woodpile === undefined) throw new Error("No woodpile");
  return woodpile;
}

/** Builds a finished, empty sled on open ground a few metres from the player. */
function finishedSledNearPlayer(game: Game): Entity & { sled: SledLoad; position: NonNullable<Entity["position"]> } {
  const square = openSquareNearPlayer(game);
  send(game, place("sled", square.x + 0.1, square.z + 0.2, 0));
  const blueprint = onlyBlueprint(game);
  for (const { material, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    for (let i = 0; i < needs; i += 1) {
      game.entities.addComponent(onlyPlayer(game), "carrying", material === "debarkedLog" ? "debarkedLog" : "log");
      send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
      stepUntil(game, () => game.client.getView().carrying === null);
    }
  }
  const contents = onlyPlayer(game).backpack.contents;
  contents.stick = (contents.stick ?? 0) + SLED_STICK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
  const sled = blueprint.sled;
  if (sled === undefined) throw new Error("The sled was not finished");
  return Object.assign(blueprint, { sled });
}

/** Walks the player some way from a thing. */
function walkAway(game: Game, thing: { position: { x: number; z: number } }): void {
  send(game, { type: "walkTo", x: thing.position.x + 8, z: thing.position.z });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

/** Puts planks straight in the player's backpack, whatever their weight. */
function give(game: Game, planks: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.plank = (contents.plank ?? 0) + planks;
}

/** Fills the backpack to its weight limit with firewood, which weighs 1.5 kg a piece, so no plank fits. */
function fillBackpack(game: Game): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.firewood = (contents.firewood ?? 0) + Math.ceil((20 - game.client.getView().backpackWeight) / 1.5);
}

/** Puts a log or debarked log straight on the player's shoulder. */
function shoulder(game: Game, log: "log" | "debarkedLog"): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", log);
}

/** Sends a command, then lets the player walk to where they carry it out. */
function sendAndSettle(game: Game, command: Command): void {
  send(game, command);
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined && onlyPlayer(game).approach === undefined);
  finishReach(game);
}

/** The middle of a building-grid square some metres from the player, with open ground all round it. */
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

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
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
