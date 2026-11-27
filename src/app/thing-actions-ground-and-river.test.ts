import { describe, expect, it } from "bun:test";
import { worldWith } from "./test-world";
import { actionsFor } from "./thing-actions";
import { find, summary, scene, ground, riverBank, river } from "./thing-actions-test-support";

describe("ground and river actions", () => {
  it("walks over the ground, with nothing else", () => {
    expect(summary(actionsFor(ground(), worldWith({}).reader))).toEqual(["walk main"]);
  });

  it("walks over the ground, or drops the carried log there", () => {
    const actions = actionsFor(ground(), worldWith({ carrying: "debarkedLog" }).reader);
    expect(summary(actions)).toEqual(["walk main", "dropHere"]);
    expect(actions[1]?.command).toEqual({ type: "dropLogAt", x: 1, z: 2 });
  });

  it("gathers stone on river bank ground, with walking there as the main action", () => {
    const actions = actionsFor(riverBank(), worldWith({}).reader);

    expect(summary(actions)).toEqual(["walk main", "gatherStone", "digClay"]);
    expect(find(actions, "gatherStone")).toMatchObject({ label: "Gather stone", command: { type: "gatherStone", x: 1, z: 2 } });
  });

  it("digs clay on river bank ground and in the river, just below gathering stone", () => {
    const onBank = actionsFor(riverBank(), worldWith({}).reader);
    const inRiver = actionsFor(river(), worldWith({}).reader);

    expect(find(onBank, "digClay")).toMatchObject({ label: "Dig clay", enabled: true, icon: { content: "clay" }, command: { type: "digClay", x: 1, z: 2 } });
    expect(find(inRiver, "digClay")).toMatchObject({ label: "Dig clay", enabled: true, command: { type: "digClay", x: 1, z: 2 } });
    expect(summary(inRiver).slice(-2)).toEqual(["gatherStone", "digClay"]);
  });

  it("offers no clay on ground away from the river bank", () => {
    expect(summary(actionsFor(ground(), worldWith({}).reader))).not.toContain("digClay");
  });

  it("greys out digging clay when one more clay does not fit in the backpack", () => {
    const full = worldWith({ backpack: { clay: 10 } });
    const oneMoreFits = worldWith({ backpack: { clay: 9 } });

    expect(summary(actionsFor(riverBank(), full.reader))).toContain("digClay off: the backpack is full");
    expect(summary(actionsFor(river(), full.reader))).toContain("digClay off: the backpack is full");
    expect(summary(actionsFor(riverBank(), oneMoreFits.reader))).toContain("digClay");
  });

  it("gathers stone in the river", () => {
    const actions = actionsFor(river(), worldWith({}).reader);

    expect(find(actions, "gatherStone")).toMatchObject({ label: "Gather stone", enabled: true, command: { type: "gatherStone", x: 1, z: 2 } });
  });

  it("offers no stone on ground away from the river bank", () => {
    expect(summary(actionsFor(ground(), worldWith({}).reader))).not.toContain("gatherStone");
  });

  it("greys out gathering stone when one more stone does not fit in the backpack", () => {
    const full = worldWith({ backpack: { stone: 10 } });
    const oneMoreFits = worldWith({ backpack: { stone: 9 } });

    expect(summary(actionsFor(riverBank(), full.reader))).toContain("gatherStone off: the backpack is full");
    expect(summary(actionsFor(river(), full.reader))).toContain("gatherStone off: the backpack is full");
    expect(summary(actionsFor(riverBank(), oneMoreFits.reader))).toContain("gatherStone");
  });

  it("drinks from the river, then fishes there with the fishing rod", () => {
    const actions = actionsFor(river(), worldWith({ backpack: { fishingRod: 1 } }).reader);

    expect(summary(actions)).toEqual(["drink main", "fish", "setFishTrap off: no fish trap in the backpack", "gatherStone", "digClay"]);
    expect(find(actions, "fish")).toMatchObject({ label: "Fish", command: { type: "fish", x: 1, z: 2 } });
  });

  it("sets a fish trap in the river, just after fishing", () => {
    const actions = actionsFor(river(), worldWith({ backpack: { fishTrap: 1 } }).reader);

    expect(summary(actions).slice(0, 3)).toEqual(["drink main", "fish off: needs the fishing rod", "setFishTrap"]);
    expect(find(actions, "setFishTrap")).toMatchObject({ label: "Set fish trap", icon: { content: "fishTrap" }, command: { type: "setFishTrap", x: 1, z: 2 } });
    const carrying = actionsFor(river(), worldWith({ backpack: { fishTrap: 1 }, carrying: "log" }).reader);
    expect(summary(carrying)).toContain("setFishTrap off: put the log down first");
    const dragging = actionsFor(river(), worldWith({ backpack: { fishTrap: 1 }, dragging: "anotherSled" }).reader);
    expect(summary(dragging)).toContain("setFishTrap off: let go of the sled first");
  });

  it("takes the fish from a set trap that holds one as its main action, or picks up an empty one", () => {
    const world = worldWith({});
    const holding = world.add({ fishTrap: { holding: true, minutesToNext: 400, draws: 2 } });
    const empty = world.add({ fishTrap: { holding: false, minutesToNext: 400, draws: 1 } });

    const holdingActions = actionsFor(scene("fishTrap", holding), world.reader);
    expect(summary(holdingActions)).toEqual(["takeFish main", "pickUp off: take the fish first"]);
    expect(find(holdingActions, "takeFish")).toMatchObject({ label: "Take fish", command: { type: "takeFishFromTrap", trapId: holding } });
    expect(summary(actionsFor(scene("fishTrap", empty), world.reader))).toEqual(["pickUp main"]);
    expect(find(actionsFor(scene("fishTrap", empty), world.reader), "pickUp")?.command).toEqual({ type: "pickUpFishTrap", trapId: empty });
  });

  it("greys out Take fish when the fish does not fit in the backpack", () => {
    const world = worldWith({ backpack: { stone: 10 } });
    const holding = world.add({ fishTrap: { holding: true, minutesToNext: 400, draws: 2 } });

    expect(summary(actionsFor(scene("fishTrap", holding), world.reader))[0]).toBe("takeFish main off: the backpack is full");
  });

  it("says fishing needs the fishing rod, and free hands", () => {
    expect(summary(actionsFor(river(), worldWith({ backpack: { fishingLine: 1 } }).reader))).toEqual([
      "drink main",
      "fish off: needs the fishing rod",
      "setFishTrap off: no fish trap in the backpack",
      "gatherStone",
      "digClay",
    ]);
    expect(summary(actionsFor(river(), worldWith({ backpack: { fishingRod: 1 }, carrying: "log" }).reader))).toEqual([
      "drink main",
      "fish off: put the log down first",
      "setFishTrap off: no fish trap in the backpack",
      "gatherStone",
      "digClay",
    ]);
  });

  it("eats raw fish from the backpack", () => {
    const actions = actionsFor({ kind: "backpackContent", content: "rawFish" }, worldWith({ backpack: { rawFish: 2 } }).reader);

    expect(summary(actions)).toEqual(["use main", "drop"]);
    expect(actions[0]).toMatchObject({ label: "Eat", command: { type: "eat", food: "rawFish" } });
  });

  it("eats cooked fish from the backpack", () => {
    const actions = actionsFor({ kind: "backpackContent", content: "cookedFish" }, worldWith({ backpack: { cookedFish: 2 } }).reader);

    expect(summary(actions)).toEqual(["use main", "drop"]);
    expect(actions[0]).toMatchObject({ label: "Eat", command: { type: "eat", food: "cookedFish" } });
  });
});

describe("river actions, continued", () => {
  it("fills the empty pot at the river", () => {
    const actions = actionsFor(river(), worldWith({ backpack: { pot: 1 } }).reader);

    expect(summary(actions)).toEqual([
      "drink main",
      "fillPot",
      "fish off: needs the fishing rod",
      "setFishTrap off: no fish trap in the backpack",
      "gatherStone",
      "digClay",
    ]);
    expect(find(actions, "fillPot")).toMatchObject({ label: "Fill the pot", command: { type: "fillPot" } });
    expect(summary(actionsFor(river(), worldWith({ backpack: { potOfRiverWater: 1 } }).reader))).not.toContain("fillPot");
  });
});
