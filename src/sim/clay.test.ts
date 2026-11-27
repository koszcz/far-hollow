import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { type Command } from "./api-commands";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { DIG_CLAY_SECONDS, diggingClayNow } from "./clay";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { groundDistance, type GroundPoint } from "./ground-point";
import { CLAY_SAVE_VERSION, MUSHROOM_LOG_REFUSAL_RENAMED_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { GATHER_STONE_SECONDS, gatheringStoneNow } from "./stone";
import { finishReach, storingPiecesOf } from "./test-steps";
import { distanceToRiver } from "./valley";
import { isWalkable } from "./walk-map";

describe("clay in the backpack", () => {
  it("weighs 2 kg", () => {
    expect(CONTENT_WEIGHT_KG.clay).toBe(2);
  });
});

describe("digging clay", () => {
  it("takes longer than gathering one stone", () => {
    expect(DIG_CLAY_SECONDS).toBe(6);
    expect(DIG_CLAY_SECONDS).toBeGreaterThan(GATHER_STONE_SECONDS);
  });

  it("walks the player into reach of river bank ground, then takes 6 seconds of work for one clay", () => {
    const game = createGame({ seed: 42 });
    const spot = bankSpotNearPlayer(game);

    send(game, { type: "digClay", ...spot });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    expect(groundDistance(onlyPlayer(game).position, spot)).toBeLessThanOrEqual(2);
    expect(game.client.getView().action?.kind).toBe("digClay");

    runSeconds(game, 5.9);
    expect(game.client.getView().backpack.clay).toBeUndefined();
    expect(game.client.getView().action?.progress).toBeCloseTo(5.9 / 6, 1);
    runSeconds(game, 0.2);

    expect(game.client.getView().backpack.clay).toBe(1);
    expect(game.client.getView().action).toBeNull();
  });

  it("tells the drawing where the player digs and how long one clay takes", () => {
    const game = createGame({ seed: 42 });
    const spot = bankSpotNearPlayer(game);

    send(game, { type: "digClay", ...spot });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

    expect(diggingClayNow(onlyPlayer(game))).toMatchObject({ spot, secondsEach: DIG_CLAY_SECONDS });
    expect(gatheringStoneNow(onlyPlayer(game))).toBeUndefined();
  });

  it("walks the player to the water's edge for a spot on the river", () => {
    const game = createGame({ seed: 42 });

    send(game, { type: "digClay", ...riverSpotNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    runSeconds(game, 6.1);

    expect(distanceToWater(game, onlyPlayer(game).position)).toBeLessThan(3);
    expect(game.client.getView().backpack.clay).toBe(1);
  });

  it("does nothing for a spot away from the river bank", () => {
    const game = createGame({ seed: 42 });

    send(game, { type: "digClay", ...awayFromRiver(game) });
    runSeconds(game, 20);

    expect(game.client.getView().backpack.clay).toBeUndefined();
  });

  it("needs no tool", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = {};

    digOne(game);

    expect(game.client.getView().backpack).toEqual({ clay: 1 });
  });

  it("never runs out at the same spot", () => {
    const game = createGame({ seed: 42 });

    for (let i = 0; i < 5; i += 1) digOne(game);

    expect(game.client.getView().backpack.clay).toBe(5);
  });

  it("stops when the player walks away, without clay", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "digClay", ...bankSpotNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    runSeconds(game, 2);

    const { position } = onlyPlayer(game);
    send(game, { type: "walkTo", x: position.x - 5, z: position.z });
    runSeconds(game, 7);

    expect(game.client.getView().backpack.clay).toBeUndefined();
  });
});

describe("a backpack too full for one more clay", () => {
  it("refuses digging, saying the backpack is full", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { clay: BACKPACK_WEIGHT_LIMIT_KG / 2 };

    expect(game.client.refusal({ type: "digClay", ...bankSpotNearPlayer(game) })).toEqual({ kind: "backpackFull" });
  });

  it("allows digging while one more clay fits", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { clay: BACKPACK_WEIGHT_LIMIT_KG / 2 - 1 };

    expect(game.client.refusal({ type: "digClay", ...bankSpotNearPlayer(game) })).toBeNull();
  });
});

