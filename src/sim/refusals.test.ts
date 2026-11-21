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
    const logId = add(game, { log: { heading: 0 } });

    expect(game.client.refusal({ type: "pickUpLog", logId })).toEqual({ kind: "shoulderFull" });
    expect(game.client.refusal({ type: "splitLog", logId })).toEqual({ kind: "shoulderFull" });
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

  it("refuses a recipe the player lacks things for, or cannot follow with a log on the shoulder", () => {
    const lacking = gameWithBackpack({ stick: 2 });
    expect(lacking.client.refusal({ type: "craft", recipe: "fishingRod" })).toEqual({
      kind: "cannotCraftYet",
      lacks: [{ kind: "tool", tool: "knife" }, { kind: "materials" }],
    });

    const carrying = gameWithBackpack({ knife: 1, fishingLine: 1, stick: 2 });
    expect(carrying.client.refusal({ type: "craft", recipe: "fishingRod" })).toBeNull();
    carrying.entities.addComponent(player(carrying), "carrying", "log");
    expect(carrying.client.refusal({ type: "craft", recipe: "fishingRod" })).toEqual({ kind: "putLogDownFirst" });
  });

  it("refuses taking from a chest what it does not hold, or what does not fit in the backpack", () => {
    const game = gameWithBackpack({ stone: 10 });
    const { x, y, z } = position(game);
    const chestId = add(game, { furniture: "chest", storage: { contents: { stone: 1, stick: 1 } }, position: { x: x + 1, y, z } });
    game.client.send({ type: "openChest", chestId });
    game.step();

    expect(game.client.refusal({ type: "takeFromChest", chestId, content: "berries", all: false })).toEqual({ kind: "nothingToTake" });
    expect(game.client.refusal({ type: "takeFromChest", chestId, content: "stone", all: true })).toEqual({ kind: "backpackFull" });
    player(game).backpack = { contents: { stone: 9 } };
    expect(game.client.refusal({ type: "takeFromChest", chestId, content: "stone", all: false })).toBeNull();
  });

  it("turns away a command the same way when the player sends it", () => {
    const game = gameWithBackpack({});

    game.client.send({ type: "chopTree", treeId: 1 });
    game.step();

    expect(player(game).chopTask).toBeUndefined();
  });

  it("refuses splitting with no log on the shoulder, or with no room for the firewood", () => {
    const game = gameWithBackpack({ axe: 1 });
    const logId = add(game, { log: { heading: 0 } });

    expect(game.client.refusal({ type: "splitLog" })).toEqual({ kind: "noLogCarried" });
    player(game).backpack = { contents: { axe: 1, stone: 10 } };
    expect(game.client.refusal({ type: "splitLog", logId })).toEqual({ kind: "backpackFull" });
    game.entities.addComponent(player(game), "carrying", "log");
    expect(game.client.refusal({ type: "splitLog" })).toEqual({ kind: "backpackFull" });
  });

  it("refuses picking up, foraging, sleeping on, or sitting on a thing that is gone", () => {
    const game = gameWithBackpack({});
    const gone = add(game, { stick: true });
    game.entities.remove(game.entities.entity(gone) ?? {});

    expect(game.client.refusal({ type: "pickUpStick", stickId: gone })).toEqual({ kind: "gone" });
    expect(game.client.refusal({ type: "pickUpBark", barkId: gone })).toEqual({ kind: "gone" });
    expect(game.client.refusal({ type: "forage", spotId: gone })).toEqual({ kind: "gone" });
    expect(game.client.refusal({ type: "sleep", bedrollId: gone })).toEqual({ kind: "gone" });
    expect(game.client.refusal({ type: "sleepInBed", bedId: gone })).toEqual({ kind: "gone" });
    expect(game.client.refusal({ type: "sitOnStool", stoolId: gone })).toEqual({ kind: "gone" });
    expect(game.client.refusal({ type: "pickUpStick", stickId: add(game, { stick: true }) })).toBeNull();
  });

  it("refuses foraging a spot that is growing back", () => {
    const game = gameWithBackpack({});
    const spotId = add(game, { forageSpot: { food: "berries" }, regrowing: { minutesLeft: 60 } });

    expect(game.client.refusal({ type: "forage", spotId })).toEqual({ kind: "nothingToTake" });
  });

  it("refuses putting in or taking from a chest that is not open", () => {
    const game = gameWithBackpack({ stick: 1 });
    const { x, y, z } = position(game);
    const chestId = add(game, { furniture: "chest", storage: { contents: {} }, facing: { turns: 0 }, position: { x: x + 1, y, z } });

    expect(game.client.refusal({ type: "putInChest", chestId, content: "stick", all: false })).toEqual({ kind: "openFirst" });
    expect(game.client.refusal({ type: "takeFromChest", chestId, content: "stick", all: false })).toEqual({ kind: "openFirst" });
    game.client.send({ type: "openChest", chestId });
    game.step();
    expect(game.client.refusal({ type: "putInChest", chestId, content: "stick", all: false })).toBeNull();
  });

  it("does nothing for a refused command and shows why: fishing without the rod", () => {
    const game = gameWithBackpack({});
    const before = { ...position(game) };

    game.client.send({ type: "fish", x: before.x + 20, z: before.z });
    game.step();

    expect(player(game).fishTask).toBeUndefined();
    expect(player(game).walkPath).toBeUndefined();
    expect(position(game)).toEqual(before);
    expect(game.client.getView().notice).toEqual({ kind: "refused", refusal: { kind: "needsTool", tool: "fishingRod" } });
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

function position(game: Game): NonNullable<Entity["position"]> {
  const at = player(game).position;
  if (at === undefined) throw new Error("No player position");
  return at;
}

/** Adds an entity well away from the player, out of reach, and returns its id. */
function add(game: Game, components: Entity): number {
  const at = player(game).position ?? { x: 0, y: 0, z: 0 };
  const id = game.entities.id(game.entities.add({ position: { x: at.x + 30, y: at.y, z: at.z }, ...components }));
  if (id === undefined) throw new Error("No id");
  return id;
}
