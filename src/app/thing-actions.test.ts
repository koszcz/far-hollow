import { describe, expect, it } from "bun:test";
import type { BackpackContent, BlueprintView, CampfireView, GameView, SledView, WoodpileView } from "../sim/api";
import { createGame } from "../sim/game";
import { actionsFor, mainAction, type ActionReader, type ActionTarget, type ThingAction } from "./thing-actions";

const CAMPFIRE: ActionTarget = { kind: "scene", pick: { kind: "campfire", id: 7 } };

describe("a campfire's actions", () => {
  it("offers to light an unlit fire with fuel, then each fuel, then the pot, then taking it down", () => {
    const reader = readerWith({ backpack: { steelAndFlint: 1, stick: 2 }, campfire: { fuelMinutes: 20 } });

    const actions = actionsFor(CAMPFIRE, reader);

    expect(summary(actions)).toEqual([
      "light main",
      "addFuel:firewood off: no firewood",
      "addFuel:stick",
      "addFuel:bark off: no bark",
      "putPotOn off: light the fire first",
      "takeDown",
    ]);
    expect(mainAction(actions)?.command).toEqual({ type: "lightCampfire", campfireId: 7 });
    expect(find(actions, "takeDown")?.command).toEqual({ type: "takeDown", pieceId: 7 });
    expect(actions.find(({ id }) => id === "addFuel:stick")?.command).toEqual({ type: "addFuel", campfireId: 7, fuel: "stick" });
  });

  it("adds the first fuel the player has to an unlit fire with no fuel, and says why lighting is off", () => {
    const reader = readerWith({ backpack: { steelAndFlint: 1, bark: 1 }, campfire: {} });

    expect(summary(actionsFor(CAMPFIRE, reader))).toEqual([
      "addFuel:bark main",
      "light off: no fuel",
      "addFuel:firewood off: no firewood",
      "addFuel:stick off: no sticks",
      "putPotOn off: light the fire first",
      "takeDown",
    ]);
  });

  it("says lighting needs the steel and flint", () => {
    const reader = readerWith({ backpack: { stick: 1 }, campfire: { fuelMinutes: 20 } });

    expect(mainAction(actionsFor(CAMPFIRE, reader))).toMatchObject({ id: "light", enabled: false, reason: "needs the steel and flint" });
  });

  it("feeds a lit fire firewood first, then a stick, then bark, and offers no lighting", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    const main = (backpack: Partial<Record<BackpackContent, number>>) => mainAction(actionsFor(CAMPFIRE, readerWith({ backpack, campfire: lit })))?.id;

    expect(main({ firewood: 1, stick: 1, bark: 1 })).toBe("addFuel:firewood");
    expect(main({ stick: 1, bark: 1 })).toBe("addFuel:stick");
    expect(main({ bark: 1 })).toBe("addFuel:bark");
    expect(main({})).toBe("addFuel:firewood");
    expect(actionsFor(CAMPFIRE, readerWith({ campfire: lit })).some(({ id }) => id === "light")).toBe(false);
  });

  it("says the fire is full for fuel that no longer fits, and skips to fuel that does", () => {
    const reader = readerWith({
      backpack: { firewood: 1, stick: 1 },
      campfire: { lit: true, fuelMinutes: 460, fits: { firewood: false, stick: true, bark: true } },
    });

    const actions = actionsFor(CAMPFIRE, reader);

    expect(summary(actions).slice(0, 2)).toEqual(["addFuel:stick main", "addFuel:firewood off: the fire is full"]);
  });

  it("puts a full pot on a lit fire, and takes a pot off when one is on", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    expect(find(actionsFor(CAMPFIRE, readerWith({ backpack: { potOfRiverWater: 1 }, campfire: lit })), "putPotOn")).toMatchObject({
      enabled: true,
      command: { type: "putPotOnFire", campfireId: 7 },
    });
    expect(find(actionsFor(CAMPFIRE, readerWith({ backpack: { pot: 1 }, campfire: lit })), "putPotOn")?.reason).toBe("no pot of water");

    const potOn = actionsFor(CAMPFIRE, readerWith({ campfire: { ...lit, pot: { water: "river", boilProgress: 0.5 } } }));
    expect(find(potOn, "putPotOn")).toBeUndefined();
    expect(find(potOn, "takePotOff")).toMatchObject({ enabled: true, command: { type: "takePotOffFire", campfireId: 7 } });
  });

  it("greys taking down a fire with a pot on it, and says to take the pot off first", () => {
    const potOn = actionsFor(CAMPFIRE, readerWith({ campfire: { lit: true, fuelMinutes: 60, pot: { water: "river", boilProgress: 0.5 } } }));

    expect(summary(potOn).at(-1)).toBe("takeDown off: take the pot off first");
  });

  it("gives every entry an icon and a name", () => {
    for (const action of actionsFor(CAMPFIRE, readerWith({ campfire: {} }))) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.icon).toBeDefined();
    }
  });
});

