import { describe, expect, it } from "bun:test";
import { worldWith } from "./test-world";
import { actionsFor } from "./thing-actions";
import { find, summary, scene } from "./thing-actions-test-support";

describe("tree, plant, and log actions", () => {
  it("chops a tree, and says it needs the axe without one", () => {
    expect(summary(actionsFor(scene("tree", 3), worldWith({ backpack: { axe: 1 } }).reader))).toEqual(["chop main"]);
    expect(summary(actionsFor(scene("tree", 3), worldWith({}).reader))).toEqual(["chop main off: needs the axe"]);
  });

  it("says a young tree is too young to chop", () => {
    const world = worldWith({ backpack: { axe: 1 } });
    const youngTree = world.add({ growth: { stage: "youngTree", minutesLeft: 60 }, blocksWalking: { radius: 1.2 } });

    expect(summary(actionsFor(scene("youngTree", youngTree), world.reader))).toEqual([
      "chop main off: the tree is too young to chop",
      "digUp off: the tree is too big to dig up",
    ]);
  });

  it("forages a berry bush with berries, and offers to dig it up", () => {
    const world = worldWith({});
    const bush = world.add({ forageSpot: { food: "berries" } });

    const actions = actionsFor(scene("forage", bush), world.reader);
    expect(summary(actions)).toEqual(["forage main", "digUp"]);
    expect(find(actions, "digUp")).toMatchObject({ label: "Dig up", command: { type: "digUpBerryBush", bushId: bush } });
  });

  it("digs up a berry bush growing its berries back as the main action", () => {
    const world = worldWith({});
    const bush = world.add({ forageSpot: { food: "berries" }, regrowing: { minutesLeft: 60 } });

    expect(summary(actionsFor(scene("forage", bush), world.reader))).toEqual(["digUp main", "forage off: nothing to take"]);
  });

  it("offers no digging up for a mushroom patch", () => {
    const world = worldWith({});
    const patch = world.add({ forageSpot: { food: "mushroom" } });

    expect(summary(actionsFor(scene("forage", patch), world.reader))).toEqual(["forage main"]);
  });

  it("digs up a sapling growing from a stump, with no tool", () => {
    const world = worldWith({});
    const sapling = world.add({ stump: true, growth: { stage: "sapling", minutesLeft: 60 }, blocksWalking: { radius: 0.9 } });

    const actions = actionsFor(scene("sapling", sapling), world.reader);
    expect(summary(actions)).toEqual(["digUp main"]);
    expect(find(actions, "digUp")).toMatchObject({ label: "Dig up", command: { type: "digUpSapling", saplingId: sapling } });
  });

  it("offers to plant a mushroom on a loose log while the backpack holds one, and keeps picking it up as the main action", () => {
    const world = worldWith({ backpack: { mushroom: 1 } });
    const log = world.add({ log: { heading: 0 } });

    const actions = actionsFor(scene("log", log), world.reader);
    expect(summary(actions)).toEqual(["pickUp main", "split off: needs the axe", "debark off: needs the drawknife", "plantMushroom"]);
    expect(find(actions, "plantMushroom")).toMatchObject({ label: "Plant mushroom", command: { type: "plantMushroom", logId: log } });
  });

  it("offers no mushroom planting on a log without a mushroom in the backpack, or on a debarked log", () => {
    const without = worldWith({});
    expect(summary(actionsFor(scene("log", without.add({ log: { heading: 0 } })), without.reader))).not.toContain("plantMushroom");

    const world = worldWith({ backpack: { mushroom: 1 } });
    expect(summary(actionsFor(scene("debarkedLog", world.add({ debarkedLog: { heading: 0 } })), world.reader))).toEqual(["pickUp main"]);
  });

  it("offers no mushroom planting on a log on a sled, on a woodpile, or on the player's shoulder", () => {
    const backpack = { mushroom: 1 };
    const onSled = worldWith({ backpack, sled: { log: 2 } });
    expect(summary(actionsFor(scene("sled", onSled.sled), onSled.reader))).not.toContain("plantMushroom");
    const onWoodpile = worldWith({ backpack, woodpile: { log: 2 } });
    expect(summary(actionsFor(scene("woodpile", onWoodpile.woodpile), onWoodpile.reader))).not.toContain("plantMushroom");
    const onShoulder = worldWith({ backpack, carrying: "log" });
    expect(summary(actionsFor({ kind: "shoulder", log: "log" }, onShoulder.reader))).not.toContain("plantMushroom");
  });

  it("forages a mushroom log, and takes it down", () => {
    const world = worldWith({});
    const mushroomLog = world.add({ mushroomLog: { heading: 0 }, forageSpot: { food: "mushroom" } });

    const actions = actionsFor(scene("mushroomLog", mushroomLog), world.reader);
    expect(summary(actions)).toEqual(["forage main", "takeDown"]);
    expect(find(actions, "forage")?.command).toEqual({ type: "forage", spotId: mushroomLog });
    expect(find(actions, "takeDown")?.command).toEqual({ type: "takeDownMushroomLog", mushroomLogId: mushroomLog });
  });

  it("says a mushroom log growing its mushrooms has nothing to forage yet", () => {
    const world = worldWith({});
    const mushroomLog = world.add({ mushroomLog: { heading: 0 }, forageSpot: { food: "mushroom" }, regrowing: { minutesLeft: 60 } });

    expect(summary(actionsFor(scene("mushroomLog", mushroomLog), world.reader))).toEqual(["forage main off: nothing to take", "takeDown"]);
  });

  it("says a bare stump has no sapling to dig up yet", () => {
    const world = worldWith({});
    const stump = world.add({ stump: true, growth: { stage: "stump", minutesLeft: 60 }, blocksWalking: { radius: 0.9 } });

    expect(summary(actionsFor(scene("stump", stump), world.reader))).toEqual(["digUp main off: no sapling grows on the stump yet"]);
  });

  it("says the backpack is full when a sapling does not fit", () => {
    const world = worldWith({ backpack: { stone: 10 } });
    const sapling = world.add({ stump: true, growth: { stage: "sapling", minutesLeft: 60 }, blocksWalking: { radius: 0.9 } });

    expect(summary(actionsFor(scene("sapling", sapling), world.reader))).toEqual(["digUp main off: the backpack is full"]);
  });

  it("drops a sapling from the backpack", () => {
    const actions = actionsFor({ kind: "backpackContent", content: "sapling" }, worldWith({ backpack: { sapling: 2 } }).reader);

    expect(summary(actions)).toContain("drop");
  });

  it("picks up a log, splits it, or debarks it", () => {
    const world = worldWith({ backpack: { axe: 1, drawknife: 1 } });
    const log = world.add({ log: { heading: 0 } });
    const actions = actionsFor(scene("log", log), world.reader);
    expect(summary(actions)).toEqual(["pickUp main", "split", "debark"]);
    expect(find(actions, "split")).toMatchObject({ label: "Split into firewood", command: { type: "splitLog", logId: log } });
    const carrying = worldWith({ backpack: { axe: 1 }, carrying: "log" });
    expect(summary(actionsFor(scene("log", carrying.add({ log: { heading: 0 } })), carrying.reader))).toEqual([
      "pickUp main off: your shoulder is full",
      "split off: your shoulder is full",
      "debark off: needs the drawknife",
    ]);
    expect(summary(actionsFor(scene("log", 4), worldWith({}).reader))[1]).toBe("split off: needs the axe");
  });

  it("only picks up a debarked log", () => {
    expect(summary(actionsFor(scene("debarkedLog", 4), worldWith({ backpack: { axe: 1 } }).reader))).toEqual(["pickUp main"]);
  });
});
