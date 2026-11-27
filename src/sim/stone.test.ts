import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { type Command } from "./api-commands";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { groundDistance, type GroundPoint } from "./ground-point";
import { readSave, REGROWTH_SAVE_VERSION, SAVE_VERSION, STONE_SAVE_VERSION, writeSave } from "./save";
import { isRiverBank } from "./river-bank-work";
import { finishReach, storingPiecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";
import { distanceToRiver } from "./valley";

describe("stone in the backpack", () => {
  it("weighs 2 kg", () => {
    expect(CONTENT_WEIGHT_KG.stone).toBe(2);
  });
});

describe("where the player can gather stone", () => {
  it("is the river bank and the river, and nowhere else", () => {
    const game = createGame({ seed: 42 });

    expect(isRiverBank(game.valley, riverSpotNearPlayer(game))).toBe(true);
    expect(isRiverBank(game.valley, bankSpotNearPlayer(game))).toBe(true);
    expect(isRiverBank(game.valley, awayFromRiver(game))).toBe(false);
  });

  it("does nothing for a spot away from the river bank", () => {
    const game = createGame({ seed: 42 });

    send(game, { type: "gatherStone", ...awayFromRiver(game) });
    runSeconds(game, 20);

    expect(game.client.getView().backpack.stone).toBeUndefined();
  });
});

describe("gathering stone", () => {
  it("walks the player into reach of river bank ground, then takes 4 seconds of work for one stone", () => {
    const game = createGame({ seed: 42 });
    const spot = bankSpotNearPlayer(game);

    send(game, { type: "gatherStone", ...spot });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    expect(groundDistance(onlyPlayer(game).position, spot)).toBeLessThanOrEqual(2);
    expect(game.client.getView().action?.kind).toBe("gatherStone");

    runSeconds(game, 3.9);
    expect(game.client.getView().backpack.stone).toBeUndefined();
    expect(game.client.getView().action?.progress).toBeCloseTo(3.9 / 4, 1);
    runSeconds(game, 0.2);

    expect(game.client.getView().backpack.stone).toBe(1);
    expect(game.client.getView().action).toBeNull();
  });

  it("walks the player to the water's edge for a spot on the river", () => {
    const game = createGame({ seed: 42 });

    send(game, { type: "gatherStone", ...riverSpotNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    runSeconds(game, 4.1);

    expect(distanceToWater(game, onlyPlayer(game).position)).toBeLessThan(3);
    expect(game.client.getView().backpack.stone).toBe(1);
  });

  it("needs no tool", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = {};

    gatherOne(game);

    expect(game.client.getView().backpack).toEqual({ stone: 1 });
  });

  it("never runs out at the same spot", () => {
    const game = createGame({ seed: 42 });

    for (let i = 0; i < 5; i += 1) gatherOne(game);

    expect(game.client.getView().backpack.stone).toBe(5);
  });

  it("drains fatigue faster, like other timed work", () => {
    const idle = createGame({ seed: 42 });
    const working = createGame({ seed: 42 });
    send(working, { type: "gatherStone", ...bankSpotNearPlayer(working) });
    stepUntil(working, () => onlyPlayer(working).walkPath === undefined);
    for (let i = 0; i < working.client.getView().stepCount; i += 1) idle.step();
    const idleBefore = idle.client.getView().needs.fatigue;
    const workingBefore = working.client.getView().needs.fatigue;

    runSeconds(working, 3.5);
    runSeconds(idle, 3.5);

    const idleLoss = idleBefore - idle.client.getView().needs.fatigue;
    const workingLoss = workingBefore - working.client.getView().needs.fatigue;
    expect(idleLoss).toBeGreaterThan(0);
    expect(workingLoss).toBeGreaterThan(idleLoss * 1.5);
  });

  it("stops when the player walks away, without a stone", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "gatherStone", ...bankSpotNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    runSeconds(game, 2);

    const { position } = onlyPlayer(game);
    send(game, { type: "walkTo", x: position.x - 5, z: position.z });
    runSeconds(game, 5);

    expect(game.client.getView().backpack.stone).toBeUndefined();
  });
});

describe("a backpack too full for one more stone", () => {
  it("refuses gathering, saying the backpack is full", () => {
    const game = createGame({ seed: 42 });
    fillBackpack(game);

    expect(game.client.refusal({ type: "gatherStone", ...bankSpotNearPlayer(game) })).toEqual({ kind: "backpackFull" });
  });

  it("allows gathering while one more stone fits", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { stone: (BACKPACK_WEIGHT_LIMIT_KG - CONTENT_WEIGHT_KG.stone) / CONTENT_WEIGHT_KG.stone };

    expect(game.client.refusal({ type: "gatherStone", ...bankSpotNearPlayer(game) })).toBeNull();
  });
});

