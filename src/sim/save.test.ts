import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./building";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { continueOrStartGame, describeSave, readSave, SAVE_UPGRADES, SAVE_VERSION, upgradeSave, writeSave, type SaveFile, type SaveUpgrade } from "./save";
import { isWalkable } from "./walk-map";

describe("saving and loading a game", () => {
  it("restores a played valley exactly: clock, player, backpack, logs, stumps, sticks, blueprints, and campfires", () => {
    const game = playedGame();
    const saved = writeSave(game);
    const components = saved.entities.map((entity) => entity.components);
    expect(components.some((entity) => entity.stump)).toBe(true);
    expect(components.some((entity) => entity.log)).toBe(true);
    expect(components.some((entity) => entity.campfire?.lit)).toBe(true);
    expect(components.some((entity) => (entity.blueprint?.progress ?? 0) > 0)).toBe(true);

    const loaded = readSave(throughStorage(saved));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game)).toEqual(saved);
    expect(loaded.game.client.getView()).toEqual(game.client.getView());
  });

  it("carries on exactly as the saved game would have", () => {
    const game = playedGame();
    const loaded = readSave(throughStorage(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    for (const each of [game, loaded.game]) {
      const player = onlyPlayer(each);
      each.client.send({ type: "walkTo", x: player.position.x - 10, z: player.position.z });
      runSeconds(each, 20);
      each.client.send({ type: "skipTime", hours: 14 });
      runSeconds(each, 1);
    }

    expect(writeSave(loaded.game)).toEqual(writeSave(game));
  });
});

describe("upgrading an older save", () => {
  // These use made-up upgrades to versions 2 and 3, so they test the upgrade steps apart from the game's real ones.
  const upgrades: SaveUpgrade[] = [
    (save) => ({ ...save, hunger: 1 }),
    (save) => ({ ...save, needs: { hunger: save.hunger, thirst: 1 }, hunger: undefined }),
  ];

  it("upgrades one version at a time, in order, up to the newest", () => {
    expect(upgradeSave({ version: 1, seed: 3 }, upgrades)).toEqual({
      version: 3,
      seed: 3,
      needs: { hunger: 1, thirst: 1 },
      hunger: undefined,
    });
  });

  it("starts from the version the save has, skipping upgrades it already had", () => {
    expect(upgradeSave({ version: 2, seed: 3, hunger: 0.5 }, upgrades)).toMatchObject({
      version: 3,
      needs: { hunger: 0.5, thirst: 1 },
    });
  });

  it("leaves a save at the newest version as it is", () => {
    expect(upgradeSave({ version: 3, seed: 3 }, upgrades)).toEqual({ version: 3, seed: 3 });
  });

  it("refuses a save with no version, or one newer than this game knows", () => {
    expect(upgradeSave({ seed: 3 }, upgrades)).toBeUndefined();
    expect(upgradeSave({ version: 4, seed: 3 }, upgrades)).toBeUndefined();
    expect(upgradeSave({ version: 0, seed: 3 }, upgrades)).toBeUndefined();
    expect(upgradeSave("not a save", upgrades)).toBeUndefined();
  });

  it("writes saves at the newest version the game's own upgrades reach", () => {
    expect(writeSave(createGame({ seed: 1 })).version).toBe(SAVE_UPGRADES.length + 1);
  });

  it("brings a version 1 save through every real upgrade: the valley's food, a bedroll, then a pot", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Entity }[] };
    save.version = 1;
    save.entities = save.entities.filter((entity) => entity.components.forageSpot === undefined);
    for (const { components } of save.entities) {
      delete components.backpack?.contents.bedroll;
      delete components.backpack?.contents.pot;
    }

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.with("forageSpot").size).toBe(game.entities.with("forageSpot").size);
    expect(loaded.game.client.getView().backpack.bedroll).toBe(1);
    expect(loaded.game.client.getView().backpack.pot).toBe(1);
  });
});

describe("rejecting a broken save", () => {
  type Breakage = (save: SaveFile) => unknown;
  const player = (save: SaveFile): Entity => {
    const found = save.entities.find((entity) => entity.components.player)?.components;
    if (found === undefined) throw new Error("No player in the save");
    return found;
  };
  const breakages: Record<string, Breakage> = {
    "nothing at all": () => undefined,
    "text instead of a save": () => "far hollow",
    "a version from a newer game": (save) => ({ ...save, version: SAVE_VERSION + 1 }),
    "no seed": (save) => ({ ...save, seed: undefined }),
    "a clock that is not a number": (save) => ({ ...save, clockMinutes: "noon" }),
    "a clock that is not finite": (save) => ({ ...save, clockMinutes: null }),
    "no entity list": (save) => ({ ...save, entities: {} }),
    "no player": (save) => ({ ...save, entities: save.entities.filter((entity) => !entity.components.player) }),
    "two entities with the same id": (save) => ({ ...save, entities: [...save.entities, save.entities[0]] }),
    "a position missing a coordinate": (save) => {
      player(save).position = { x: 1, z: 2 } as never;
      return save;
    },
    "a component this game does not know": (save) => {
      Object.assign(player(save), { jetpack: true });
      return save;
    },
    "a backpack holding something unknown": (save) => {
      Object.assign(player(save).backpack?.contents ?? {}, { phone: 1 });
      return save;
    },
    "a notice of an unknown kind": (save) => ({ ...save, notice: { kind: "levelUp", untilMinutes: 600 } }),
  };

  for (const [name, breakSave] of Object.entries(breakages)) {
    it(`rejects a save with ${name}`, () => {
      const save = throughStorage(writeSave(createGame({ seed: 5 }))) as SaveFile;
      expect(readSave(throughStorage(breakSave(save)))).toEqual({ ok: false });
    });
  }

  it("accepts the same save when nothing is broken", () => {
    const save = throughStorage(writeSave(createGame({ seed: 5 })));
    expect(readSave(save).ok).toBe(true);
  });
});