describe("dropping and storing clay", () => {
  it("drops clay in a pile, which joins clay dropped nearby and can be picked up again", () => {
    const game = createGame({ seed: 42 });
    give(game, 3);
    send(game, { type: "dropFromBackpack", content: "clay" });
    give(game, 2);
    send(game, { type: "dropFromBackpack", content: "clay" });

    const pile = nearbyOf(game.client.getView(), "pile");
    expect(pile).toMatchObject({ content: "clay", count: 5 });
    expect(game.client.getView().backpack.clay ?? 0).toBe(0);

    send(game, { type: "pickUpPile", pileId: pile?.id ?? -1 });
    stepUntil(game, () => game.client.getView().reach === null && onlyPlayer(game).walkPath === undefined);
    finishReach(game);

    expect(game.client.getView().backpack.clay).toBe(5);
    expect(nearbyOf(game.client.getView(), "pile")).toBeNull();
  });

  it("goes in a chest and on a shelf, and comes out again", () => {
    for (const furniture of ["chest", "shelf"] as const) {
      const game = createGame({ seed: 42, freeBuilding: true });
      const pieceId = buildStoringPiece(game, furniture);
      onlyPlayer(game).backpack.contents = { clay: 4 };
      send(game, { type: "openChest", chestId: pieceId });
      stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

      send(game, { type: "putInChest", chestId: pieceId, content: "clay", all: true });
      finishReach(game);
      expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ clay: 4 });
      expect(game.client.getView().backpack.clay ?? 0).toBe(0);

      send(game, { type: "takeFromChest", chestId: pieceId, content: "clay", all: false });
      finishReach(game);
      expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ clay: 3 });
      expect(game.client.getView().backpack.clay).toBe(1);
    }
  });
});

describe("saving clay", () => {
  it("raises the save version for clay, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(CLAY_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(CLAY_SAVE_VERSION).toBeGreaterThan(MUSHROOM_LOG_REFUSAL_RENAMED_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = CLAY_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps clay in the backpack, clay piles, and digging under way", () => {
    const game = createGame({ seed: 42 });
    give(game, 3);
    send(game, { type: "dropFromBackpack", content: "clay" });
    give(game, 2);
    send(game, { type: "digClay", ...bankSpotNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    runSeconds(game, 1);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().backpack.clay).toBe(2);
    expect(loaded.game.entities.with("pile").entities.map(({ pile }) => pile)).toEqual([{ content: "clay", count: 3 }]);
    expect(loaded.game.client.getView().action?.kind).toBe("digClay");
    runSeconds(loaded.game, 5.1);
    expect(loaded.game.client.getView().backpack.clay).toBe(3);
  });

  it("keeps walking to dig clay, then digs on arrival", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "digClay", ...bankSpotNearPlayer(game) });
    expect(onlyPlayer(game).walkPath).toBeDefined();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    stepUntil(loaded.game, () => (loaded.game.client.getView().backpack.clay ?? 0) > 0);
    expect(loaded.game.client.getView().backpack.clay).toBe(1);
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

/** Puts `count` more clay in the backpack. */
function give(game: Game, count: number): void {
  const { backpack } = onlyPlayer(game);
  backpack.contents = { ...backpack.contents, clay: (backpack.contents.clay ?? 0) + count };
}

/** Digs one clay at the river bank ground nearest the player, and waits until it is in the backpack. */
function digOne(game: Game): void {
  const before = game.client.getView().backpack.clay ?? 0;
  send(game, { type: "digClay", ...bankSpotNearPlayer(game) });
  stepUntil(game, () => (game.client.getView().backpack.clay ?? 0) > before);
}

/** The middle of the river, level with the player. The player starts on the west bank. */
function riverSpotNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let x = position.x; x < position.x + 100; x += 0.25) {
    const spot = { x, z: position.z };
    if (distanceToWater(game, spot) < -1) return spot;
  }
  throw new Error("No river near the player");
}

/** River bank ground 2 m from the water's edge, level with the player, on their side of the river. */
function bankSpotNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let x = position.x - 20; x < position.x + 100; x += 0.25) {
    const spot = { x, z: position.z };
    if (distanceToWater(game, spot) < 2) return { x: x - 0.25, z: spot.z };
  }
  throw new Error("No river near the player");
}

/** Ground 40 m west of the river, level with the player: well beyond the river bank. */
function awayFromRiver(game: Game): GroundPoint {
  const { z } = onlyPlayer(game).position;
  const water = riverSpotNearPlayer(game);
  return { x: water.x - 40, z };
}

/** How far a spot is from the water's edge. Negative inside the water. */
function distanceToWater(game: Game, spot: GroundPoint): number {
  return distanceToRiver(game.valley.river, spot) - game.valley.river.width / 2;
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 100_000) throw new Error("It never happened");
    game.step();
  }
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < seconds * STEPS_PER_SECOND; i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}