const WOODPILE: ActionTarget = { kind: "scene", pick: { kind: "woodpile", id: 8 } };

describe("a woodpile's actions", () => {
  it("stacks the log on the player's shoulder first, then lists firewood, each wood to take, and taking it down", () => {
    const reader = readerWith({ carrying: "log", backpack: { firewood: 2 }, woodpile: { contents: { log: 1, debarkedLog: 0, firewood: 3 }, total: 4 } });

    expect(summary(actionsFor(WOODPILE, reader))).toEqual([
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
    const reader = readerWith({ backpack: { firewood: 2 }, woodpile: { contents: { log: 0, debarkedLog: 2, firewood: 1 }, total: 3 } });

    const actions = actionsFor(WOODPILE, reader);

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
      command: { type: "stackOnWoodpile", woodpileId: 8, wood: "firewood", all: true },
    });
    expect(find(actions, "take:debarkedLog")?.command).toEqual({ type: "takeFromWoodpile", woodpileId: 8, wood: "debarkedLog" });
  });

  it("says the woodpile is full, and that the player has no firewood", () => {
    const full = readerWith({
      carrying: "debarkedLog",
      backpack: { firewood: 1 },
      woodpile: { contents: { log: 20, debarkedLog: 0, firewood: 0 }, total: 20 },
    });
    expect(summary(actionsFor(WOODPILE, full)).slice(0, 3)).toEqual([
      "stack:debarkedLog main off: the woodpile is full",
      "stack:firewood off: the woodpile is full",
      "stack:firewood:all off: the woodpile is full",
    ]);

    const empty = readerWith({ woodpile: {} });
    expect(find(actionsFor(WOODPILE, empty), "stack:firewood")?.reason).toBe("no firewood");
    expect(find(actionsFor(WOODPILE, empty), "takeDown")?.enabled).toBe(true);
  });

  it("takes a log when the player carries nothing and the woodpile holds no firewood", () => {
    const reader = readerWith({ woodpile: { contents: { log: 2, debarkedLog: 0, firewood: 0 }, total: 2 } });
    expect(mainAction(actionsFor(WOODPILE, reader))?.id).toBe("take:log");
  });

  it("stacks firewood when the player carries no log and the woodpile has nothing to take", () => {
    const reader = readerWith({ backpack: { firewood: 2 }, woodpile: {} });
    expect(mainAction(actionsFor(WOODPILE, reader))?.id).toBe("stack:firewood");
  });

  it("still names taking firewood, greyed, when the player can do nothing at the woodpile", () => {
    const reader = readerWith({ woodpile: {} });
    expect(summary(actionsFor(WOODPILE, reader))[0]).toBe("take:firewood main off: nothing to take");
  });
});

const SLED: ActionTarget = { kind: "scene", pick: { kind: "sled", id: 9 } };

