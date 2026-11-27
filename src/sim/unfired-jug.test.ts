import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { type Command } from "./api-commands";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { CLAY_SAVE_VERSION, UNFIRED_JUGS_SAVE_VERSION } from "./save-versions";
import { finishReach, storingPiecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("the unfired jug in the craft menu", () => {
  it("is a hand recipe that uses 2 clay and needs no tool", () => {
    const jug = createGame({ seed: 42 })
      .client.getView()
      .craftMenu.find(({ kind }) => kind === "unfiredJug");

    expect(jug).toMatchObject({ materials: [{ material: "clay", count: 2 }], result: { content: "unfiredJug", count: 1 } });
    expect(jug?.tool).toBeUndefined();
    expect(jug?.station).toBeUndefined();
  });
});

describe("shaping an unfired jug", () => {
  it("turns 2 clay into one unfired jug, which weighs 1 kg", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { clay: 3 };
    game.step();

    send(game, { type: "craft", recipe: "unfiredJug" });
    expect(game.client.getView().action?.kind).toBe("craft");
    stepUntil(game, () => game.client.getView().action === null);

    expect(game.client.getView().backpack).toEqual({ clay: 1, unfiredJug: 1 });
    expect(CONTENT_WEIGHT_KG.unfiredJug).toBe(1);
    expect(game.client.getView().backpackWeight).toBeCloseTo(3, 5);
  });

  it("is refused with only 1 clay", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { clay: 1 };

    expect(game.client.refusal({ type: "craft", recipe: "unfiredJug" })).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "materials" }] });
  });

  it("works with a full backpack, because the jug weighs less than the clay it uses", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { clay: BACKPACK_WEIGHT_LIMIT_KG / 2 };

    expect(game.client.refusal({ type: "craft", recipe: "unfiredJug" })).toBeNull();
  });
});

describe("dropping and storing unfired jugs", () => {
  it("drops unfired jugs in a pile, which joins jugs dropped nearby and can be picked up again", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { unfiredJug: 2 };
    send(game, { type: "dropFromBackpack", content: "unfiredJug" });
    onlyPlayer(game).backpack.contents = { unfiredJug: 1 };
    send(game, { type: "dropFromBackpack", content: "unfiredJug" });

    const pile = nearbyOf(game.client.getView(), "pile");
    expect(pile).toMatchObject({ content: "unfiredJug", count: 3 });

    send(game, { type: "pickUpPile", pileId: pile?.id ?? -1 });
    stepUntil(game, () => game.client.getView().reach === null && onlyPlayer(game).walkPath === undefined);
    finishReach(game);

    expect(game.client.getView().backpack.unfiredJug).toBe(3);
    expect(nearbyOf(game.client.getView(), "pile")).toBeNull();
  });

  // Clay ticket 03 added the empty jug, which a chest and a shelf take the same way.
  it("goes in a chest and on a shelf, and comes out again, unfired or fired", () => {
    for (const content of ["unfiredJug", "jug"] as const) {
      for (const furniture of ["chest", "shelf"] as const) {
        const game = createGame({ seed: 42, freeBuilding: true });
        const pieceId = buildStoringPiece(game, furniture);
        onlyPlayer(game).backpack.contents = { [content]: 2 };
        send(game, { type: "openChest", chestId: pieceId });
        stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

        send(game, { type: "putInChest", chestId: pieceId, content, all: true });
        finishReach(game);
        expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ [content]: 2 });

        send(game, { type: "takeFromChest", chestId: pieceId, content, all: false });
        finishReach(game);
        expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ [content]: 1 });
        expect(game.client.getView().backpack[content]).toBe(1);
      }
    }
  });
});

describe("saving unfired jugs", () => {
  it("raises the save version for unfired jugs, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(UNFIRED_JUGS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(UNFIRED_JUGS_SAVE_VERSION).toBeGreaterThan(CLAY_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = UNFIRED_JUGS_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps unfired jugs in the backpack and in piles", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { unfiredJug: 2 };
    send(game, { type: "dropFromBackpack", content: "unfiredJug" });
    onlyPlayer(game).backpack.contents = { unfiredJug: 1, clay: 2 };
    game.step();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().backpack).toEqual({ unfiredJug: 1, clay: 2 });
    expect(loaded.game.entities.with("pile").entities.map(({ pile }) => pile)).toEqual([{ content: "unfiredJug", count: 2 }]);
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
