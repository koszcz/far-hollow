// Why the game turns a command away, as the UI asks before the player sends it.
// Each module that carries out a command also gives its refusal, so these tests go through the game's client, as the UI does.
import { describe, expect, it } from "bun:test";
import type { BackpackContent } from "./api";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import { WOODPILE_CAPACITY } from "./woodpiles";

describe("refusals", () => {
  it("names the tool a command needs", () => {
    const game = gameWithBackpack({});

    expect(game.client.refusal({ type: "chopTree", treeId: 1 })).toEqual({ kind: "needsTool", tool: "axe" });
    expect(game.client.refusal({ type: "debarkLog", logId: 1 })).toEqual({ kind: "needsTool", tool: "drawknife" });
    expect(game.client.refusal({ type: "fish", x: 0, z: 0 })).toEqual({ kind: "needsTool", tool: "fishingRod" });
    expect(game.client.refusal({ type: "splitLog" })).toEqual({ kind: "needsTool", tool: "axe" });
  });

  it("refuses shouldering a second log, and fishing with a log on the shoulder", () => {
    const game = gameWithBackpack({ axe: 1, fishingRod: 1 });
    game.entities.addComponent(player(game), "carrying", "log");

    expect(game.client.refusal({ type: "pickUpLog", logId: 1 })).toEqual({ kind: "shoulderFull" });
    expect(game.client.refusal({ type: "splitLog", logId: 1 })).toEqual({ kind: "shoulderFull" });
    expect(game.client.refusal({ type: "splitLog" })).toBeNull();
    expect(game.client.refusal({ type: "fish", x: 0, z: 0 })).toEqual({ kind: "putLogDownFirst" });
  });

  it("refuses stacking on a full woodpile, and taking what it does not hold", () => {
    const game = gameWithBackpack({ firewood: 2 });
    const woodpileId = add(game, { woodpile: { log: WOODPILE_CAPACITY, debarkedLog: 0, firewood: 0 } });

    expect(game.client.refusal({ type: "stackOnWoodpile", woodpileId, wood: "firewood", all: false })).toEqual({ kind: "woodpileFull" });
    expect(game.client.refusal({ type: "stackOnWoodpile", woodpileId, wood: "log", all: false })).toEqual({ kind: "noLogCarried" });
    expect(game.client.refusal({ type: "takeFromWoodpile", woodpileId, wood: "firewood" })).toEqual({ kind: "nothingToTake" });
    expect(game.client.refusal({ type: "takeFromWoodpile", woodpileId, wood: "log" })).toBeNull();
    expect(game.client.refusal({ type: "takeDown", pieceId: woodpileId })).toEqual({ kind: "emptyFirst" });
  });

  it("refuses loading a full sled, and tipping out an empty one", () => {
    const game = gameWithBackpack({ plank: 1 });
    game.entities.addComponent(player(game), "carrying", "log");
    const full = add(game, { sled: { log: 6, debarkedLog: 0, plank: 0 }, facing: { turns: 0 } });
    const empty = add(game, { sled: { log: 0, debarkedLog: 0, plank: 0 }, facing: { turns: 0 } });

    expect(game.client.refusal({ type: "loadSled", sledId: full })).toEqual({ kind: "sledFull" });
    expect(game.client.refusal({ type: "loadPlanksOnSled", sledId: full })).toEqual({ kind: "sledFull" });
    expect(game.client.refusal({ type: "takeFromSled", sledId: full, log: "log" })).toEqual({ kind: "shoulderFull" });
    expect(game.client.refusal({ type: "tipOutSled", sledId: empty })).toEqual({ kind: "nothingToTake" });
    expect(game.client.refusal({ type: "loadSled", sledId: empty })).toBeNull();
  });

  it("refuses work that needs free hands while the player drags a sled, but not eating or taking firewood", () => {
    const game = gameWithBackpack({ axe: 1, berries: 1 });
    const sledId = add(game, { sled: { log: 0, debarkedLog: 0, plank: 0 }, facing: { turns: 0 } });
    const woodpileId = add(game, { woodpile: { log: 1, debarkedLog: 0, firewood: 1 } });
    game.entities.addComponent(player(game), "dragging", { sledId });

    expect(game.client.refusal({ type: "chopTree", treeId: 1 })).toEqual({ kind: "letGoFirst" });
    expect(game.client.refusal({ type: "takeFromWoodpile", woodpileId, wood: "log" })).toEqual({ kind: "letGoFirst" });
    expect(game.client.refusal({ type: "takeFromWoodpile", woodpileId, wood: "firewood" })).toBeNull();
    expect(game.client.refusal({ type: "eat", food: "berries" })).toBeNull();
  });

  it("turns away a command the same way when the player sends it", () => {
    const game = gameWithBackpack({});

    game.client.send({ type: "chopTree", treeId: 1 });
    game.step();

    expect(player(game).chopTask).toBeUndefined();
  });
});

/** A new game whose backpack holds only these. */
function gameWithBackpack(contents: Partial<Record<BackpackContent, number>>): Game {
  const game = createGame({ seed: 42 });
  player(game).backpack = { contents: { ...contents } };
  return game;
}

function player(game: Game): Entity {
  const found = game.entities.with("player").first;
  if (found === undefined) throw new Error("No player");
  return found;
}

/** Adds an entity well away from the player, out of reach, and returns its id. */
function add(game: Game, components: Entity): number {
  const at = player(game).position ?? { x: 0, y: 0, z: 0 };
  const id = game.entities.id(game.entities.add({ position: { x: at.x + 30, y: at.y, z: at.z }, ...components }));
  if (id === undefined) throw new Error("No id");
  return id;
}
