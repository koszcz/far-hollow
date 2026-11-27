import { describe, expect, it } from "bun:test";
import { worldWith } from "./test-world";
import { actionsFor, mainAction, type ActionTarget } from "./thing-actions";
import { find, summary, scene, river } from "./thing-actions-test-support";

describe("carried items' actions", () => {
  it("eats food from the hotbar, then drops it, and puts it in an open chest first", () => {
    expect(summary(actionsFor({ kind: "backpackContent", content: "berries" }, worldWith({ backpack: { berries: 2 } }).reader))).toEqual(["use main", "drop"]);
    expect(summary(actionsFor({ kind: "backpackContent", content: "stick" }, worldWith({ backpack: { stick: 2 } }).reader))).toEqual(["drop"]);

    const withChest = worldWith({ backpack: { berries: 2 } });
    const chestId = withChest.openStorage("chest");
    const actions = actionsFor({ kind: "backpackContent", content: "berries" }, withChest.reader);
    expect(summary(actions)).toEqual(["putInChest main", "putInChest:all", "use", "drop"]);
    expect(find(actions, "putInChest:all")?.command).toEqual({ type: "putInChest", chestId, content: "berries", all: true });
    expect(find(actions, "putInChest")?.label).toBe("Put one in the chest");
  });

  it("offers no way to fill an unfired jug, in the hotbar or at the river", () => {
    const world = worldWith({ backpack: { unfiredJug: 2 } });

    expect(summary(actionsFor({ kind: "backpackContent", content: "unfiredJug" }, world.reader))).toEqual(["drop"]);
    expect(summary(actionsFor(river(), world.reader))).not.toContain("fillPot");
  });

  it("pours clean water into a jug that is not full, greyed with the reason without a pot of clean water", () => {
    const jug: ActionTarget = { kind: "backpackContent", content: "jug" };
    const world = worldWith({ backpack: { jug: 1, potOfBoiledWater: 1 } });
    const actions = actionsFor(jug, world.reader);
    expect(summary(actions)).toEqual(["pourIntoJug main", "drop"]);
    expect(find(actions, "pourIntoJug")?.label).toBe("Pour in clean water");
    expect(find(actions, "pourIntoJug")?.command).toEqual({ type: "pourIntoJug" });
    // The icon shows the jug as pouring leaves it, with one more drink.
    expect(find(actions, "pourIntoJug")?.icon).toEqual({ content: "jugWith1Drink" });

    // Greyed, pouring is not the main action: the empty jug has none, as before it could be filled.
    expect(summary(actionsFor(jug, worldWith({ backpack: { jug: 1, potOfRiverWater: 1 } }).reader))).toEqual([
      "pourIntoJug off: no pot of clean water",
      "drop",
    ]);
  });

  it("drinks from a jug with water as its main action, and offers no pour on a full jug", () => {
    const world = worldWith({ backpack: { jugWith1Drink: 1, jugWith3Drinks: 1, potOfBoiledWater: 1 } });

    const partly = actionsFor({ kind: "backpackContent", content: "jugWith1Drink" }, world.reader);
    expect(summary(partly)).toEqual(["drinkFromJug main", "pourIntoJug", "drop"]);
    expect(find(partly, "drinkFromJug")?.label).toBe("Drink");
    expect(find(partly, "drinkFromJug")?.command).toEqual({ type: "drinkFromJug" });
    expect(find(partly, "pourIntoJug")?.icon).toEqual({ content: "jugWith2Drinks" });

    expect(summary(actionsFor({ kind: "backpackContent", content: "jugWith3Drinks" }, world.reader))).toEqual(["drinkFromJug main", "drop"]);
  });

  it("offers no way to fill a jug at the river", () => {
    const world = worldWith({ backpack: { jug: 2 } });

    expect(summary(actionsFor(river(), world.reader)).join()).not.toMatch(/jug|fillPot/i);
  });

  it("lights a torch from the hotbar, greyed with the reason without the steel and flint or with a torch already lit", () => {
    const torch: ActionTarget = { kind: "backpackContent", content: "torch" };
    const world = worldWith({ backpack: { torch: 2, steelAndFlint: 1 } });
    const actions = actionsFor(torch, world.reader);
    expect(summary(actions)).toEqual(["use main", "drop"]);
    expect(find(actions, "use")?.label).toBe("Light");
    expect(find(actions, "use")?.command).toEqual({ type: "lightTorch" });

    expect(summary(actionsFor(torch, worldWith({ backpack: { torch: 2 } }).reader))).toEqual(["use main off: needs the steel and flint", "drop"]);

    world.game.client.send({ type: "lightTorch" });
    world.game.step();
    expect(summary(actionsFor(torch, world.reader))).toEqual(["use main off: you already hold a lit torch", "drop"]);
  });

  it("puts out the lit torch in the player's hand", () => {
    const world = worldWith({ backpack: { torch: 1, steelAndFlint: 1 } });
    world.game.client.send({ type: "lightTorch" });
    world.game.step();

    const actions = actionsFor({ kind: "litTorch" }, world.reader);

    expect(find(actions, "putOut")?.label).toBe("Put out");
    expect(find(actions, "putOut")?.command).toEqual({ type: "putOutTorch" });
  });

  it("plants the lit torch in the player's hand, as its main action, before putting it out", () => {
    const world = worldWith({ backpack: { torch: 1, steelAndFlint: 1 } });
    world.game.client.send({ type: "lightTorch" });
    world.game.step();

    const actions = actionsFor({ kind: "litTorch" }, world.reader);

    expect(summary(actions)).toEqual(["plant main", "putOut"]);
    expect(mainAction(actions)?.label).toBe("Plant");
    expect(mainAction(actions)?.command).toEqual({ type: "plantTorch" });
  });

  it("greys out planting within 1 m of a planted torch, with the reason", () => {
    const world = worldWith({ backpack: { torch: 1, steelAndFlint: 1 } });
    world.game.client.send({ type: "lightTorch" });
    world.game.step();
    const at = world.game.client.getView().playerPosition;
    world.game.entities.add({ plantedTorch: { minutesLeft: 60 }, position: { ...at, x: at.x + 0.5 } });
    world.game.step();

    expect(summary(actionsFor({ kind: "litTorch" }, world.reader))).toEqual(["plant main off: another torch stands too close", "putOut"]);
  });
});

