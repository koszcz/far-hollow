import { describe, expect, it } from "bun:test";
import type { Command, ScenePick } from "../sim/api";
import { worldWith, type Setup, type World } from "./test-world";
import { cursorFor, mainActionFor, menuFor, outlineFor } from "./walk-input";

/** The command the main action on this pick sends, as E or the top of its action menu does, in a real game set up as given. */
function clickSends(pick: ScenePick | ((world: World) => ScenePick), setup: Setup = {}): Command | undefined {
  const world = worldWith(setup);
  return mainActionFor(typeof pick === "function" ? pick(world) : pick, world.reader)?.command;
}

describe("the main action on a campfire", () => {
  const campfire = (world: World) => ({ kind: "campfire", id: world.campfire }) as const;
  const sends = (setup: Setup) => {
    const world = worldWith(setup);
    return { id: world.campfire, command: mainActionFor(campfire(world), world.reader)?.command };
  };

  it("lights an unlit fire that has fuel", () => {
    const { id, command } = sends({ backpack: { steelAndFlint: 1 }, campfire: { fuelMinutes: 20 } });
    expect(command).toEqual({ type: "lightCampfire", campfireId: id });
  });

  it("adds fuel to an unlit fire with none, using the first fuel the player has", () => {
    const { id, command } = sends({ backpack: { steelAndFlint: 1, stick: 2 }, campfire: {} });
    expect(command).toEqual({ type: "addFuel", campfireId: id, fuel: "stick" });
  });

  it("adds firewood to a lit fire first, then a stick, then bark", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const firewood = sends({ backpack: { firewood: 1, stick: 1 }, campfire: lit });
    expect(firewood.command).toEqual({ type: "addFuel", campfireId: firewood.id, fuel: "firewood" });
    const bark = sends({ backpack: { bark: 1 }, campfire: lit });
    expect(bark.command).toEqual({ type: "addFuel", campfireId: bark.id, fuel: "bark" });
  });

  it("does nothing when the player has no fuel to add", () => {
    expect(clickSends(campfire, { campfire: { lit: true, fuelMinutes: 60 } })).toBeUndefined();
  });
});

describe("the main action on a woodpile", () => {
  const sends = (setup: Setup) => {
    const world = worldWith(setup);
    return { id: world.woodpile, command: mainActionFor({ kind: "woodpile", id: world.woodpile }, world.reader)?.command };
  };

  it("stacks the log on the player's shoulder", () => {
    const log = sends({ carrying: "log", woodpile: {} });
    expect(log.command).toEqual({ type: "stackOnWoodpile", woodpileId: log.id, wood: "log", all: false });
    const debarkedLog = sends({ carrying: "debarkedLog", woodpile: {} });
    expect(debarkedLog.command).toEqual({ type: "stackOnWoodpile", woodpileId: debarkedLog.id, wood: "debarkedLog", all: false });
  });

  it("takes firewood when the player carries nothing", () => {
    const { id, command } = sends({ woodpile: { firewood: 3 } });
    expect(command).toEqual({ type: "takeFromWoodpile", woodpileId: id, wood: "firewood" });
  });
});

describe("the main action on a blueprint", () => {
  /** What clicking a foundation blueprint with `has` debarked logs delivered sends. */
  const sends = (has: number, setup: Setup = {}) => {
    const world = worldWith(setup);
    const id = world.addBlueprint("foundation", { debarkedLog: has });
    return { id, command: mainActionFor({ kind: "blueprint", id }, world.reader)?.command };
  };

  it("adds the debarked log on the player's shoulder while the blueprint still needs one", () => {
    const { id, command } = sends(1, { carrying: "debarkedLog" });
    expect(command).toEqual({ type: "deliverToBlueprint", blueprintId: id });
  });

  it("builds it otherwise", () => {
    const full = sends(4, { carrying: "debarkedLog" });
    expect(full.command).toEqual({ type: "build", blueprintId: full.id });
    const notCarrying = sends(1);
    expect(notCarrying.command).toEqual({ type: "build", blueprintId: notCarrying.id });
  });
});

describe("the main action on a finished work station", () => {
  it("opens its menu, which sends nothing by itself", () => {
    const action = mainActionFor({ kind: "workStation", station: "sawhorse", id: 11 }, worldWith({}).reader);
    expect(action).toMatchObject({ id: "openMenu", command: undefined });
  });
});

describe("the main action on a finished building piece", () => {
  it("acts on what is under it, so the player can walk onto a foundation or into a lean-to", () => {
    const pick = { kind: "structure", id: 8, structure: "foundation", under: { kind: "ground", spot: { x: 1, z: 2 } } } as const;
    expect(clickSends(pick)).toEqual({ type: "walkTo", x: 1, z: 2 });
    expect(cursorFor(pick, false)).toBe("");
    expect(outlineFor(pick, false)).toBeUndefined();
  });

  it("does nothing with nothing under it", () => {
    expect(mainActionFor({ kind: "structure", id: 8, structure: "foundation", under: undefined }, worldWith({}).reader)).toBeUndefined();
  });
});

