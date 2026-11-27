import { describe, expect, it } from "bun:test";
import { worldWith } from "./test-world";
import { actionsFor } from "./thing-actions";
import { find, summary, scene, river } from "./thing-actions-test-support";

describe("a sled's actions", () => {
  it("puts the log on the player's shoulder on the sled, then lists dragging, each kind to take, tipping out, and taking it down", () => {
    const world = worldWith({ carrying: "debarkedLog", sled: { log: 2, debarkedLog: 1 } });

    const actions = actionsFor(scene("sled", world.sled), world.reader);

    expect(summary(actions)).toEqual([
      "load:debarkedLog main",
      "drag",
      "fillSled",
      "take:log off: your shoulder is full",
      "take:debarkedLog off: your shoulder is full",
      "tipOut",
      "takeDown",
    ]);
    expect(find(actions, "load:debarkedLog")).toMatchObject({ label: "Put the debarked log on the sled", command: { type: "loadSled", sledId: world.sled } });
    expect(find(actions, "tipOut")).toMatchObject({ label: "Tip out everything", command: { type: "tipOutSled", sledId: world.sled } });
  });

  it("drags the sled when the player carries nothing, then takes one log, offering only the kinds the sled holds", () => {
    const logsOnly = worldWith({ sled: { log: 2 } });
    const logsOnlyActions = actionsFor(scene("sled", logsOnly.sled), logsOnly.reader);
    expect(summary(logsOnlyActions)).toEqual(["drag main", "fillSled off: no logs within 10 m", "take:log", "tipOut", "takeDown"]);
    expect(find(logsOnlyActions, "drag")).toMatchObject({ label: "Drag the sled", command: { type: "dragSled", sledId: logsOnly.sled } });

    const empty = worldWith({ sled: {} });
    expect(summary(actionsFor(scene("sled", empty.sled), empty.reader))).toEqual([
      "drag main",
      "fillSled off: no logs within 10 m",
      "take:log off: nothing to take",
      "tipOut off: nothing to take",
      "takeDown",
    ]);

    const mixed = worldWith({ sled: { log: 1, debarkedLog: 1 } });
    const mixedActions = actionsFor(scene("sled", mixed.sled), mixed.reader);
    expect(summary(mixedActions).slice(0, 4)).toEqual(["drag main", "fillSled off: no logs within 10 m", "take:log", "take:debarkedLog"]);
    expect(find(mixedActions, "take:debarkedLog")?.command).toEqual({ type: "takeFromSled", sledId: mixed.sled, log: "debarkedLog" });
  });

  it("says the sled is full", () => {
    const world = worldWith({ carrying: "log", sled: { log: 6 } });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))[0]).toBe("load:log main off: the sled is full");
  });

  it("loads planks when the backpack holds some, and takes planks when the sled holds some", () => {
    const world = worldWith({ backpack: { plank: 3 }, sled: { log: 1, plank: 5 } });

    const actions = actionsFor(scene("sled", world.sled), world.reader);

    expect(summary(actions)).toEqual(["drag main", "load:plank", "fillSled off: no logs within 10 m", "take:log", "take:plank", "tipOut", "takeDown"]);
    expect(find(actions, "load:plank")).toMatchObject({ label: "Load planks", command: { type: "loadPlanksOnSled", sledId: world.sled } });
    expect(find(actions, "take:plank")).toMatchObject({ label: "Take planks", command: { type: "takePlanksFromSled", sledId: world.sled } });
  });

  it("offers nothing for stone, because a sled does not take stone", () => {
    const world = worldWith({ backpack: { stone: 3 }, sled: { log: 1 } });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))).toEqual([
      "drag main",
      "fillSled off: no logs within 10 m",
      "take:log",
      "tipOut",
      "takeDown",
    ]);
  });

  it("offers no plank actions when neither the backpack nor the sled holds planks", () => {
    const world = worldWith({ sled: { log: 1 } });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))).toEqual([
      "drag main",
      "fillSled off: no logs within 10 m",
      "take:log",
      "tipOut",
      "takeDown",
    ]);
  });

  it("says the sled is full of planks, and refuses a log when no whole log space is free", () => {
    const planksFull = worldWith({ backpack: { plank: 1 }, sled: { plank: 24 } });
    expect(summary(actionsFor(scene("sled", planksFull.sled), planksFull.reader))).toContain("load:plank off: the sled is full");

    const oneQuarterLeft = worldWith({ carrying: "log", sled: { log: 5, plank: 1 } });
    expect(summary(actionsFor(scene("sled", oneQuarterLeft.sled), oneQuarterLeft.reader))[0]).toBe("load:log main off: the sled is full");
  });

  it("only lets go of the sled the player drags", () => {
    const world = worldWith({ sled: { log: 2 }, dragging: "thisSled" });

    const actions = actionsFor(scene("sled", world.sled), world.reader);

    expect(summary(actions)).toEqual(["letGo main"]);
    expect(actions[0]).toMatchObject({ label: "Let go of the sled", command: { type: "letGoOfSled" } });
  });

  it("drags one sled at a time", () => {
    const world = worldWith({ sled: {}, dragging: "anotherSled" });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))[0]).toBe("drag main off: let go of the sled first");
  });
});

describe("actions while dragging a sled", () => {
  it("turns off shouldering a log, gathering, chopping, and building, since the player's hands are busy", () => {
    const world = worldWith({ backpack: { axe: 1, drawknife: 1 }, dragging: "anotherSled" });

    expect(summary(actionsFor(scene("tree", 3), world.reader))).toEqual(["chop main off: let go of the sled first"]);
    expect(summary(actionsFor(scene("log", 4), world.reader))).toEqual([
      "pickUp main off: let go of the sled first",
      "split off: let go of the sled first",
      "debark off: let go of the sled first",
    ]);
    expect(summary(actionsFor(scene("stick", 5), world.reader))[0]).toBe("pickUp main off: let go of the sled first");
  });

  it("turns off fishing, but not drinking", () => {
    const world = worldWith({ backpack: { fishingRod: 1 }, dragging: "anotherSled" });

    expect(summary(actionsFor(river(), world.reader))).toEqual([
      "drink main",
      "fish off: let go of the sled first",
      "setFishTrap off: let go of the sled first",
      "gatherStone off: let go of the sled first",
      "digClay off: let go of the sled first",
    ]);
  });

  it("still lets the player eat and drink", () => {
    const world = worldWith({ backpack: { berries: 2 }, dragging: "anotherSled" });

    expect(summary(actionsFor({ kind: "backpackContent", content: "berries" }, world.reader))).toEqual(["use main", "drop"]);
  });
});