describe("a planted torch's actions", () => {
  it("picks it up, as the only and main action", () => {
    const world = worldWith({});
    const torch = world.add({ plantedTorch: { minutesLeft: 60 } });

    const actions = actionsFor(scene("plantedTorch", torch), world.reader);

    expect(summary(actions)).toEqual(["pickUp main"]);
    expect(mainAction(actions)?.label).toBe("Pick up");
    expect(mainAction(actions)?.command).toEqual({ type: "pickUpTorch", torchId: torch });
  });

  it("greys out picking it up while the player holds a lit torch, with the reason", () => {
    const world = worldWith({ backpack: { torch: 1, steelAndFlint: 1 } });
    const torch = world.add({ plantedTorch: { minutesLeft: 60 } });
    world.game.client.send({ type: "lightTorch" });
    world.game.step();

    expect(summary(actionsFor(scene("plantedTorch", torch), world.reader))).toEqual(["pickUp main off: you already hold a lit torch"]);
  });

  it("puts things on an open shelf first, named as a shelf", () => {
    const withShelf = worldWith({ backpack: { stick: 2 } });
    const shelfId = withShelf.openStorage("shelf");
    const actions = actionsFor({ kind: "backpackContent", content: "stick" }, withShelf.reader);

    expect(summary(actions)).toEqual(["putInChest main", "putInChest:all", "drop"]);
    expect(find(actions, "putInChest")?.label).toBe("Put one on the shelf");
    expect(find(actions, "putInChest:all")?.label).toBe("Put all on the shelf");
    expect(find(actions, "putInChest:all")?.command).toEqual({ type: "putInChest", chestId: shelfId, content: "stick", all: true });
  });

  it("drops the log on the shoulder, or splits it with the axe", () => {
    expect(summary(actionsFor({ kind: "shoulder", log: "log" }, worldWith({ carrying: "log" }).reader))).toEqual(["drop main", "split off: needs the axe"]);
    expect(summary(actionsFor({ kind: "shoulder", log: "debarkedLog" }, worldWith({ carrying: "debarkedLog" }).reader))).toEqual(["drop main"]);
  });
});
