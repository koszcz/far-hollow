import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { logEntities, lyingThings, type Entity, type Vec3 } from "./entities";
import { createGame, type Game } from "./game";
import { PLANT_MUSHROOM_SECONDS } from "./mushroom-logs";
import { createNeeds } from "./needs";
import { MUSHROOM_LOGS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("planting a mushroom on a log", () => {
  it("takes a few seconds, uses one mushroom, needs no tool, and turns the log into a mushroom log where it lies", () => {
    const game = gameWithMushrooms(2);
    emptyToolsFrom(game);
    const log = looseLog(game);
    const lay = { ...log.position };
    expect(game.client.refusal(plantOn(game, log))).toBeNull();

    game.client.send(plantOn(game, log));
    stepUntil(game, () => game.client.getView().action?.kind === "plantMushroom");
    expect(game.client.getView().backpack.mushroom).toBe(2);
    stepUntil(game, () => game.client.getView().action === null);

    expect(PLANT_MUSHROOM_SECONDS).toBeGreaterThanOrEqual(2);
    expect(PLANT_MUSHROOM_SECONDS).toBeLessThanOrEqual(6);
    expect(game.client.getView().backpack.mushroom).toBe(1);
    expect(log.log).toBeUndefined();
    expect(log.mushroomLog).toEqual({ heading: 0.5 });
    expect(log.position).toEqual(lay);
  });
});

describe("which logs take a mushroom", () => {
  it("refuses a debarked log", () => {
    const game = gameWithMushrooms(1);
    const { position } = onlyPlayer(game);
    const debarked = game.entities.add({ debarkedLog: { heading: 0 }, position: { x: position.x + 2, y: position.y, z: position.z } });

    expect(game.client.refusal(plantOn(game, debarked))).toEqual({ kind: "needsPlainLog" });
  });

  it("refuses while the backpack holds no mushroom", () => {
    const game = gameWithMushrooms(0);
    const log = looseLog(game);

    expect(game.client.refusal(plantOn(game, log))).toEqual({ kind: "noMushroom" });
  });

  it("refuses a log that is gone", () => {
    const game = gameWithMushrooms(1);
    const log = looseLog(game);
    const command = plantOn(game, log);
    game.entities.remove(log);

    expect(game.client.refusal(command)).toEqual({ kind: "gone" });
  });
});

describe("a mushroom log", () => {
  it("bears its first mushrooms 2 days after planting", () => {
    const game = gameWithMushrooms(1);
    const mushroomLog = plantedLog(game);
    const forage: Command = { type: "forage", spotId: idOf(game, mushroomLog) };

    passHours(game, 47);
    expect(game.client.refusal(forage)).toEqual({ kind: "nothingToTake" });
    passHours(game, 2);
    expect(game.client.refusal(forage)).toBeNull();
  });

  it("is foraged like a mushroom patch, for 2 mushrooms, and grows them back 3 days later", () => {
    const game = gameWithMushrooms(1);
    const mushroomLog = plantedLog(game);
    const forage: Command = { type: "forage", spotId: idOf(game, mushroomLog) };
    passHours(game, 49);

    game.client.send(forage);
    stepUntil(game, () => mushroomLog.regrowing !== undefined);
    expect(game.client.getView().backpack.mushroom).toBe(2);
    expect(game.client.refusal(forage)).toEqual({ kind: "nothingToTake" });

    passHours(game, 71);
    expect(game.client.refusal(forage)).toEqual({ kind: "nothingToTake" });
    passHours(game, 2);
    expect(game.client.refusal(forage)).toBeNull();
  });

  it("cannot be picked up, split, or debarked, and is no log for building or crafting", () => {
    const game = gameWithMushrooms(1);
    const mushroomLog = plantedLog(game);
    const logId = idOf(game, mushroomLog);

    for (const command of [
      { type: "pickUpLog", logId },
      { type: "splitLog", logId },
      { type: "debarkLog", logId },
    ] as const) {
      game.client.send(command);
      for (let step = 0; step < 600; step += 1) game.step();
      finishReach(game);
    }

    expect(onlyPlayer(game).carrying).toBeUndefined();
    expect(mushroomLog.mushroomLog).toBeDefined();
    expect(game.entities.entity(logId)).toBe(mushroomLog);
    expect(logEntities(game.entities).entities).not.toContain(mushroomLog);
  });

  it("stays where it lies for good, and does not block walking", () => {
    const game = gameWithMushrooms(1);
    const mushroomLog = plantedLog(game);
    const lay = { ...mushroomLog.position };
    passHours(game, 30 * 24);

    expect(mushroomLog.mushroomLog).toBeDefined();
    expect(mushroomLog.position).toEqual(lay);
    expect(isWalkable(game.walkMap, lay)).toBe(true);
  });

  it("can be taken down, and vanishes, giving nothing back", () => {
    const game = gameWithMushrooms(1);
    const mushroomLog = plantedLog(game);
    const command: Command = { type: "takeDownMushroomLog", mushroomLogId: idOf(game, mushroomLog) };
    const before = { ...game.client.getView().backpack };
    const lying = lyingThings(game.entities).length;
    expect(game.client.refusal(command)).toBeNull();

    game.client.send(command);
    stepUntil(game, () => game.entities.id(mushroomLog) === undefined);

    expect(game.client.getView().backpack).toEqual(before);
    expect(game.client.getView().carrying).toBeNull();
    expect(lyingThings(game.entities).length).toBe(lying);
  });
});

describe("building near a mushroom log", () => {
  it("refuses a blueprint or foundation that would cover it, and says why", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    give(game, 1);
    const mushroomLog = plantedLog(game);
    const check = game.client.checkPlacement("foundation", mushroomLog.position, 0);
    expect(check.allowed).toBe(false);
    expect(check.refusal).toEqual({ kind: "coversMushroomLog" });

    const place: Command = { type: "placeBlueprint", structure: "campfire", turns: 0, x: mushroomLog.position.x, z: mushroomLog.position.z };
    expect(game.client.refusal(place)).toEqual({ kind: "coversMushroomLog" });
    const blueprints = game.entities.with("blueprint").entities.length;
    game.client.send(place);
    game.step();
    expect(game.entities.with("blueprint").entities.length).toBe(blueprints);
    expect(game.client.getView().notice).toEqual({ kind: "refused", refusal: { kind: "coversMushroomLog" } });
  });
});

