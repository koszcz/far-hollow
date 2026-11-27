import { describe, expect, it } from "bun:test";
import type { BackpackContent } from "../sim/api";
import { worldWith, type Setup } from "./test-world";
import { actionsFor, mainAction, type ActionTarget } from "./thing-actions";
import { find, summary, scene } from "./thing-actions-test-support";

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

  it("offers to put out a lit fire, just before taking it down, and not an unlit one", () => {
    const world = worldWith({ campfire: { lit: true, fuelMinutes: 60 } });
    const actions = actionsFor(scene("campfire", world.campfire), world.reader);

    expect(summary(actions).slice(-2)).toEqual(["putOut", "takeDown"]);
    expect(find(actions, "putOut")).toMatchObject({ label: "Put out", command: { type: "putOutCampfire", campfireId: world.campfire } });
    const unlit = worldWith({ campfire: { fuelMinutes: 60 } });
    expect(actionsFor(scene("campfire", unlit.campfire), unlit.reader).some(({ id }) => id === "putOut")).toBe(false);
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

  it("offers to fire a jug only while the backpack holds an unfired jug, greyed with the reason on an unlit fire or one that holds a jug", () => {
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
    expect(fireJug({ backpack: { unfiredJug: 1 }, campfire: { ...lit, jug: false } }).action).toMatchObject({ enabled: false, reason: "the fire holds a jug" });
  });

  it("takes a jug off only when one is on the fire, after the fish", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const jugOn = worldWith({ backpack: { unfiredJug: 1 }, campfire: { ...lit, jug: true } });
    const actions = actionsFor(scene("campfire", jugOn.campfire), jugOn.reader);

    expect(summary(actions).slice(-5)).toEqual([
      "cookFish off: no raw fish",
      "fireJug off: the fire holds a jug",
      "takeJugOff",
      "putOut",
      "takeDown off: take the jug off first",
    ]);
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
        "addOn",
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

    expect(summary(actions).slice(2)).toEqual([
      "addFuel:bark off: no bark",
      "takePotOff",
      "cookFish",
      "takeFishOff",
      "putOut",
      "addOn",
      "takeDown off: take the pot off first",
    ]);
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