describe("a sled's actions", () => {
  it("puts the log on the player's shoulder on the sled, then lists dragging, each kind to take, tipping out, and taking it down", () => {
    const reader = readerWith({ carrying: "debarkedLog", sled: { contents: { log: 2, debarkedLog: 1 }, total: 3 } });

    const actions = actionsFor(SLED, reader);

    expect(summary(actions)).toEqual([
      "load:debarkedLog main",
      "drag",
      "take:log off: your shoulder is full",
      "take:debarkedLog off: your shoulder is full",
      "tipOut",
      "takeDown",
    ]);
    expect(find(actions, "load:debarkedLog")).toMatchObject({ label: "Put the debarked log on the sled", command: { type: "loadSled", sledId: 9 } });
    expect(find(actions, "tipOut")).toMatchObject({ label: "Tip out every log", command: { type: "tipOutSled", sledId: 9 } });
  });

  it("drags the sled when the player carries nothing, then takes one log, offering only the kinds the sled holds", () => {
    const logsOnly = readerWith({ sled: { contents: { log: 2, debarkedLog: 0 }, total: 2 } });
    expect(summary(actionsFor(SLED, logsOnly))).toEqual(["drag main", "take:log", "tipOut", "takeDown"]);
    expect(find(actionsFor(SLED, logsOnly), "drag")).toMatchObject({ label: "Drag the sled", command: { type: "dragSled", sledId: 9 } });

    const empty = readerWith({ sled: { contents: { log: 0, debarkedLog: 0 }, total: 0 } });
    expect(summary(actionsFor(SLED, empty))).toEqual(["drag main", "take:log off: nothing to take", "tipOut off: nothing to take", "takeDown"]);

    const mixed = actionsFor(SLED, readerWith({ sled: { contents: { log: 1, debarkedLog: 1 }, total: 2 } }));
    expect(summary(mixed).slice(0, 3)).toEqual(["drag main", "take:log", "take:debarkedLog"]);
    expect(find(mixed, "take:debarkedLog")?.command).toEqual({ type: "takeFromSled", sledId: 9, log: "debarkedLog" });
  });

  it("says the sled is full", () => {
    const full = readerWith({ carrying: "log", sled: { contents: { log: 6, debarkedLog: 0 }, total: 6 } });

    expect(summary(actionsFor(SLED, full))[0]).toBe("load:log main off: the sled is full");
  });

  it("only lets go of the sled the player drags", () => {
    const dragging = readerWith({ sled: { contents: { log: 2, debarkedLog: 0 }, total: 2 }, dragging: 9 });

    const actions = actionsFor(SLED, dragging);

    expect(summary(actions)).toEqual(["letGo main"]);
    expect(actions[0]).toMatchObject({ label: "Let go of the sled", command: { type: "letGoOfSled" } });
  });

  it("drags one sled at a time", () => {
    const draggingAnother = readerWith({ sled: { contents: { log: 0, debarkedLog: 0 }, total: 0 }, dragging: 12 });

    expect(summary(actionsFor(SLED, draggingAnother))[0]).toBe("drag main off: let go of the sled first");
  });
});

describe("actions while dragging a sled", () => {
  it("turns off shouldering a log, gathering, chopping, and building, since the player's hands are busy", () => {
    const scene = (pick: Extract<ActionTarget, { kind: "scene" }>["pick"]): ActionTarget => ({ kind: "scene", pick });
    const reader = readerWith({ backpack: { axe: 1, drawknife: 1 }, dragging: 12 });

    expect(summary(actionsFor(scene({ kind: "tree", id: 3 }), reader))).toEqual(["chop main off: let go of the sled first"]);
    expect(summary(actionsFor(scene({ kind: "log", id: 4 }), reader))).toEqual([
      "pickUp main off: let go of the sled first",
      "debark off: let go of the sled first",
    ]);
    expect(summary(actionsFor(scene({ kind: "stick", id: 5 }), reader))[0]).toBe("pickUp main off: let go of the sled first");
  });

  it("still lets the player eat and drink", () => {
    const reader = readerWith({ backpack: { berries: 2 }, dragging: 12 });

    expect(summary(actionsFor({ kind: "backpackContent", content: "berries" }, reader))).toEqual(["use main", "drop"]);
  });
});