describe("continuing or starting a game when the page loads", () => {
  it("continues the stored game", () => {
    const game = playedGame();
    const continued = continueOrStartGame(throughStorage(writeSave(game)), 99);
    expect(writeSave(continued)).toEqual(writeSave(game));
    expect(continued.client.getView().notice).toBeNull();
  });

  it("starts a new game from the given seed when nothing is stored, with no message", () => {
    const game = continueOrStartGame(undefined, 99);
    expect(writeSave(game)).toEqual(writeSave(createGame({ seed: 99 })));
    expect(game.client.getView().notice).toBeNull();
  });

  it("starts a new game and tells the player when the stored save is broken", () => {
    const game = continueOrStartGame({ version: SAVE_VERSION, seed: "broken" }, 99);
    expect(game.client.getView().seed).toBe(99);
    expect(game.client.getView().stepCount).toBe(0);
    expect(game.client.getView().notice).toBe("saveBroken");
  });
});

describe("describing a save slot on the start screen", () => {
  it("calls a slot with nothing stored empty", () => {
    expect(describeSave(undefined)).toEqual({ state: "empty" });
  });

  it("shows a filled slot's seed and the day it reached", () => {
    const game = createGame({ seed: 4321 });
    game.client.send({ type: "skipTime", hours: 20 });
    game.step();
    expect(describeSave(throughStorage(writeSave(game)))).toEqual({ state: "filled", seed: 4321, day: 2 });
  });

  it("shows a new game's slot on day 1", () => {
    expect(describeSave(throughStorage(writeSave(createGame({ seed: 8 }))))).toEqual({ state: "filled", seed: 8, day: 1 });
  });

  it("calls a slot broken when its save cannot be loaded", () => {
    expect(describeSave({ version: SAVE_VERSION, seed: "broken" })).toEqual({ state: "broken" });
    expect(describeSave("far hollow")).toEqual({ state: "broken" });
  });
});

/** Copies the save the way browser storage (IndexedDB) does, so nothing is shared with the live game. */
function throughStorage(save: unknown): unknown {
  return structuredClone(save);
}

/**
 * A game played for a while: a tree felled into a stump and a log, sticks picked up,
 * a lit campfire, an unfinished blueprint, and the clock moved on.
 */
function playedGame(): Game {
  const game = createGame({ seed: 7 });
  const tree = nearestTo(game, game.entities.with("tree", "position").entities);
  send(game, { type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => game.entities.with("log").first !== undefined);

  give(game, "stick", CAMPFIRE_STICK_COST + 3);
  const campfireSpot = openSpotNearPlayer(game, 3);
  send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: campfireSpot.x, z: campfireSpot.z });
  const blueprint = game.entities.with("blueprint").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.entities.with("campfire").first !== undefined);
  const campfire = game.entities.with("campfire").first;
  if (campfire === undefined) throw new Error("No campfire");
  send(game, { type: "tendCampfire", campfireId: idOf(game, campfire) });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
  send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

  const secondSpot = openSpotNearPlayer(game, 8);
  send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: secondSpot.x, z: secondSpot.z });
  const unfinished = game.entities.with("blueprint").first;
  if (unfinished === undefined) throw new Error("No second blueprint");
  send(game, { type: "build", blueprintId: idOf(game, unfinished) });
  stepUntil(game, () => game.client.getView().action?.kind === "build");
  runSeconds(game, CAMPFIRE_BUILD_SECONDS / 2);
  send(game, { type: "stopBuilding" });

  const stick = nearestTo(game, game.entities.with("stick", "position").entities);
  send(game, { type: "pickUpStick", stickId: idOf(game, stick) });
  runSeconds(game, 1);
  return game;
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

function give(game: Game, content: "stick", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

function openSpotNearPlayer(game: Game, from: number): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const around = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([ax = 0, az = 0]) =>
        isWalkable(game.walkMap, { x: spot.x + ax, z: spot.z + az }),
      );
      if (around) return spot;
    }
  }
  throw new Error("No open spot");
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
