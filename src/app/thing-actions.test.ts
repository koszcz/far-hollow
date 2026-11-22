import { describe, expect, it } from "bun:test";
import type { BackpackContent, CarriedLog, FurnitureKind, StructureKind } from "../sim/api";
import { worldWith, type Setup } from "./test-world";
import { actionsFor, mainAction, type ActionTarget, type ThingAction } from "./thing-actions";

// Each test sets up a real game, so every action is allowed or refused by the game's own rules.

describe("a campfire's actions", () => {
  it("offers to light an unlit fire with fuel, then each fuel, then the pot, then cooking fish, then taking it down", () => {
    const world = worldWith({ backpack: { steelAndFlint: 1, stick: 2 }, campfire: { fuelMinutes: 20 } });

    const actions = actionsFor(scene("campfire", world.campfire), world.reader);

    expect(summary(actions)).toEqual([
      "light main",
      "addFuel:firewood off: no firewood",
      "addFuel:stick",
      "addFuel:bark off: no bark",
      "putPotOn off: light the fire first",
      "cookFish off: light the fire first",
      "takeDown",
    ]);
    expect(mainAction(actions)?.command).toEqual({ type: "lightCampfire", campfireId: world.campfire });
    expect(find(actions, "takeDown")?.command).toEqual({ type: "takeDown", pieceId: world.campfire });
    expect(find(actions, "addFuel:stick")?.command).toEqual({ type: "addFuel", campfireId: world.campfire, fuel: "stick" });
  });

  it("adds the first fuel the player has to an unlit fire with no fuel, and says why lighting is off", () => {
    const world = worldWith({ backpack: { steelAndFlint: 1, bark: 1 }, campfire: {} });

    expect(summary(actionsFor(scene("campfire", world.campfire), world.reader))).toEqual([
      "addFuel:bark main",
      "light off: no fuel",
      "addFuel:firewood off: no firewood",
      "addFuel:stick off: no sticks",
      "putPotOn off: light the fire first",
      "cookFish off: light the fire first",
      "takeDown",
    ]);
  });

  it("says lighting needs the steel and flint", () => {
    const world = worldWith({ backpack: { stick: 1 }, campfire: { fuelMinutes: 20 } });

    expect(mainAction(actionsFor(scene("campfire", world.campfire), world.reader))).toMatchObject({
      id: "light",
      enabled: false,
      reason: "needs the steel and flint",
    });
  });

  it("feeds a lit fire firewood first, then a stick, then bark, and offers no lighting", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const main = (backpack: Partial<Record<BackpackContent, number>>) => {
      const world = worldWith({ backpack, campfire: lit });
      return mainAction(actionsFor(scene("campfire", world.campfire), world.reader))?.id;
    };

    expect(main({ firewood: 1, stick: 1, bark: 1 })).toBe("addFuel:firewood");
    expect(main({ stick: 1, bark: 1 })).toBe("addFuel:stick");
    expect(main({ bark: 1 })).toBe("addFuel:bark");
    expect(main({})).toBe("addFuel:firewood");
    const world = worldWith({ campfire: lit });
    expect(actionsFor(scene("campfire", world.campfire), world.reader).some(({ id }) => id === "light")).toBe(false);
  });

  it("says the fire is full for fuel that no longer fits, and skips to fuel that does", () => {
    // 7 hours 40 minutes of fuel: 20 more minutes of a stick still fit, but not 90 minutes of firewood.
    const world = worldWith({ backpack: { firewood: 1, stick: 1 }, campfire: { lit: true, fuelMinutes: 460 } });

    const actions = actionsFor(scene("campfire", world.campfire), world.reader);

    expect(summary(actions).slice(0, 2)).toEqual(["addFuel:stick main", "addFuel:firewood off: the fire is full"]);
  });

  it("puts a full pot on a lit fire, and takes a pot off when one is on", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const withPot = worldWith({ backpack: { potOfRiverWater: 1 }, campfire: lit });
    expect(find(actionsFor(scene("campfire", withPot.campfire), withPot.reader), "putPotOn")).toMatchObject({
      enabled: true,
      command: { type: "putPotOnFire", campfireId: withPot.campfire },
    });
    const emptyPot = worldWith({ backpack: { pot: 1 }, campfire: lit });
    expect(find(actionsFor(scene("campfire", emptyPot.campfire), emptyPot.reader), "putPotOn")?.reason).toBe("no pot of water");

    const potOn = worldWith({ campfire: { ...lit, pot: "river" } });
    const actions = actionsFor(scene("campfire", potOn.campfire), potOn.reader);
    expect(find(actions, "putPotOn")).toBeUndefined();
    expect(find(actions, "takePotOff")).toMatchObject({ enabled: true, command: { type: "takePotOffFire", campfireId: potOn.campfire } });
  });

  it("puts a raw fish on a lit fire, and says why it cannot", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const cookFish = (setup: Setup) => {
      const world = worldWith(setup);
      return { world, action: find(actionsFor(scene("campfire", world.campfire), world.reader), "cookFish") };
    };

    const { world, action } = cookFish({ backpack: { rawFish: 2 }, campfire: lit });
    expect(action).toMatchObject({ enabled: true, label: "Cook fish", command: { type: "cookFish", campfireId: world.campfire } });
    expect(cookFish({ backpack: { rawFish: 2 }, campfire: {} }).action?.reason).toBe("light the fire first");
    expect(cookFish({ backpack: { cookedFish: 2 }, campfire: lit }).action?.reason).toBe("no raw fish");
    expect(cookFish({ backpack: { rawFish: 2 }, campfire: { ...lit, fish: [false, false, false] } }).action?.reason).toBe("the fire holds 3 fish");
  });

  it("takes fish off only when fish are on the fire", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const noFish = worldWith({ backpack: { rawFish: 2 }, campfire: lit });
    expect(find(actionsFor(scene("campfire", noFish.campfire), noFish.reader), "takeFishOff")).toBeUndefined();

    const fishOn = worldWith({ campfire: { ...lit, fish: [true] } });
    expect(find(actionsFor(scene("campfire", fishOn.campfire), fishOn.reader), "takeFishOff")).toMatchObject({
      enabled: true,
      label: "Take fish off",
      icon: { content: "cookedFish" },
      command: { type: "takeFishOff", campfireId: fishOn.campfire },
    });
  });

  it("offers to fire a jug only while the backpack holds an unfired jug, greyed with the reason on an unlit fire", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const fireJug = (setup: Setup) => {
      const world = worldWith(setup);
      return { world, action: find(actionsFor(scene("campfire", world.campfire), world.reader), "fireJug") };
    };

    const { world, action } = fireJug({ backpack: { unfiredJug: 1 }, campfire: lit });
    expect(action).toMatchObject({
      enabled: true,
      label: "Fire jug",
      icon: { content: "unfiredJug" },
      command: { type: "fireJug", campfireId: world.campfire },
    });
    expect(fireJug({ backpack: { unfiredJug: 1 }, campfire: {} }).action?.reason).toBe("light the fire first");
    expect(fireJug({ backpack: { jug: 1 }, campfire: lit }).action).toBeUndefined();
    expect(fireJug({ backpack: { unfiredJug: 1 }, campfire: { ...lit, jug: false } }).action).toBeUndefined();
  });

  it("takes a jug off only when one is on the fire, after the fish", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const jugOn = worldWith({ backpack: { unfiredJug: 1 }, campfire: { ...lit, jug: true } });
    const actions = actionsFor(scene("campfire", jugOn.campfire), jugOn.reader);

    expect(summary(actions).slice(-3)).toEqual(["cookFish off: no raw fish", "takeJugOff", "takeDown off: take the jug off first"]);
    expect(find(actions, "takeJugOff")).toMatchObject({
      label: "Take jug off",
      icon: { content: "jug" },
      command: { type: "takeJugOff", campfireId: jugOn.campfire },
    });
    const unfiredOn = worldWith({ campfire: { ...lit, jug: false } });
    expect(find(actionsFor(scene("campfire", unfiredOn.campfire), unfiredOn.reader), "takeJugOff")?.icon).toEqual({ content: "unfiredJug" });
  });

  it("offers a fireplace's fire the same way, clicked or reached with E, and greys taking it down while it holds fuel", () => {
    const world = worldWith({ backpack: { steelAndFlint: 1, stick: 2 } });
    const fireplace = world.add({ fireplace: { lit: false, fuelMinutes: 40 }, facing: { turns: 0 } });
    const clicked: ActionTarget = { kind: "scene", pick: { kind: "structure", id: fireplace, structure: "fireplace", under: undefined } };

    for (const target of [clicked, { kind: "scene", pick: { kind: "fireplace", id: fireplace } } as const]) {
      const actions = actionsFor(target, world.reader);
      expect(summary(actions)).toEqual([
        "light main",
        "addFuel:firewood off: no firewood",
        "addFuel:stick",
        "addFuel:bark off: no bark",
        "putPotOn off: light the fire first",
        "cookFish off: light the fire first",
        "takeDown off: let the fire burn out first",
      ]);
      expect(mainAction(actions)?.command).toEqual({ type: "lightCampfire", campfireId: fireplace });
    }
  });

  it("offers the pot and the fish on a lit fireplace as on a campfire, and greys taking it down while it holds them", () => {
    const world = worldWith({ backpack: { rawFish: 1 } });
    const lit = { lit: true, fuelMinutes: 60 };
    const fireplace = world.add({ fireplace: lit, facing: { turns: 0 }, potOnFire: { water: "river", minutesBoiling: 0 }, fishOnFire: [{ minutesCooked: 0 }] });

    const actions = actionsFor({ kind: "scene", pick: { kind: "fireplace", id: fireplace } }, world.reader);

    expect(summary(actions).slice(2)).toEqual(["addFuel:bark off: no bark", "takePotOff", "cookFish", "takeFishOff", "takeDown off: take the pot off first"]);
    expect(find(actions, "cookFish")?.command).toEqual({ type: "cookFish", campfireId: fireplace });
    expect(find(actions, "takeFishOff")?.command).toEqual({ type: "takeFishOff", campfireId: fireplace });
    expect(find(actions, "takePotOff")?.command).toEqual({ type: "takePotOffFire", campfireId: fireplace });
  });

  it("greys taking down a fire with fish on it, and says to take the fish off first", () => {
    const world = worldWith({ campfire: { fish: [false] } });

    expect(summary(actionsFor(scene("campfire", world.campfire), world.reader)).at(-1)).toBe("takeDown off: take the fish off first");
  });

  it("greys taking down a fire with a pot on it, and says to take the pot off first", () => {
    const world = worldWith({ campfire: { lit: true, fuelMinutes: 60, pot: "river" } });

    expect(summary(actionsFor(scene("campfire", world.campfire), world.reader)).at(-1)).toBe("takeDown off: take the pot off first");
  });

  it("gives every entry an icon and a name", () => {
    const world = worldWith({ campfire: {} });
    for (const action of actionsFor(scene("campfire", world.campfire), world.reader)) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.icon).toBeDefined();
    }
  });
});