describe("the main action on other things", () => {
  it("does the main action", () => {
    expect(clickSends({ kind: "debarkedLog", id: 5 })).toEqual({ type: "pickUpLog", logId: 5 });
    expect(clickSends({ kind: "bedroll", id: 9 })).toEqual({ type: "sleep", bedrollId: 9 });
    expect(clickSends({ kind: "furniture", id: 8, furniture: "stool" })).toEqual({ type: "sitOnStool", stoolId: 8 });
    expect(clickSends({ kind: "pile", id: 4 })).toEqual({ type: "pickUpPile", pileId: 4 });
    expect(clickSends({ kind: "furniture", id: 6, furniture: "chest" })).toEqual({ type: "openChest", chestId: 6 });
    expect(clickSends({ kind: "furniture", id: 7, furniture: "shelf" })).toEqual({ type: "openChest", chestId: 7 });
    expect(clickSends({ kind: "river", spot: { x: 3, z: -4 } })).toEqual({ type: "drinkFromRiver", x: 3, z: -4 });
    expect(clickSends({ kind: "tree", id: 2 }, { backpack: { axe: 1 } })).toEqual({ type: "chopTree", treeId: 2 });
  });

  it("does nothing when the main action cannot happen yet, such as chopping without the axe", () => {
    expect(clickSends({ kind: "tree", id: 2 })).toBeUndefined();
  });

  it("shows a hand and an outline over a pile", () => {
    expect(cursorFor({ kind: "pile", id: 4 }, false)).toBe("pointer");
    expect(outlineFor({ kind: "pile", id: 4 }, false)).toEqual({ kind: "pile", id: 4 });
  });
});

describe("clicking a thing", () => {
  const ids = (pick: ScenePick, setup: Setup = {}) => menuFor(pick, worldWith(setup).reader)?.map(({ id }) => id);

  it("opens a menu with the main action on top, then the rest", () => {
    expect(ids({ kind: "log", id: 3 })).toEqual(["pickUp", "split", "debark"]);
  });

  it("opens a menu even when the thing offers only its main action", () => {
    expect(ids({ kind: "stick", id: 4 })).toEqual(["pickUp"]);
  });

  it("keeps an action the player cannot do yet, so the menu can grey it and say why", () => {
    expect(menuFor({ kind: "tree", id: 2 }, worldWith({}).reader)?.[0]).toMatchObject({ id: "chop", enabled: false });
  });

  it("offers a walk onto a building piece over ground, then taking it down", () => {
    const wall = { kind: "structure", id: 8, structure: "logWall", under: { kind: "ground", spot: { x: 1, z: 2 } } } as const;

    expect(ids(wall)).toEqual(["walk", "takeDownStructure"]);
  });

  it("leaves out a work station's open-menu action, which sends nothing, so its recipes lead", () => {
    expect(ids({ kind: "workStation", station: "sawhorse", id: 11 })?.includes("openMenu")).toBe(false);
  });

  it("opens no menu on plain ground, where a click walks", () => {
    expect(menuFor({ kind: "ground", spot: { x: 0, z: 0 } }, worldWith({}).reader)).toBeUndefined();
  });

  it("opens a menu on plain ground to walk or drop the log, while the player carries one", () => {
    expect(menuFor({ kind: "ground", spot: { x: 0, z: 0 } }, worldWith({ carrying: "log" }).reader)?.map(({ id }) => id)).toEqual(["walk", "dropHere"]);
  });
});

describe("the river", () => {
  it("shows a hand, but outlines nothing, because the river is too big to outline", () => {
    expect(cursorFor({ kind: "river", spot: { x: 0, z: 0 } }, false)).toBe("pointer");
    expect(outlineFor({ kind: "river", spot: { x: 0, z: 0 } }, false)).toBeUndefined();
  });

  it("cannot have a campfire placed on it", () => {
    expect(cursorFor({ kind: "river", spot: { x: 0, z: 0 } }, true)).toBe("crosshair");
  });
});

describe("the pointer", () => {
  it("shows a hand over things the player can click", () => {
    for (const kind of ["tree", "log", "stick", "blueprint", "campfire"] as const) {
      expect(cursorFor({ kind, id: 1 }, false)).toBe("pointer");
    }
  });

  it("shows a hand over a finished piece of furniture, and outlines it", () => {
    const stool = { kind: "furniture", id: 1, furniture: "stool" } as const;
    expect(cursorFor(stool, false)).toBe("pointer");
    expect(outlineFor(stool, false)).toEqual(stool);
  });

  it("stays the default arrow over the ground and the sky", () => {
    expect(cursorFor({ kind: "ground", spot: { x: 0, z: 0 } }, false)).toBe("");
    expect(cursorFor(undefined, false)).toBe("");
  });

  it("shows a crosshair while placing a campfire", () => {
    expect(cursorFor({ kind: "ground", spot: { x: 0, z: 0 } }, true)).toBe("crosshair");
    expect(cursorFor({ kind: "tree", id: 1 }, true)).toBe("crosshair");
  });
});

describe("the hover outline", () => {
  it("outlines things the player can click", () => {
    for (const kind of ["tree", "log", "stick", "blueprint", "campfire"] as const) {
      expect(outlineFor({ kind, id: 1 }, false)).toEqual({ kind, id: 1 });
    }
  });

  it("outlines nothing over the ground or the sky", () => {
    expect(outlineFor({ kind: "ground", spot: { x: 0, z: 0 } }, false)).toBeUndefined();
    expect(outlineFor(undefined, false)).toBeUndefined();
  });

  it("outlines nothing while placing a campfire", () => {
    expect(outlineFor({ kind: "tree", id: 1 }, true)).toBeUndefined();
  });
});
