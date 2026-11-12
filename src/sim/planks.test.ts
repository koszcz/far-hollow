import { describe, expect, it } from "bun:test";
import type { BackpackContent, Command } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { CRAFTING_SAVE_VERSION, NOTICES_NAME_STATION_SAVE_VERSION, PLANKS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { groundDistance } from "./valley";
import { isWalkable } from "./walk-map";

describe("cutting planks at the sawhorse", () => {
  it("walks the player to the sawhorse from the craft menu, then turns the debarked log beside it into four planks in eight seconds", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);
    const start = { ...onlyPlayer(game).position };
    expect(groundDistance(start, sawhorse.position)).toBeGreaterThan(4);

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    expect(groundDistance(onlyPlayer(game).position, sawhorse.position)).toBeLessThanOrEqual(2);
    expect(groundDistance(onlyPlayer(game).position, start)).toBeGreaterThan(0);

    runSeconds(game, 7.5);
    expect(game.entities.has(log)).toBe(true);
    expect(game.client.getView().backpack.plank).toBeUndefined();

    runSeconds(game, 0.6);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(false);
    expect(game.client.getView().backpack.plank).toBe(4);
    expect(game.client.getView().backpack.saw).toBe(1);
  });

  it("walks the player to the sawhorse they chose, when sent with its id, as a right-click does", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    expect(groundDistance(onlyPlayer(game).position, sawhorse.position)).toBeLessThanOrEqual(2);
    runSeconds(game, 8.1);
    expect(game.client.getView().backpack.plank).toBe(4);
  });

  it("does not start without a debarked log within 2 m of the sawhorse, and says why", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 2.5);
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
    runSeconds(game, 10);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(true);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("stops and says why when the debarked log is gone by the time the player reaches the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    expect(game.client.getView().notice).toBeNull();
    game.entities.remove(log);
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    game.step();
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
  });

  it("does not start without the saw, and names what is missing, as a right-click on the sawhorse does", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    expect(game.client.getView().notice).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "tool", tool: "saw" }] });
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("leaves the debarked log where it was when the player stops partway, and starts again from the beginning next time", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    const logSpot = { ...log.position };
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    runSeconds(game, 6);
    walkAwayFrom(game, sawhorse);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(true);
    expect(log.position).toEqual<unknown>(logSpot);
    expect(game.client.getView().backpack.plank).toBeUndefined();

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    runSeconds(game, 2);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.25, 1);
  });

  it("does not start while the player carries a log, and says to put it down first", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    onlyPlayer(game).carrying = "debarkedLog";

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice?.kind).toBe("putLogDownFirst");
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("weighs 2 kg a plank, and does not start if four planks would not fit in the backpack", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    // The starting kit (5.4 kg) and the saw (1 kg) weigh 6.4 kg. Seven pieces of firewood (10.5 kg) bring it to 16.9 kg,
    // so four planks (8 kg) would go over the 20 kg limit.
    give(game, { saw: 1, firewood: 7 });

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();

    onlyPlayer(game).backpack.contents.firewood = 3;
    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().backpack.plank !== undefined);
    // 6.4 kg, 4.5 kg of firewood, and 8 kg of planks.
    expect(game.client.getView().backpackWeight).toBeCloseTo(18.9);
  });
});

describe("cutting planks in the craft menu", () => {
  it("lists cutting planks with the debarked log it uses, and shows the saw and the sawhorse as missing until the player has both", () => {
    const game = createGame({ seed: 42 });
    const entry = () => game.client.getView().craftMenu.find(({ kind }) => kind === "planks");
    expect(entry()).toMatchObject({
      materials: [],
      besideStation: [{ material: "debarkedLog", count: 1 }],
      result: { content: "plank", count: 4 },
      seconds: 8,
      tool: "saw",
      station: "sawhorse",
      lacks: [
        { kind: "tool", tool: "saw" },
        { kind: "station", station: "sawhorse" },
      ],
    });

    give(game, { saw: 1 });
    game.step();
    expect(entry()?.lacks).toEqual([{ kind: "station", station: "sawhorse" }]);

    finishedSawhorseNearPlayer(game);
    expect(entry()?.lacks).toEqual([]);
  });
});