describe("a woodpile's actions", () => {
  it("stacks the log on the player's shoulder first, then lists firewood, each wood to take, and taking it down", () => {
    const world = worldWith({ carrying: "log", backpack: { firewood: 2 }, woodpile: { log: 1, firewood: 3 } });

    expect(summary(actionsFor(scene("woodpile", world.woodpile), world.reader))).toEqual([
      "stack:log main",
      "stack:firewood",
      "stack:firewood:all",
      "take:log off: your shoulder is full",
      "take:debarkedLog off: nothing to take",
      "take:firewood",
      "takeDown off: empty it first",
    ]);
  });

  it("takes firewood when the player carries nothing, greys stacking the log, and stacks all firewood with its own entry", () => {
    const world = worldWith({ backpack: { firewood: 2 }, woodpile: { debarkedLog: 2, firewood: 1 } });

    const actions = actionsFor(scene("woodpile", world.woodpile), world.reader);

    expect(summary(actions)).toEqual([
      "take:firewood main",
      "stack:log off: carrying no log",
      "stack:firewood",
      "stack:firewood:all",
      "take:log off: nothing to take",
      "take:debarkedLog",
      "takeDown off: empty it first",
    ]);
    expect(find(actions, "stack:firewood:all")).toMatchObject({
      label: "Stack all firewood",
      command: { type: "stackOnWoodpile", woodpileId: world.woodpile, wood: "firewood", all: true },
    });
    expect(find(actions, "take:debarkedLog")?.command).toEqual({ type: "takeFromWoodpile", woodpileId: world.woodpile, wood: "debarkedLog" });
  });

  it("says the woodpile is full, and that the player has no firewood", () => {
    const full = worldWith({ carrying: "debarkedLog", backpack: { firewood: 1 }, woodpile: { log: 20 } });
    expect(summary(actionsFor(scene("woodpile", full.woodpile), full.reader)).slice(0, 3)).toEqual([
      "stack:debarkedLog main off: the woodpile is full",
      "stack:firewood off: the woodpile is full",
      "stack:firewood:all off: the woodpile is full",
    ]);

    const empty = worldWith({ woodpile: {} });
    const actions = actionsFor(scene("woodpile", empty.woodpile), empty.reader);
    expect(find(actions, "stack:firewood")?.reason).toBe("no firewood");
    expect(find(actions, "takeDown")?.enabled).toBe(true);
  });

  it("takes a log when the player carries nothing and the woodpile holds no firewood", () => {
    const world = worldWith({ woodpile: { log: 2 } });
    expect(mainAction(actionsFor(scene("woodpile", world.woodpile), world.reader))?.id).toBe("take:log");
  });

  it("stacks firewood when the player carries no log and the woodpile has nothing to take", () => {
    const world = worldWith({ backpack: { firewood: 2 }, woodpile: {} });
    expect(mainAction(actionsFor(scene("woodpile", world.woodpile), world.reader))?.id).toBe("stack:firewood");
  });

  it("still names taking firewood, greyed, when the player can do nothing at the woodpile", () => {
    const world = worldWith({ woodpile: {} });
    expect(summary(actionsFor(scene("woodpile", world.woodpile), world.reader))[0]).toBe("take:firewood main off: nothing to take");
  });
});