describe("dropping and storing stone", () => {
  it("drops stone in a pile, which joins stone dropped nearby and can be picked up again", () => {
    const game = createGame({ seed: 42 });
    give(game, 3);
    send(game, { type: "dropFromBackpack", content: "stone" });
    give(game, 2);
    send(game, { type: "dropFromBackpack", content: "stone" });

    const pile = nearbyOf(game.client.getView(), "pile");
    expect(pile).toMatchObject({ content: "stone", count: 5 });
    expect(game.client.getView().backpack.stone ?? 0).toBe(0);

    send(game, { type: "pickUpPile", pileId: pile?.id ?? -1 });
    stepUntil(game, () => game.client.getView().reach === null && onlyPlayer(game).walkPath === undefined);
    finishReach(game);

    expect(game.client.getView().backpack.stone).toBe(5);
    expect(nearbyOf(game.client.getView(), "pile")).toBeNull();
  });

  it("goes in a chest and on a shelf, and comes out again", () => {
    for (const furniture of ["chest", "shelf"] as const) {
      const game = createGame({ seed: 42, freeBuilding: true });
      const pieceId = buildStoringPiece(game, furniture);
      onlyPlayer(game).backpack.contents = { stone: 4 };
      send(game, { type: "openChest", chestId: pieceId });
      stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

      send(game, { type: "putInChest", chestId: pieceId, content: "stone", all: true });
      finishReach(game);
      expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ stone: 4 });
      expect(game.client.getView().backpack.stone ?? 0).toBe(0);

      send(game, { type: "takeFromChest", chestId: pieceId, content: "stone", all: false });
      finishReach(game);
      expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ stone: 3 });
      expect(game.client.getView().backpack.stone).toBe(1);
    }
  });
});

describe("saving stone", () => {
  it("raises the save version for stone, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(STONE_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(STONE_SAVE_VERSION).toBeGreaterThan(REGROWTH_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = STONE_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps stone in the backpack, stone piles, and stone gathering under way", () => {
    const game = createGame({ seed: 42 });
    give(game, 3);
    send(game, { type: "dropFromBackpack", content: "stone" });
    give(game, 2);
    send(game, { type: "gatherStone", ...bankSpotNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    runSeconds(game, 1);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().backpack.stone).toBe(2);
    expect(loaded.game.entities.with("pile").entities.map(({ pile }) => pile)).toEqual([{ content: "stone", count: 3 }]);
    expect(loaded.game.client.getView().action?.kind).toBe("gatherStone");
    runSeconds(loaded.game, 3.1);
    expect(loaded.game.client.getView().backpack.stone).toBe(3);
  });
});

describe("stone in the playground", () => {
  it("is in the backpack at the start, so the player can try out building with it", () => {
    expect(createGame({ seed: 42, freeBuilding: true }).client.getView().backpack.stone).toBeGreaterThan(0);
    expect(createGame({ seed: 42 }).client.getView().backpack.stone).toBeUndefined();
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

/** Puts `count` more stone in the backpack. */
function give(game: Game, count: number): void {
  const { backpack } = onlyPlayer(game);
  backpack.contents = { ...backpack.contents, stone: (backpack.contents.stone ?? 0) + count };
}

/** Gathers one stone at the river bank ground nearest the player, and waits until it is in the backpack. */
function gatherOne(game: Game): void {
  const before = game.client.getView().backpack.stone ?? 0;
  send(game, { type: "gatherStone", ...bankSpotNearPlayer(game) });
  stepUntil(game, () => (game.client.getView().backpack.stone ?? 0) > before);
}

/** Fills the backpack to its weight limit with stone, so not one more fits. */
function fillBackpack(game: Game): void {
  onlyPlayer(game).backpack.contents = { stone: BACKPACK_WEIGHT_LIMIT_KG / CONTENT_WEIGHT_KG.stone };
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
