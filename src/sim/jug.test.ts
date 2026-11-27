import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { type Command } from "./api-commands";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG, type BackpackContents } from "./backpack";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { JUG_FIRING_SAVE_VERSION, JUG_WATER_SAVE_VERSION, readSave, SAVE_VERSION, writeSave, type SaveFile } from "./save";
import { byJug, drinksIn } from "./jug";
import { finishReach, storingPiecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("pouring clean water into a jug", () => {
  it("adds 1 drink to the jug and leaves the pot empty", () => {
    const game = gameHolding({ jug: 1, potOfBoiledWater: 1 });

    send(game, { type: "pourIntoJug" });

    expect(backpack(game)).toEqual({ jugWith1Drink: 1, pot: 1 });
  });

  it("goes into the fullest jug that still has room", () => {
    const game = gameHolding({ jug: 1, jugWith1Drink: 1, jugWith2Drinks: 1, jugWith3Drinks: 1, potOfBoiledWater: 1 });

    send(game, { type: "pourIntoJug" });

    expect(backpack(game)).toEqual({ jug: 1, jugWith1Drink: 1, jugWith3Drinks: 2, pot: 1 });
  });

  it("fills a jug up to 3 drinks and no further", () => {
    const game = gameHolding({ jug: 1 });
    for (let pour = 0; pour < 3; pour += 1) {
      onlyPlayer(game).backpack.contents.potOfBoiledWater = 1;
      send(game, { type: "pourIntoJug" });
    }
    expect(backpack(game)).toEqual({ jugWith3Drinks: 1, pot: 3 });

    onlyPlayer(game).backpack.contents.potOfBoiledWater = 1;
    expect(game.client.refusal({ type: "pourIntoJug" })).toEqual({ kind: "noJugWithRoom" });
    send(game, { type: "pourIntoJug" });
    expect(backpack(game)).toEqual({ jugWith3Drinks: 1, pot: 3, potOfBoiledWater: 1 });
  });

  it("is refused without a jug, which is not the same as every jug being full", () => {
    const game = gameHolding({ potOfBoiledWater: 1 });

    expect(game.client.refusal({ type: "pourIntoJug" })).toEqual({ kind: "noJug" });
    send(game, { type: "pourIntoJug" });
    expect(backpack(game)).toEqual({ potOfBoiledWater: 1 });
  });

  it("is refused without a pot of clean water, so a jug never holds river water", () => {
    for (const contents of [
      { jug: 1, pot: 1 },
      { jug: 1, potOfRiverWater: 1 },
    ] satisfies BackpackContents[]) {
      const game = gameHolding(contents);

      expect(game.client.refusal({ type: "pourIntoJug" })).toEqual({ kind: "noPotOfCleanWater" });
      send(game, { type: "pourIntoJug" });
      expect(backpack(game)).toEqual(contents);
    }
  });

  it("works with a full backpack, because the water only moves from the pot to the jug", () => {
    const game = gameHolding({ jug: 1, potOfBoiledWater: 1, stone: (BACKPACK_WEIGHT_LIMIT_KG - 4) / 2 });

    send(game, { type: "pourIntoJug" });

    expect(game.client.getView().backpack.jugWith1Drink).toBe(1);
    expect(game.client.getView().backpackWeight).toBeCloseTo(BACKPACK_WEIGHT_LIMIT_KG, 5);
  });
});

describe("drinking from a jug", () => {
  it("fills thirst completely, takes 1 drink out, and never makes the player sick", () => {
    const game = gameHolding({ jugWith3Drinks: 1 });
    skipMinutes(game, 6 * 60);
    expect(game.client.getView().needs.thirst).toBeLessThan(0.8);
    resume(game);

    send(game, { type: "drinkFromJug" });

    expect(game.client.getView().needs.thirst).toBeCloseTo(1, 2);
    expect(game.client.getView().sick).toBe(false);
    expect(backpack(game)).toEqual({ jugWith2Drinks: 1 });
    expect(game.client.getView().lastEatOrDrink).toEqual({ count: 1, kind: "drinkFromJug" });
  });

  it("comes from the emptiest jug that holds water", () => {
    const game = gameHolding({ jug: 1, jugWith2Drinks: 1, jugWith3Drinks: 1 });

    send(game, { type: "drinkFromJug" });

    expect(backpack(game)).toEqual({ jug: 1, jugWith1Drink: 1, jugWith3Drinks: 1 });
  });

  it("leaves an empty jug after the last drink, and is then refused", () => {
    const game = gameHolding({ jugWith1Drink: 1 });

    send(game, { type: "drinkFromJug" });
    expect(backpack(game)).toEqual({ jug: 1 });

    expect(game.client.refusal({ type: "drinkFromJug" })).toEqual({ kind: "noWaterInJug" });
    send(game, { type: "drinkFromJug" });
    expect(backpack(game)).toEqual({ jug: 1 });
    expect(game.client.getView().lastEatOrDrink?.count).toBe(1);
  });
});

describe("a table by jug fill level", () => {
  it("has one entry for each fill level", () => {
    expect(byJug(drinksIn)).toEqual({ jug: 0, jugWith1Drink: 1, jugWith2Drinks: 2, jugWith3Drinks: 3 });
  });
});

describe("the weight of a jug", () => {
  it("is 1 kg, plus 2 kg for each drink", () => {
    expect(CONTENT_WEIGHT_KG.jug).toBe(1);
    expect(CONTENT_WEIGHT_KG.jugWith1Drink).toBe(3);
    expect(CONTENT_WEIGHT_KG.jugWith2Drinks).toBe(5);
    expect(CONTENT_WEIGHT_KG.jugWith3Drinks).toBe(7);
  });
});

describe("dropping and storing jugs with water", () => {
  it("drops jugs in a pile that keeps their water, and jugs of the same fill level join one pile", () => {
    const game = gameHolding({ jugWith2Drinks: 2 });
    send(game, { type: "dropFromBackpack", content: "jugWith2Drinks" });
    onlyPlayer(game).backpack.contents = { jugWith2Drinks: 1 };
    send(game, { type: "dropFromBackpack", content: "jugWith2Drinks" });

    const pile = nearbyOf(game.client.getView(), "pile");
    expect(pile).toMatchObject({ content: "jugWith2Drinks", count: 3 });

    send(game, { type: "pickUpPile", pileId: pile?.id ?? -1 });
    stepUntil(game, () => game.client.getView().reach === null && onlyPlayer(game).walkPath === undefined);
    finishReach(game);
    expect(backpack(game)).toEqual({ jugWith2Drinks: 3 });
  });

  it("keeps a jug's water in a chest and on a shelf", () => {
    for (const furniture of ["chest", "shelf"] as const) {
      const game = createGame({ seed: 42, freeBuilding: true });
      const pieceId = buildStoringPiece(game, furniture);
      onlyPlayer(game).backpack.contents = { jugWith3Drinks: 1, jugWith1Drink: 1 };
      send(game, { type: "openChest", chestId: pieceId });
      stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
      finishReach(game);

      send(game, { type: "putInChest", chestId: pieceId, content: "jugWith3Drinks", all: false });
      finishReach(game);
      expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ jugWith3Drinks: 1 });

      send(game, { type: "takeFromChest", chestId: pieceId, content: "jugWith3Drinks", all: false });
      finishReach(game);
      expect(backpack(game)).toEqual({ jugWith3Drinks: 1, jugWith1Drink: 1 });
    }
  });
});

