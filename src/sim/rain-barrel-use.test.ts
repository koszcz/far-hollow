import { describe, expect, it } from "bun:test";
import { type Command } from "./api-commands";
import { addToBackpack } from "./backpack";
import { createGame } from "./game";
import { FULL_NEED } from "./needs";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { RAIN_BARRELS_SAVE_VERSION } from "./save-versions";
import { finishReach, piecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";
import {
  blueprintOf,
  buildFully,
  drink,
  finishedBarrelNearPlayer,
  idOf,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  runSeconds,
  send,
  stepUntil,
  walkTo,
} from "./rain-barrel-test-helpers";

describe("drinking from a rain barrel", () => {
  it("fills thirst completely, takes out 1 drink, and never makes the player sick", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 2, progress: 0.4 };
    onlyPlayer(game).needs.thirst.level = 0.2;

    drink(game, barrel);

    expect(onlyPlayer(game).needs.thirst.level).toBeCloseTo(FULL_NEED, 2);
    expect(onlyPlayer(game).sickness).toBeUndefined();
    expect(barrel.rainBarrel).toEqual({ held: 1, progress: 0.4 });
  });

  it("walks the player within reach first", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("rainBarrel", square.x, square.z, 0));
    const barrel = blueprintOf(game, "rainBarrel");
    buildFully(game, barrel);
    walkTo(game, { x: square.x + 6, z: square.z });
    barrel.rainBarrel = { held: 1, progress: 0 };
    onlyPlayer(game).needs.thirst.level = 0.2;

    send(game, { type: "drinkFromRainBarrel", barrelId: idOf(game, barrel) });
    stepUntil(game, () => barrel.rainBarrel?.held === 0);

    const { x, z } = onlyPlayer(game).position;
    expect(Math.hypot(x - square.x, z - square.z)).toBeLessThan(2.5);
    expect(onlyPlayer(game).needs.thirst.level).toBeCloseTo(FULL_NEED, 2);
  });

  it("is refused while the barrel is empty", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    onlyPlayer(game).needs.thirst.level = 0.2;
    const command: Command = { type: "drinkFromRainBarrel", barrelId: idOf(game, barrel) };

    expect(game.client.refusal(command)).toEqual({ kind: "barrelEmpty" });
    send(game, command);
    runSeconds(game, 3);
    expect(onlyPlayer(game).needs.thirst.level).toBeLessThan(0.21);
  });
});

describe("filling the pot from a rain barrel", () => {
  it("turns the empty pot into a pot of clean water and takes out 1 drink", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };

    send(game, { type: "fillPotFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    expect(game.client.getView().backpack).toMatchObject({ pot: 0, potOfBoiledWater: 1 });
    expect(barrel.rainBarrel.held).toBe(2);
  });

  it("gives a pot the player can drink from safely", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 1, progress: 0 };
    send(game, { type: "fillPotFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);
    onlyPlayer(game).needs.thirst.level = 0.2;

    send(game, { type: "drinkFromPot" });

    expect(onlyPlayer(game).needs.thirst.level).toBeCloseTo(FULL_NEED, 2);
    expect(onlyPlayer(game).sickness).toBeUndefined();
    expect(game.client.getView().backpack).toMatchObject({ pot: 1 });
  });

  it("is refused while the barrel is empty, or the backpack holds no empty pot", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    const command: Command = { type: "fillPotFromRainBarrel", barrelId: idOf(game, barrel) };

    expect(game.client.refusal(command)).toEqual({ kind: "barrelEmpty" });

    barrel.rainBarrel = { held: 2, progress: 0 };
    const backpack = onlyPlayer(game).backpack;
    delete backpack.contents.pot;
    backpack.contents.potOfRiverWater = 1;
    expect(game.client.refusal(command)).toEqual({ kind: "noEmptyPot" });

    send(game, command);
    finishReach(game);
    expect(barrel.rainBarrel.held).toBe(2);
  });
});

describe("filling a jug from a rain barrel", () => {
  it("pours 1 drink from the barrel into a jug", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };
    onlyPlayer(game).backpack.contents.jug = 1;

    send(game, { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    expect(game.client.getView().backpack).toMatchObject({ jugWith1Drink: 1 });
    expect(game.client.getView().backpack.jug ?? 0).toBe(0);
    expect(barrel.rainBarrel.held).toBe(2);
  });

  it("fills the fullest jug that still has room", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };
    Object.assign(onlyPlayer(game).backpack.contents, { jug: 1, jugWith1Drink: 1, jugWith3Drinks: 1 });

    send(game, { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    const view = game.client.getView().backpack;
    expect(view).toMatchObject({ jug: 1, jugWith2Drinks: 1, jugWith3Drinks: 1 });
    expect(view.jugWith1Drink ?? 0).toBe(0);
  });

  it("fills a jug up to 3 drinks, then refuses because every jug is full", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 5, progress: 0 };
    onlyPlayer(game).backpack.contents.jug = 1;
    const command: Command = { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) };

    for (let fill = 0; fill < 3; fill += 1) {
      send(game, command);
      finishReach(game);
    }

    expect(game.client.getView().backpack).toMatchObject({ jugWith3Drinks: 1 });
    expect(barrel.rainBarrel.held).toBe(2);
    expect(game.client.refusal(command)).toEqual({ kind: "noJugWithRoom" });
    send(game, command);
    finishReach(game);
    expect(barrel.rainBarrel.held).toBe(2);
  });

  it("is refused while the barrel is empty, or the backpack holds no jug", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    onlyPlayer(game).backpack.contents.jug = 1;
    const command: Command = { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) };

    expect(game.client.refusal(command)).toEqual({ kind: "barrelEmpty" });

    barrel.rainBarrel = { held: 2, progress: 0 };
    delete onlyPlayer(game).backpack.contents.jug;
    expect(game.client.refusal(command)).toEqual({ kind: "noJug" });
  });

  it("leaves the jug and the barrel as they were when the heavier jug does not fit in the backpack", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 2, progress: 0 };
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.jug = 1;
    while (addToBackpack(backpack, "stone", 1));

    send(game, { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    expect(game.client.getView().backpack).toMatchObject({ jug: 1 });
    expect(barrel.rainBarrel.held).toBe(2);
  });
});

describe("saving rain barrels", () => {
  it("raises the save version for rain barrels, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(RAIN_BARRELS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = RAIN_BARRELS_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps a barrel's spot, facing, drinks, and progress toward the next drink", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("rainBarrel", square.x, square.z, 3));
    const barrel = blueprintOf(game, "rainBarrel");
    buildFully(game, barrel);
    barrel.rainBarrel = { held: 4, progress: 0.25 };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const [saved] = piecesOf(loaded.game.entities, "rainBarrel");
    expect(saved?.position).toMatchObject({ x: square.x, z: square.z });
    expect(saved?.facing).toEqual({ turns: 3 });
    expect(saved?.rainBarrel).toEqual({ held: 4, progress: 0.25 });
    expect(isWalkable(loaded.game.walkMap, square)).toBe(false);
  });

  it("turns away a barrel whose water has the wrong shape", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 4, progress: 0.25 };
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    const saved = save.entities.find(({ components }) => components.furniture === "rainBarrel");
    if (saved === undefined) throw new Error("No saved barrel");
    saved.components.rainBarrel = { held: -1, progress: 0.25 };

    expect(readSave(save).ok).toBe(false);
  });
});