describe("other things' actions", () => {
  const scene = (pick: Extract<ActionTarget, { kind: "scene" }>["pick"]): ActionTarget => ({ kind: "scene", pick });

  it("walks over the ground, with nothing else", () => {
    expect(summary(actionsFor(scene({ kind: "ground", spot: { x: 1, z: 2 } }), readerWith({})))).toEqual(["walk main"]);
  });

  it("walks over the ground, or drops the carried log there", () => {
    const actions = actionsFor(scene({ kind: "ground", spot: { x: 1, z: 2 } }), readerWith({ carrying: "debarkedLog" }));
    expect(summary(actions)).toEqual(["walk main", "dropHere"]);
    expect(actions[1]?.command).toEqual({ type: "dropLogAt", x: 1, z: 2 });
  });

  it("chops a tree, and says it needs the axe without one", () => {
    expect(summary(actionsFor(scene({ kind: "tree", id: 3 }), readerWith({ backpack: { axe: 1 } })))).toEqual(["chop main"]);
    expect(summary(actionsFor(scene({ kind: "tree", id: 3 }), readerWith({})))).toEqual(["chop main off: needs the axe"]);
  });

  it("picks up a log, then debarks it", () => {
    expect(summary(actionsFor(scene({ kind: "log", id: 4 }), readerWith({ backpack: { drawknife: 1 } })))).toEqual(["pickUp main", "debark"]);
    expect(summary(actionsFor(scene({ kind: "log", id: 4 }), readerWith({ carrying: "log" })))).toEqual([
      "pickUp main off: your shoulder is full",
      "debark off: needs the drawknife",
    ]);
  });

  it("sleeps on a laid bedroll, or picks it up", () => {
    expect(summary(actionsFor(scene({ kind: "bedroll", id: 5 }), readerWith({})))).toEqual(["sleep main", "pickUp"]);
  });

  it("opens a chest, or takes it down", () => {
    expect(summary(actionsFor(scene({ kind: "chest", id: 6 }), readerWith({})))).toEqual(["open main", "takeDown"]);
  });

  it("builds a blueprint, adds a carried debarked log it needs first, and takes it down", () => {
    const blueprint = {
      id: 9,
      structure: "foundation" as const,
      progress: 0,
      deliveries: [{ material: "debarkedLog" as const, has: 1, needs: 4 }],
      lacks: null,
    };
    const reader = (carrying: GameView["carrying"]): ActionReader => ({ ...readerWith({ carrying }), describeBlueprint: () => blueprint });

    expect(summary(actionsFor(scene({ kind: "blueprint", id: 9 }), reader("debarkedLog")))).toEqual(["deliver:debarkedLog main", "build", "takeDown"]);
    expect(summary(actionsFor(scene({ kind: "blueprint", id: 9 }), reader(null)))).toEqual(["build main", "takeDown"]);
  });

  it("greys out building, with why, when the player lacks a tool or material", () => {
    const lacking = (lacks: BlueprintView["lacks"]): ActionReader => ({
      ...readerWith({}),
      describeBlueprint: () => ({ id: 9, structure: "campfire", progress: 0, deliveries: [], lacks }),
    });
    const build = (lacks: BlueprintView["lacks"]) => mainAction(actionsFor(scene({ kind: "blueprint", id: 9 }), lacking(lacks)));

    expect(build({ kind: "material", material: "stick" })).toMatchObject({ id: "build", enabled: false, reason: "no sticks" });
    expect(build({ kind: "material", material: "debarkedLog" })).toMatchObject({ enabled: false, reason: "bring a debarked log first" });
    expect(build({ kind: "tool", tool: "axe" })).toMatchObject({ enabled: false, reason: "needs the axe" });
  });

  it("opens a work station's menu, lists the recipes made there, then takes it down", () => {
    const actions = actionsFor(scene({ kind: "workStation", id: 10, station: "sawhorse" }), readerWith({}));

    expect(actions.map(({ id }) => id)).toEqual(["openMenu", "craft:planks", "takeDown"]);
    expect(mainAction(actions)?.command).toBeUndefined();
    expect(find(actions, "craft:planks")).toMatchObject({
      enabled: false,
      reason: "needs the saw and a sawhorse",
      command: { type: "craft", recipe: "planks", stationId: 10 },
    });
  });

  it("acts on the thing under a finished structure, then takes the structure down", () => {
    const actions = actionsFor(scene({ kind: "structure", id: 11, structure: "foundation", under: { kind: "stick", id: 4 } }), readerWith({}));

    expect(summary(actions)).toEqual(["pickUp main", "takeDownStructure"]);
    expect(find(actions, "takeDownStructure")?.command).toEqual({ type: "takeDown", pieceId: 11 });
  });

  it("offers a walk onto a finished structure with ground under it, then taking it down", () => {
    const actions = actionsFor(scene({ kind: "structure", id: 11, structure: "foundation", under: { kind: "ground", spot: { x: 0, z: 0 } } }), readerWith({}));

    expect(summary(actions)).toEqual(["walk main", "takeDownStructure"]);
  });

  it("eats food from the hotbar, then drops it, and puts it in an open chest first", () => {
    expect(summary(actionsFor({ kind: "backpackContent", content: "berries" }, readerWith({ backpack: { berries: 2 } })))).toEqual(["use main", "drop"]);
    expect(summary(actionsFor({ kind: "backpackContent", content: "stick" }, readerWith({ backpack: { stick: 2 } })))).toEqual(["drop"]);

    const chest = { id: 12, contents: {}, weight: 0, weightLimit: 30 };
    const withChest = readerWith({ backpack: { berries: 2 } });
    const chestReader: ActionReader = { ...withChest, getView: () => ({ ...withChest.getView(), nearby: [{ kind: "openChest", view: chest }] }) };
    const actions = actionsFor({ kind: "backpackContent", content: "berries" }, chestReader);
    expect(summary(actions)).toEqual(["putInChest main", "putInChest:all", "use", "drop"]);
    expect(find(actions, "putInChest:all")?.command).toEqual({ type: "putInChest", chestId: 12, content: "berries", all: true });
  });

  it("drops the log on the shoulder, or splits it with the axe", () => {
    expect(summary(actionsFor({ kind: "shoulder", log: "log" }, readerWith({ carrying: "log" })))).toEqual(["drop main", "split off: needs the axe"]);
    expect(summary(actionsFor({ kind: "shoulder", log: "debarkedLog" }, readerWith({ carrying: "debarkedLog" })))).toEqual(["drop main"]);
  });
});