describe("saving mushroom logs", () => {
  it("saves a mushroom log and the time left until it bears mushrooms", () => {
    const game = gameWithMushrooms(1);
    const mushroomLog = plantedLog(game);
    passHours(game, 30);
    const id = idOf(game, mushroomLog);

    const loaded = reload(game);
    const saved = loaded.entities.entity(id);
    expect(saved?.mushroomLog).toEqual(mushroomLog.mushroomLog);
    expect(saved?.regrowing).toEqual(mushroomLog.regrowing);
    passHours(loaded, 19);
    expect(loaded.client.refusal({ type: "forage", spotId: id })).toBeNull();
  });

  it("saves planting under way", () => {
    const game = gameWithMushrooms(1);
    const log = looseLog(game);
    const id = idOf(game, log);
    game.client.send(plantOn(game, log));
    stepUntil(game, () => game.client.getView().action?.kind === "plantMushroom");

    const loaded = reload(game);
    expect(loaded.client.getView().action?.kind).toBe("plantMushroom");
    stepUntil(loaded, () => loaded.client.getView().action === null);
    expect(loaded.entities.entity(id)?.mushroomLog).toBeDefined();
  });

  it("raises the save version, and loads a save from before mushroom logs", () => {
    expect(MUSHROOM_LOGS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const game = gameWithMushrooms(1);
    const log = looseLog(game);
    const older = JSON.parse(JSON.stringify({ ...writeSave(game), version: MUSHROOM_LOGS_SAVE_VERSION - 1 })) as ReturnType<typeof writeSave>;

    const loaded = readSave(older);
    if (!loaded.ok) throw new Error("The older save was rejected");
    expect(loaded.game.entities.entity(idOf(game, log))?.log).toEqual({ heading: 0.5 });
  });
});

type Placed = Entity & { position: Vec3 };

/** A mushroom log planted 2 m from the player. */
function plantedLog(game: Game): Placed {
  const log = looseLog(game);
  game.client.send(plantOn(game, log));
  stepUntil(game, () => log.mushroomLog !== undefined);
  return log;
}

function reload(game: Game): Game {
  const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
  if (!loaded.ok) throw new Error("The save was rejected");
  return loaded.game;
}

/** Skips this many game hours, an hour at a time, with the player's needs filled before each hour. */
function passHours(game: Game, hours: number): void {
  const player = onlyPlayer(game);
  for (let hour = 0; hour < hours; hour += 1) {
    Object.assign(player.needs ?? {}, createNeeds());
    game.client.send({ type: "skipTime", hours: 1 });
    game.step();
  }
}

function plantOn(game: Game, log: Entity): Command {
  return { type: "plantMushroom", logId: idOf(game, log) };
}

function gameWithMushrooms(count: number): Game {
  const game = createGame({ seed: 42 });
  give(game, count);
  return game;
}

function give(game: Game, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  if (count === 0) delete backpack.contents.mushroom;
  else backpack.contents.mushroom = count;
}

/** Leaves only mushrooms in the backpack, so nothing the player does can lean on a tool. */
function emptyToolsFrom(game: Game): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents = { mushroom: backpack.contents.mushroom ?? 0 };
}

/** A plain log lying loose on the ground 2 m from the player. */
function looseLog(game: Game): Placed {
  const { position } = onlyPlayer(game);
  return game.entities.add({ log: { heading: 0.5 }, position: { x: position.x + 2, y: position.y, z: position.z } });
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let steps = 0; !done(); steps += 1) {
    if (steps > 100_000) throw new Error("Gave up waiting");
    game.step();
  }
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
