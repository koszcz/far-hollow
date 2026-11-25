import { describe, expect, it } from "bun:test";
import { queued, type ActionCommand, type GameView } from "../sim/api";
import type { Entity } from "../sim/entities";
import { createGame, type Game } from "../sim/game";
import { queuedAction, queuedActions, type QueuedAction } from "./queued-actions";

// Each test sets up a real game, so what a thing is comes from the game itself.

describe("the icon and name of a queued action", () => {
  it("shows a tree for chopping, the river for fishing and drinking, and the ground for walking", () => {
    const game = createGame({ seed: 42 });
    const tree = idOf(game, game.entities.with("tree").first);

    expect(shown(game, { type: "chopTree", treeId: tree })).toEqual({ icon: { thing: "tree" }, name: "Chop" });
    expect(shown(game, { type: "fish", x: 0, z: 0 })).toEqual({ icon: { thing: "river" }, name: "Fish" });
    expect(shown(game, { type: "drinkFromRiver", x: 0, z: 0 })).toEqual({ icon: { thing: "river" }, name: "Drink" });
    expect(shown(game, { type: "fillPot" })).toEqual({ icon: { thing: "river" }, name: "Fill it at the river" });
    expect(shown(game, { type: "walkTo", x: 0, z: 0 })).toEqual({ icon: { thing: "ground" }, name: "Walk here" });
  });

  it("tells a log with its bark on from a debarked log", () => {
    const game = createGame({ seed: 42 });
    const log = add(game, { log: { heading: 0 } });
    const debarked = add(game, { debarkedLog: { heading: 0 } });

    expect(shown(game, { type: "pickUpLog", logId: log })).toEqual({ icon: { log: "log" }, name: "Pick up" });
    expect(shown(game, { type: "pickUpLog", logId: debarked })).toEqual({ icon: { log: "debarkedLog" }, name: "Pick up" });
    expect(shown(game, { type: "debarkLog", logId: log })).toEqual({ icon: { log: "log" }, name: "Debark" });
  });

  it("shows the backpack content an action gathers, eats, or makes", () => {
    const game = createGame({ seed: 42 });
    const mushrooms = add(game, { forageSpot: { food: "mushroom" } });
    const pile = add(game, { pile: { content: "firewood", count: 3 } });

    expect(shown(game, { type: "forage", spotId: mushrooms })).toEqual({ icon: { content: "mushroom" }, name: "Forage" });
    expect(shown(game, { type: "pickUpPile", pileId: pile })).toEqual({ icon: { content: "firewood" }, name: "Pick up" });
    expect(shown(game, { type: "pickUpStick", stickId: 1 })).toEqual({ icon: { content: "stick" }, name: "Pick up" });
    expect(shown(game, { type: "eat", food: "berries" })).toEqual({ icon: { content: "berries" }, name: "Eat" });
    expect(shown(game, { type: "craft", recipe: "planks" })).toEqual({ icon: { content: "plank" }, name: "Cut planks" });
    expect(shown(game, { type: "sleep", bedrollId: 1 })).toEqual({ icon: { content: "bedroll" }, name: "Sleep" });
  });

  it("shows the jug that pouring fills, with its new drink, and the jug that drinking empties", () => {
    const game = createGame({ seed: 42 });
    const holding = (backpack: GameView["backpack"]) => (command: ActionCommand) => queuedAction(command, { ...game.client.getView(), backpack }, game.client);
    const withJugs = holding({ jug: 1, jugWith1Drink: 1, jugWith3Drinks: 1, potOfBoiledWater: 1 });

    expect(withJugs({ type: "pourIntoJug" })).toEqual({ icon: { content: "jugWith2Drinks" }, name: "Pour in clean water" });
    expect(withJugs({ type: "drinkFromJug" })).toEqual({ icon: { content: "jugWith1Drink" }, name: "Drink" });

    const withoutJugs = holding({});
    expect(withoutJugs({ type: "pourIntoJug" }).icon).toEqual({ content: "jug" });
    expect(withoutJugs({ type: "drinkFromJug" }).icon).toEqual({ content: "jug" });
  });

  it("shows the structure an action works on, blueprint or finished", () => {
    const game = createGame({ seed: 42 });
    const campfire = add(game, { campfire: { lit: false, fuelMinutes: 0 } });
    const blueprint = add(game, { blueprint: { structure: "leanTo", progress: 0, materialsSpent: 0, delivered: {} } });
    const shelf = add(game, { furniture: "shelf", storage: { contents: {} } });

    expect(shown(game, { type: "addFuel", campfireId: campfire, fuel: "firewood" })).toEqual({ icon: { structure: "campfire" }, name: "Add firewood" });
    expect(shown(game, { type: "takeDown", pieceId: campfire })).toEqual({ icon: { structure: "campfire" }, name: "Take down" });
    expect(shown(game, { type: "build", blueprintId: blueprint })).toEqual({ icon: { structure: "leanTo" }, name: "Build" });
    expect(shown(game, { type: "putInChest", chestId: shelf, content: "stick", all: true })).toEqual({
      icon: { structure: "shelf" },
      name: "Put all on the shelf",
    });
    expect(shown(game, { type: "sitOnStool", stoolId: 1 })).toEqual({ icon: { structure: "stool" }, name: "Sit" });
    expect(shown(game, { type: "tipOutSled", sledId: 1 })).toEqual({ icon: { structure: "sled" }, name: "Tip out everything" });
    expect(shown(game, { type: "fillSled", sledId: 1 })).toEqual({ icon: { structure: "sled" }, name: "Fill with nearby logs" });
  });

  it("falls back to a plain icon when the thing is gone", () => {
    const game = createGame({ seed: 42 });

    expect(shown(game, { type: "takeDown", pieceId: 999_999 })).toEqual({ icon: { hud: "backpack" }, name: "Take down" });
    expect(shown(game, { type: "pickUpPile", pileId: 999_999 })).toEqual({ icon: { hud: "backpack" }, name: "Pick up" });
    expect(shown(game, { type: "buildAddOn", hostId: 999_999 })).toEqual({ icon: { hud: "place" }, name: "Build" });
  });
});

describe("the queue as the row shows it", () => {
  it("lists every queued action in order, the one under way first", () => {
    const game = createGame({ seed: 42 });
    const tree = idOf(game, game.entities.with("tree").first);
    game.client.send(queued({ type: "walkTo", x: 0, z: 0 }));
    game.client.send(queued({ type: "chopTree", treeId: tree }));
    game.step();

    expect(queuedActions(game.client.getView(), game.client).map(({ name }) => name)).toEqual(["Walk here", "Chop"]);
  });

  it("is empty with an empty queue", () => {
    const game = createGame({ seed: 42 });

    expect(queuedActions(game.client.getView(), game.client)).toEqual([]);
  });
});

function shown(game: Game, command: ActionCommand): QueuedAction {
  return queuedAction(command, game.client.getView(), game.client);
}

/** Adds an entity well away from the player and returns its id. */
function add(game: Game, components: Entity): number {
  return idOf(game, game.entities.add({ position: { x: 200, y: 0, z: 200 }, ...components }));
}

function idOf(game: Game, entity: Entity | undefined): number {
  const id = entity === undefined ? undefined : game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