describe("saving jugs with water", () => {
  it("raises the save version", () => {
    expect(JUG_WATER_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(JUG_WATER_SAVE_VERSION).toBeGreaterThan(JUG_FIRING_SAVE_VERSION);
  });

  it("keeps each jug's water in the backpack, a pile, and a chest", () => {
    const game = gameHolding({ jug: 1, jugWith1Drink: 2, jugWith3Drinks: 1 });
    game.entities.add({ pile: { content: "jugWith2Drinks", count: 3 }, position: { x: 1, y: 0, z: 1 } });
    game.entities.add({ furniture: "chest", storage: { contents: { jugWith3Drinks: 4 } }, facing: { turns: 0 }, position: { x: 4, y: 0, z: 4 } });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(backpack(loaded.game)).toEqual({ jug: 1, jugWith1Drink: 2, jugWith3Drinks: 1 });
    expect([...loaded.game.entities.with("pile")].map(({ pile }) => pile)).toContainEqual({ content: "jugWith2Drinks", count: 3 });
    expect(storingPiecesOf(loaded.game.entities, "chest").map(({ storage }) => storage.contents)).toContainEqual({ jugWith3Drinks: 4 });
  });

  it("upgrades a save from before jugs held water unchanged", () => {
    const game = gameHolding({ jug: 2, potOfBoiledWater: 1 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as SaveFile;
    save.version = JUG_WATER_SAVE_VERSION - 1;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(backpack(loaded.game)).toEqual({ jug: 2, potOfBoiledWater: 1 });
  });
});

/** Builds a chest or shelf on open ground near the player, in the playground, and returns its entity id. */
function buildStoringPiece(game: Game, furniture: "chest" | "shelf"): number {
  const square = openSquareNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: furniture, turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  const blueprintId = blueprint === undefined ? undefined : game.entities.id(blueprint);
  if (blueprintId === undefined) throw new Error("No blueprint");
  send(game, { type: "build", blueprintId });
  stepUntil(game, () => storingPiecesOf(game.entities, furniture).length > 0);
  const piece = storingPiecesOf(game.entities, furniture)[0];
  const pieceId = piece === undefined ? undefined : game.entities.id(piece);
  if (pieceId === undefined) throw new Error("No piece");
  return pieceId;
}

/** The middle of a building-grid square a few metres west of the player, away from the river, with open ground all round it. */
function openSquareNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let distance = 3; distance < 30; distance += 1) {
    const square = { x: Math.floor(position.x - distance) + 0.5, z: Math.floor(position.z) + 0.5 };
    const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
    if (open) return square;
  }
  throw new Error("No open square");
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 100_000) throw new Error("It never happened");
    game.step();
  }
}

/** A new game whose backpack holds only `contents`. */
function gameHolding(contents: BackpackContents): Game {
  const game = createGame({ seed: 42 });
  onlyPlayer(game).backpack.contents = { ...contents };
  return game;
}

/** What the backpack holds, without the kinds it holds none of. */
function backpack(game: Game): BackpackContents {
  return Object.fromEntries(Object.entries(game.client.getView().backpack).filter(([, count]) => count > 0));
}

/** Moves the clock on. The game is paused first, so the player stays put. */
function skipMinutes(game: Game, minutes: number): void {
  send(game, { type: "setPaused", paused: true });
  send(game, { type: "skipTime", hours: minutes / 60 });
}

function resume(game: Game): void {
  game.client.send({ type: "setPaused", paused: false });
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}