function find(actions: readonly ThingAction[], id: string): ThingAction | undefined {
  return actions.find((action) => action.id === id);
}

/** Each action as one short line: its id, "main" if it is the main action, and why it is off. */
function summary(actions: readonly ThingAction[]): string[] {
  return actions.map(({ id, isMain, enabled, reason }) => [id, isMain ? "main" : "", enabled ? "" : `off: ${reason}`].filter(Boolean).join(" "));
}

const START_VIEW = createGame({ seed: 42 }).client.getView();

/** A reader whose view has this backpack and shoulder, and which describes campfire 7 and woodpile 8 as given. */
function readerWith({
  backpack = {},
  carrying = null,
  campfire,
  woodpile,
  sled,
  dragging,
}: {
  backpack?: Partial<Record<BackpackContent, number>>;
  carrying?: GameView["carrying"];
  campfire?: Partial<CampfireView>;
  woodpile?: Partial<WoodpileView>;
  sled?: Partial<SledView>;
  /** The id of the sled the player drags, if any. */
  dragging?: number;
}): ActionReader {
  const draggedSled: SledView | null = dragging === undefined ? null : { id: dragging, contents: { log: 0, debarkedLog: 0 }, total: 0, capacity: 6 };
  const view: GameView = { ...START_VIEW, backpack, carrying, dragging: draggedSled };
  const fullCampfire: CampfireView = {
    id: 7,
    lit: false,
    fuelLeft: 0,
    fuelMinutes: 0,
    canLight: false,
    fits: { stick: true, firewood: true, bark: true },
    pot: null,
    ...campfire,
  };
  const fullWoodpile: WoodpileView = { id: 8, contents: { log: 0, debarkedLog: 0, firewood: 0 }, total: 0, capacity: 20, ...woodpile };
  return {
    getView: () => view,
    describeBlueprint: () => null,
    describeCampfire: (id) => (id === 7 && campfire !== undefined ? fullCampfire : null),
    describeWoodpile: (id) => (id === 8 && woodpile !== undefined ? fullWoodpile : null),
    describeSled: (id) => (id === 9 && sled !== undefined ? { id: 9, contents: { log: 0, debarkedLog: 0 }, total: 0, capacity: 6, ...sled } : null),
  };
}