describe("a sawhorse blueprint", () => {
  it("is not a work station: the menu still says the sawhorse is missing, and cutting planks does not start at it", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sawhorseBlueprintNearPlayer(game);
    const log = debarkedLogBeside(game, blueprint, 1);
    give(game, { saw: 1 });
    game.step();
    expect(game.client.getView().craftMenu.find(({ kind }) => kind === "planks")?.lacks).toEqual([{ kind: "station", station: "sawhorse" }]);

    send(game, { type: "craft", recipe: "planks" });
    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, blueprint) });
    runSeconds(game, 10);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(true);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("does not count when a finished sawhorse stands elsewhere: the right-click on the blueprint does nothing", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    const blueprint = sawhorseBlueprintNearPlayer(game, 12);
    debarkedLogBeside(game, blueprint, 1);
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, blueprint) });
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });
});

describe("saving planks", () => {
  it("keeps planks in the backpack, at a newer save version", () => {
    const game = createGame({ seed: 42 });
    give(game, { plank: 4 });
    const saved = writeSave(game);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(PLANKS_SAVE_VERSION).toBeGreaterThan(CRAFTING_SAVE_VERSION);

    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack.plank).toBe(4);
  });

  it("loads a save from before planks", () => {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as { version: number };
    save.version = PLANKS_SAVE_VERSION - 1;
    expect(readSave(save).ok).toBe(true);
  });
});

describe("saving a notice about crafting", () => {
  it("keeps what the notice names, such as the station or the missing tool", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    const notice = game.client.getView().notice;
    expect(notice?.kind).toBe("cannotCraftYet");

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().notice).toEqual(notice);
  });

  it("names the sawhorse in a notice that no log lies beside the station, from a save made before notices named it", () => {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as { version: number; notice: unknown };
    save.version = NOTICES_NAME_STATION_SAVE_VERSION - 1;
    save.notice = { kind: "noLogBesideStation", untilMinutes: 10_000 };

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
  });
});

/** Walks the player to a spot 5 m from the sawhorse, on its far side from the log. */
function walkAwayFrom(game: Game, sawhorse: Entity & { position: NonNullable<Entity["position"]> }): void {
  send(game, { type: "walkTo", x: sawhorse.position.x, z: sawhorse.position.z - 5 });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

/** Lays a debarked log on the ground `metres` from a sawhorse, on its open side. */
function debarkedLogBeside(game: Game, sawhorse: Entity & { position: NonNullable<Entity["position"]> }, metres: number): Entity {
  const { x, y, z } = sawhorse.position;
  return game.entities.add({ debarkedLog: { heading: 0 }, position: { x, y, z: z + metres } });
}

/** Places a sawhorse blueprint on open ground a few metres from the player and builds it. */
function finishedSawhorseNearPlayer(game: Game, from = 5) {
  const square = openSquareNearPlayer(game, from);
  send(game, { type: "placeBlueprint", structure: "sawhorse", turns: 0, x: square.x + 0.5, z: square.z + 0.5 });
  const sawhorse = onlyBlueprint(game);
  buildFully(game, sawhorse);
  return sawhorse;
}

/** Places a sawhorse blueprint on open ground a few metres from the player, and leaves it unbuilt. */
function sawhorseBlueprintNearPlayer(game: Game, from = 5) {
  const square = openSquareNearPlayer(game, from);
  send(game, { type: "placeBlueprint", structure: "sawhorse", turns: 0, x: square.x + 0.5, z: square.z + 0.5 });
  return onlyBlueprint(game);
}

/** Carries the debarked logs a blueprint needs to it, one at a time, and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const id = idOf(game, blueprint);
  const needs = game.client.describeBlueprint(id)?.deliveries[0]?.needs ?? 0;
  for (let i = 0; i < needs; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: id });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  send(game, { type: "build", blueprintId: id });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** The middle of a building-grid square some metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game, from: number): { x: number; z: number } {
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

/** Puts more things in the player's backpack, whatever their weight. */
function give(game: Game, contents: Partial<Record<BackpackContent, number>>): void {
  const backpack = onlyPlayer(game).backpack.contents;
  for (const [content, count] of Object.entries(contents) as [BackpackContent, number][]) backpack[content] = (backpack[content] ?? 0) + count;
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
