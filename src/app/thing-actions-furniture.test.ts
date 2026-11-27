import { describe, expect, it } from "bun:test";
import type { FurnitureKind } from "../sim/api";
import { worldWith } from "./test-world";
import { actionsFor } from "./thing-actions";
import { find, summary, scene, furniture } from "./thing-actions-test-support";

describe("furniture actions", () => {
  it("sleeps on a laid bedroll, or picks it up", () => {
    const world = worldWith({});
    expect(summary(actionsFor(scene("bedroll", world.add({ bedroll: true })), world.reader))).toEqual(["sleep main", "pickUp"]);
  });

  it("sleeps in a bed as its main action, or takes it down", () => {
    const world = worldWith({});
    const bed = world.add({ furniture: "bed", facing: { turns: 0 } });
    const actions = actionsFor(furniture("bed", bed), world.reader);
    expect(summary(actions)).toEqual(["sleep main", "takeDown"]);
    expect(find(actions, "sleep")?.command).toEqual({ type: "sleepInBed", bedId: bed });
  });

  it("offers only taking down a table, since eating at it needs no new action", () => {
    expect(summary(actionsFor(furniture("table", 8), worldWith({}).reader))).toEqual(["takeDown"]);
  });

  it("sits on a stool as its main action, or takes it down", () => {
    const world = worldWith({});
    const stool = world.add({ furniture: "stool", facing: { turns: 0 } });
    const actions = actionsFor(furniture("stool", stool), world.reader);
    expect(summary(actions)).toEqual(["sit main", "takeDown"]);
    expect(find(actions, "sit")?.command).toEqual({ type: "sitOnStool", stoolId: stool });
  });

  it("drinks from a rain barrel as its main action, fills the pot from it, or takes it down", () => {
    const world = worldWith({ backpack: { pot: 1 } });
    const barrel = world.add({ furniture: "rainBarrel", rainBarrel: { held: 2, progress: 0 }, facing: { turns: 0 } });
    const actions = actionsFor(furniture("rainBarrel", barrel), world.reader);
    expect(summary(actions)).toEqual(["drink main", "fillPot", "takeDown"]);
    expect(find(actions, "drink")?.command).toEqual({ type: "drinkFromRainBarrel", barrelId: barrel });
    expect(find(actions, "fillPot")?.command).toEqual({ type: "fillPotFromRainBarrel", barrelId: barrel });
  });

  it("greys drinking and filling the pot at an empty rain barrel, and filling the pot without an empty pot", () => {
    const world = worldWith({ backpack: { pot: 1 } });
    const empty = world.add({ furniture: "rainBarrel", rainBarrel: { held: 0, progress: 0.5 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("rainBarrel", empty), world.reader))).toEqual([
      "drink main off: the barrel is empty",
      "fillPot off: the barrel is empty",
      "takeDown",
    ]);

    const noPot = worldWith({ backpack: { potOfRiverWater: 1 } });
    const full = noPot.add({ furniture: "rainBarrel", rainBarrel: { held: 3, progress: 0 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("rainBarrel", full), noPot.reader))).toEqual(["drink main", "fillPot off: no empty pot in the backpack", "takeDown"]);
  });

  it("fills a jug from a rain barrel when the backpack holds a jug", () => {
    const world = worldWith({ backpack: { pot: 1, jugWith1Drink: 1 } });
    const barrel = world.add({ furniture: "rainBarrel", rainBarrel: { held: 2, progress: 0 }, facing: { turns: 0 } });
    const actions = actionsFor(furniture("rainBarrel", barrel), world.reader);
    expect(summary(actions)).toEqual(["drink main", "fillPot", "fillJug", "takeDown"]);
    expect(find(actions, "fillJug")).toMatchObject({ label: "Fill jug", command: { type: "fillJugFromRainBarrel", barrelId: barrel } });

    const noJug = worldWith({ backpack: { pot: 1 } });
    const other = noJug.add({ furniture: "rainBarrel", rainBarrel: { held: 2, progress: 0 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("rainBarrel", other), noJug.reader))).not.toContain("fillJug");
  });

  it("puts firewood in a wood box as its main action, all of it, or takes firewood from it", () => {
    const world = worldWith({ backpack: { firewood: 3 } });
    const box = world.add({ furniture: "woodBox", woodBox: { firewood: 2 }, facing: { turns: 0 } });
    const actions = actionsFor(furniture("woodBox", box), world.reader);
    expect(summary(actions)).toEqual(["putInFirewood main", "putInAllFirewood", "takeFirewood", "takeDown off: empty it first"]);
    expect(find(actions, "putInFirewood")).toMatchObject({ label: "Put in firewood", command: { type: "putInWoodBox", woodBoxId: box, all: false } });
    expect(find(actions, "putInAllFirewood")).toMatchObject({ label: "Put in all firewood", command: { type: "putInWoodBox", woodBoxId: box, all: true } });
    expect(find(actions, "takeFirewood")).toMatchObject({ label: "Take firewood", command: { type: "takeFromWoodBox", woodBoxId: box } });
  });

  it("greys each wood box action with its reason, and takes firewood as the main action when that is all the player can do", () => {
    const world = worldWith({});
    const empty = world.add({ furniture: "woodBox", woodBox: { firewood: 0 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("woodBox", empty), world.reader))).toEqual([
      "putInFirewood main off: no firewood",
      "putInAllFirewood off: no firewood",
      "takeFirewood off: the wood box is empty",
      "takeDown",
    ]);

    const full = world.add({ furniture: "woodBox", woodBox: { firewood: 20 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("woodBox", full), world.reader))).toEqual([
      "takeFirewood main",
      "putInFirewood off: no firewood",
      "putInAllFirewood off: no firewood",
      "takeDown off: empty it first",
    ]);
  });

  it("keeps the main action of other furniture in its usual states, as before the wood box", () => {
    const world = worldWith({ backpack: { pot: 1, jug: 1, berries: 1 } });
    const bed = world.add({ furniture: "bed", facing: { turns: 0 } });
    const stool = world.add({ furniture: "stool", facing: { turns: 0 } });
    const barrel = world.add({ furniture: "rainBarrel", rainBarrel: { held: 2, progress: 0 }, facing: { turns: 0 } });
    const emptyBarrel = world.add({ furniture: "rainBarrel", rainBarrel: { held: 0, progress: 0 }, facing: { turns: 0 } });
    const rack = world.add({ furniture: "dryingRack", dryingRack: [], facing: { turns: 0 } });
    const mainOf = (kind: FurnitureKind, id: number) => summary(actionsFor(furniture(kind, id), world.reader)).find((line) => line.includes(" main"));

    expect(mainOf("bed", bed)).toBe("sleep main");
    expect(mainOf("stool", stool)).toBe("sit main");
    expect(mainOf("rainBarrel", barrel)).toBe("drink main");
    expect(mainOf("rainBarrel", emptyBarrel)).toBe("drink main off: the barrel is empty");
    expect(mainOf("dryingRack", rack)).toBe("hang:berries main");
  });

  it("lists filling a jug, enabled, while the barrel holds water and a jug has room", () => {
    const world = worldWith({ backpack: { jug: 1 } });
    const barrel = world.add({ furniture: "rainBarrel", rainBarrel: { held: 1, progress: 0 }, facing: { turns: 0 } });
    expect(find(actionsFor(furniture("rainBarrel", barrel), world.reader), "fillJug")).toMatchObject({ enabled: true, label: "Fill jug" });
  });

  it("greys filling a jug at an empty rain barrel, and when every jug is full", () => {
    const world = worldWith({ backpack: { jug: 1 } });
    const empty = world.add({ furniture: "rainBarrel", rainBarrel: { held: 0, progress: 0 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("rainBarrel", empty), world.reader))).toContain("fillJug off: the barrel is empty");

    const fullJugs = worldWith({ backpack: { jugWith3Drinks: 2 } });
    const barrel = fullJugs.add({ furniture: "rainBarrel", rainBarrel: { held: 2, progress: 0 }, facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("rainBarrel", barrel), fullJugs.reader))).toContain("fillJug off: every jug is full");
  });

  it("hangs each food the backpack holds on a drying rack, takes food off once some hangs there, or takes the rack down", () => {
    const world = worldWith({ backpack: { berries: 2, mushroom: 1 } });
    const rack = world.add({ furniture: "dryingRack", dryingRack: [], facing: { turns: 0 } });
    const actions = actionsFor(furniture("dryingRack", rack), world.reader);
    expect(summary(actions)).toEqual(["hang:berries main", "hang:mushroom", "takeDown"]);
    expect(find(actions, "hang:mushroom")).toMatchObject({ label: "Hang a mushroom", command: { type: "hangOnRack", rackId: rack, food: "mushroom" } });

    const onlyMushroom = worldWith({ backpack: { mushroom: 1 } });
    const hung = onlyMushroom.add({ furniture: "dryingRack", dryingRack: [{ food: "berries", minutesPreserved: 10, spoilsAt: 5000 }], facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("dryingRack", hung), onlyMushroom.reader))).toEqual([
      "hang:mushroom main",
      "takeFoodOffRack",
      "takeDown off: empty it first",
    ]);
  });

  it("takes dried food off a drying rack as its main action, and greys hanging more on a full rack", () => {
    const world = worldWith({ backpack: { berries: 1 } });
    const rack = world.add({
      furniture: "dryingRack",
      dryingRack: Array.from({ length: 6 }, () => ({ food: "mushroom" as const, minutesPreserved: 360 })),
      facing: { turns: 0 },
    });
    const actions = actionsFor(furniture("dryingRack", rack), world.reader);
    expect(summary(actions)).toEqual(["takeFoodOffRack main", "hang:berries off: the rack holds 6 foods", "takeDown off: empty it first"]);
    expect(find(actions, "takeFoodOffRack")).toMatchObject({ icon: { content: "driedMushroom" }, command: { type: "takeFoodOffRack", rackId: rack } });
  });

  it("hangs raw fish on a drying rack, and greys hanging cooked fish, since only raw fish can be smoked", () => {
    const world = worldWith({ backpack: { rawFish: 1, cookedFish: 1 } });
    const rack = world.add({ furniture: "dryingRack", dryingRack: [], facing: { turns: 0 } });
    const actions = actionsFor(furniture("dryingRack", rack), world.reader);
    expect(summary(actions)).toEqual(["hang:rawFish main", "takeDown"]);
    expect(find(actions, "hang:rawFish")).toMatchObject({ label: "Hang raw fish", command: { type: "hangOnRack", rackId: rack, food: "rawFish" } });

    const onlyCooked = worldWith({ backpack: { cookedFish: 2 } });
    const empty = onlyCooked.add({ furniture: "dryingRack", dryingRack: [], facing: { turns: 0 } });
    expect(summary(actionsFor(furniture("dryingRack", empty), onlyCooked.reader))).toEqual([
      "hang:cookedFish main off: only raw fish can be smoked",
      "takeDown",
    ]);
  });

  it("shows smoked fish on the action that takes it off the rack", () => {
    const world = worldWith({});
    const rack = world.add({ furniture: "dryingRack", dryingRack: [{ food: "rawFish", minutesPreserved: 240 }], facing: { turns: 0 } });
    expect(find(actionsFor(furniture("dryingRack", rack), world.reader), "takeFoodOffRack")).toMatchObject({ icon: { content: "smokedFish" } });
  });

  it("opens a chest, or takes it down", () => {
    expect(summary(actionsFor(furniture("chest", 6), worldWith({}).reader))).toEqual(["open main", "takeDown"]);
    expect(summary(actionsFor(furniture("shelf", 7), worldWith({}).reader))).toEqual(["open main", "takeDown"]);
    expect(find(actionsFor(furniture("shelf", 7), worldWith({}).reader), "open")?.command).toEqual({ type: "openChest", chestId: 7 });
  });

  it("greys taking down a chest that still holds something, and says to empty it first", () => {
    const world = worldWith({});
    const chest = world.add({
      furniture: "chest",
      storage: { contents: { stick: 2 } },
      facing: { turns: 0 },
    });

    expect(summary(actionsFor(furniture("chest", chest), world.reader))).toEqual(["open main", "takeDown off: empty it first"]);
  });
});