describe("a sled's actions", () => {
  it("puts the log on the player's shoulder on the sled, then lists dragging, each kind to take, tipping out, and taking it down", () => {
    const world = worldWith({ carrying: "debarkedLog", sled: { log: 2, debarkedLog: 1 } });

    const actions = actionsFor(scene("sled", world.sled), world.reader);

    expect(summary(actions)).toEqual([
      "load:debarkedLog main",
      "drag",
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
    expect(summary(logsOnlyActions)).toEqual(["drag main", "take:log", "tipOut", "takeDown"]);
    expect(find(logsOnlyActions, "drag")).toMatchObject({ label: "Drag the sled", command: { type: "dragSled", sledId: logsOnly.sled } });

    const empty = worldWith({ sled: {} });
    expect(summary(actionsFor(scene("sled", empty.sled), empty.reader))).toEqual([
      "drag main",
      "take:log off: nothing to take",
      "tipOut off: nothing to take",
      "takeDown",
    ]);

    const mixed = worldWith({ sled: { log: 1, debarkedLog: 1 } });
    const mixedActions = actionsFor(scene("sled", mixed.sled), mixed.reader);
    expect(summary(mixedActions).slice(0, 3)).toEqual(["drag main", "take:log", "take:debarkedLog"]);
    expect(find(mixedActions, "take:debarkedLog")?.command).toEqual({ type: "takeFromSled", sledId: mixed.sled, log: "debarkedLog" });
  });

  it("says the sled is full", () => {
    const world = worldWith({ carrying: "log", sled: { log: 6 } });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))[0]).toBe("load:log main off: the sled is full");
  });

  it("loads planks when the backpack holds some, and takes planks when the sled holds some", () => {
    const world = worldWith({ backpack: { plank: 3 }, sled: { log: 1, plank: 5 } });

    const actions = actionsFor(scene("sled", world.sled), world.reader);

    expect(summary(actions)).toEqual(["drag main", "load:plank", "take:log", "take:plank", "tipOut", "takeDown"]);
    expect(find(actions, "load:plank")).toMatchObject({ label: "Load planks", command: { type: "loadPlanksOnSled", sledId: world.sled } });
    expect(find(actions, "take:plank")).toMatchObject({ label: "Take planks", command: { type: "takePlanksFromSled", sledId: world.sled } });
  });

  it("offers nothing for stone, because a sled does not take stone", () => {
    const world = worldWith({ backpack: { stone: 3 }, sled: { log: 1 } });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))).toEqual(["drag main", "take:log", "tipOut", "takeDown"]);
  });

  it("offers no plank actions when neither the backpack nor the sled holds planks", () => {
    const world = worldWith({ sled: { log: 1 } });

    expect(summary(actionsFor(scene("sled", world.sled), world.reader))).toEqual(["drag main", "take:log", "tipOut", "takeDown"]);
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

describe("other things' actions", () => {
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

  it("builds a blueprint, adds a carried debarked log it needs first, and takes it down", () => {
    const blueprint = (carrying: CarriedLog | undefined) => {
      const world = worldWith(carrying === undefined ? {} : { carrying });
      const id = world.addBlueprint("foundation", { debarkedLog: 1 });
      return summary(actionsFor(scene("blueprint", id), world.reader));
    };

    expect(blueprint("debarkedLog")).toEqual(["deliver:debarkedLog main", "build", "takeDown"]);
    expect(blueprint(undefined)).toEqual(["build main", "takeDown"]);
  });

  it("greys out building, with why, when the player lacks a tool or material", () => {
    const build = (structure: StructureKind) => {
      const world = worldWith({});
      return mainAction(actionsFor(scene("blueprint", world.addBlueprint(structure)), world.reader));
    };

    expect(build("campfire")).toMatchObject({ id: "build", enabled: false, reason: "no sticks" });
    expect(build("foundation")).toMatchObject({ enabled: false, reason: "bring a debarked log first" });
    expect(build("chest")).toMatchObject({ enabled: false, reason: "needs the axe" });
  });

  it("opens a work station's menu, lists the recipes made there, then takes it down", () => {
    const actions = actionsFor({ kind: "scene", pick: { kind: "workStation", id: 10, station: "sawhorse" } }, worldWith({}).reader);

    expect(actions.map(({ id }) => id)).toEqual(["openMenu", "craft:planks", "takeDown"]);
    expect(mainAction(actions)?.command).toBeUndefined();
    expect(find(actions, "craft:planks")).toMatchObject({
      enabled: false,
      reason: "needs the saw and a sawhorse",
      command: { type: "craft", recipe: "planks", stationId: 10 },
    });
  });

  it("acts on the thing under a finished structure, then takes the structure down", () => {
    const world = worldWith({});
    const pick = { kind: "structure", id: 11, structure: "foundation", under: { kind: "stick", id: world.add({ stick: true }) } } as const;
    const actions = actionsFor({ kind: "scene", pick }, world.reader);

    expect(summary(actions)).toEqual(["pickUp main", "takeDownStructure"]);
    expect(find(actions, "takeDownStructure")?.command).toEqual({ type: "takeDown", pieceId: 11 });
  });

  it("offers a walk onto a finished structure with ground under it, then taking it down", () => {
    const pick = { kind: "structure", id: 11, structure: "foundation", under: { kind: "ground", spot: { x: 0, z: 0 } } } as const;
    const actions = actionsFor({ kind: "scene", pick }, worldWith({}).reader);

    expect(summary(actions)).toEqual(["walk main", "takeDownStructure"]);
  });

  it("offers to lay the bedroll in a lean-to while the backpack holds one", () => {
    const pick = { kind: "structure", id: 11, structure: "leanTo", under: { kind: "ground", spot: { x: 0, z: 0 } } } as const;
    const withBedroll = actionsFor({ kind: "scene", pick }, worldWith({ backpack: { bedroll: 1 } }).reader);
    const without = actionsFor({ kind: "scene", pick }, worldWith({ backpack: { bedroll: 0 } }).reader);

    expect(summary(withBedroll)).toEqual(["walk main", "layBedroll", "takeDownStructure"]);
    expect(find(withBedroll, "layBedroll")?.command).toEqual({ type: "layBedrollInLeanTo", leanToId: 11 });
    expect(summary(without)).toEqual(["walk main", "takeDownStructure"]);
  });

  it("makes laying the bedroll the main action on a lean-to with nothing under the pointer", () => {
    const pick = { kind: "structure", id: 11, structure: "leanTo", under: undefined } as const;

    expect(summary(actionsFor({ kind: "scene", pick }, worldWith({ backpack: { bedroll: 1 } }).reader))).toEqual(["layBedroll main", "takeDownStructure"]);
  });

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

function find(actions: readonly ThingAction[], id: string): ThingAction | undefined {
  return actions.find((action) => action.id === id);
}

/** Each action as one short line: its id, "main" if it is the main action, and why it is off. */
function summary(actions: readonly ThingAction[]): string[] {
  return actions.map(({ id, isMain, enabled, reason }) => [id, isMain ? "main" : "", enabled ? "" : `off: ${reason}`].filter(Boolean).join(" "));
}

type ThingKind =
  | "campfire"
  | "woodpile"
  | "sled"
  | "tree"
  | "youngTree"
  | "sapling"
  | "stump"
  | "log"
  | "debarkedLog"
  | "stick"
  | "bedroll"
  | "blueprint"
  | "plantedTorch"
  | "fishTrap"
  | "forage"
  | "mushroomLog";

/** A thing in the world, given by its kind and entity id, as the scene reports it under the cursor. */
function scene(kind: ThingKind, id: number): ActionTarget {
  return { kind: "scene", pick: { kind, id } };
}

/** A finished piece of furniture, given by its kind and entity id, as the scene reports it under the cursor. */
function furniture(kind: FurnitureKind, id: number): ActionTarget {
  return { kind: "scene", pick: { kind: "furniture", id, furniture: kind } };
}

function ground(): ActionTarget {
  return { kind: "scene", pick: { kind: "ground", spot: { x: 1, z: 2 } } };
}

function riverBank(): ActionTarget {
  return { kind: "scene", pick: { kind: "ground", spot: { x: 1, z: 2 }, riverBank: true } };
}

function river(): ActionTarget {
  return { kind: "scene", pick: { kind: "river", spot: { x: 1, z: 2 } } };
}
