import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { BEDS_SAVE_VERSION, SHELVES_SAVE_VERSION } from "./save-versions";
import { BED_BUILD_SECONDS, BED_PLANK_COST } from "./furniture/bed";
import { isWalkable } from "./walk-map";
import { piecesOf } from "./test-steps";
import {
  bedBlueprintNearPlayer,
  blueprintOf,
  buildFully,
  idOf,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  runSeconds,
  send,
  stepUntil,
} from "./bed-test-helpers";

describe("saving beds", () => {
  it("raises the save version for beds, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(BEDS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(BEDS_SAVE_VERSION).toBeGreaterThan(SHELVES_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = BEDS_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps beds and bed blueprints, with which way they face and the planks a blueprint has had", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 1));
    buildFully(game, blueprintOf(game, "bed"));
    send(game, place("bed", square.x, square.z + 2, 2));
    blueprintOf(game, "bed").blueprint = { structure: "bed", progress: 0.25, materialsSpent: 2, delivered: { plank: 3 } };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const beds = piecesOf(loaded.game.entities, "bed");
    expect(beds.map(({ position, facing }) => ({ x: position.x, z: position.z, facing }))).toEqual([{ x: square.x, z: square.z, facing: { turns: 1 } }]);
    expect(isWalkable(loaded.game.walkMap, { x: square.x, z: square.z })).toBe(false);
    const blueprint = blueprintOf(loaded.game, "bed");
    expect(blueprint.blueprint).toEqual({ structure: "bed", progress: 0.25, materialsSpent: 2, delivered: { plank: 3 } });
    expect(blueprint.facing).toEqual({ turns: 2 });
  });
});

describe("a bed on a foundation", () => {
  it("holds the foundation up, so the foundation cannot be taken down under it", () => {
    // In the playground, so the foundations need no debarked logs.
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    const foundation = blueprintOf(game, "foundation");
    buildFully(game, foundation);
    send(game, place("foundation", square.x, square.z + 1, 0));
    buildFully(game, blueprintOf(game, "foundation"));
    // Across both decks, so it stands on both.
    send(game, place("bed", square.x, square.z + 0.5, 0));
    buildFully(game, blueprintOf(game, "bed"));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
  });
});

describe("taking down a bed", () => {
  it("gives back every plank of a finished bed, in the backpack or in a pile beside it, and lets the player walk there again", () => {
    const game = createGame({ seed: 42 });
    const blueprint = bedBlueprintNearPlayer(game);
    buildFully(game, blueprint);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => piecesOf(game.entities, "bed").length === 0);

    // The backpack holds the tools too, so the planks that do not fit drop in a pile.
    const piled = game.entities.with("pile").entities.reduce((sum, { pile }) => sum + (pile.content === "plank" ? pile.count : 0), 0);
    expect((backpack.contents.plank ?? 0) + piled).toBe(BED_PLANK_COST);
    expect(isWalkable(game.walkMap, blueprint.position)).toBe(true);
  });

  it("gives back the planks a bed blueprint has had so far", () => {
    const game = createGame({ seed: 42 });
    const blueprint = bedBlueprintNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 3;
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, BED_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("blueprint").size === 0);

    expect(backpack.contents.plank).toBe(3);
  });
});
