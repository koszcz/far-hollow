import { describe, expect, it } from "bun:test";
import type { ScenePick } from "../render/scene-renderer";
import type { BackpackContent, BlueprintView, CampfireView, Command, GameView, WoodpileView } from "../sim/api";
import { createGame } from "../sim/game";
import type { ActionReader } from "./thing-actions";
import { cursorFor, leftClickFor, menuFor, outlineFor } from "./walk-input";

/** The command a left-click on this pick sends, read through a reader built from the given state. */
function clickSends(pick: ScenePick, state: ReaderState = {}): Command | undefined {
  return leftClickFor(pick, readerWith(state))?.command;
}

describe("left-clicking a campfire", () => {
  const campfire = { kind: "campfire", id: 7 } as const;

  it("lights an unlit fire that has fuel", () => {
    expect(clickSends(campfire, { backpack: { steelAndFlint: 1 }, campfire: { fuelMinutes: 20 } })).toEqual({ type: "lightCampfire", campfireId: 7 });
  });

  it("adds fuel to an unlit fire with none, using the first fuel the player has", () => {
    expect(clickSends(campfire, { backpack: { steelAndFlint: 1, stick: 2 }, campfire: {} })).toEqual({ type: "addFuel", campfireId: 7, fuel: "stick" });
  });

  it("adds firewood to a lit fire first, then a stick, then bark", () => {
    const lit = { lit: true, fuelMinutes: 60 };
    expect(clickSends(campfire, { backpack: { firewood: 1, stick: 1 }, campfire: lit })).toEqual({ type: "addFuel", campfireId: 7, fuel: "firewood" });
    expect(clickSends(campfire, { backpack: { bark: 1 }, campfire: lit })).toEqual({ type: "addFuel", campfireId: 7, fuel: "bark" });
  });

  it("does nothing when the player has no fuel to add", () => {
    expect(clickSends(campfire, { campfire: { lit: true, fuelMinutes: 60 } })).toBeUndefined();
  });
});

describe("left-clicking a woodpile", () => {
  const woodpile = { kind: "woodpile", id: 8 } as const;

  it("stacks the log on the player's shoulder", () => {
    expect(clickSends(woodpile, { carrying: "log", woodpile: {} })).toEqual({ type: "stackOnWoodpile", woodpileId: 8, wood: "log", all: false });
    expect(clickSends(woodpile, { carrying: "debarkedLog", woodpile: {} })).toEqual({
      type: "stackOnWoodpile",
      woodpileId: 8,
      wood: "debarkedLog",
      all: false,
    });
  });

  it("takes firewood when the player carries nothing", () => {
    const woodpileWithFirewood = { contents: { log: 0, debarkedLog: 0, firewood: 3 }, total: 3 };
    expect(clickSends(woodpile, { woodpile: woodpileWithFirewood })).toEqual({ type: "takeFromWoodpile", woodpileId: 8, wood: "firewood" });
  });
});

describe("left-clicking a blueprint", () => {
  const foundation = (has: number) => ({
    id: 3,
    structure: "foundation" as const,
    progress: 0,
    deliveries: [{ material: "debarkedLog" as const, has, needs: 4 }],
  });

  it("adds the debarked log on the player's shoulder while the blueprint still needs one", () => {
    expect(clickSends({ kind: "blueprint", id: 3 }, { carrying: "debarkedLog", blueprint: foundation(1) })).toEqual({
      type: "deliverToBlueprint",
      blueprintId: 3,
    });
  });

  it("builds it otherwise", () => {
    expect(clickSends({ kind: "blueprint", id: 3 }, { carrying: "debarkedLog", blueprint: foundation(4) })).toEqual({ type: "build", blueprintId: 3 });
    expect(clickSends({ kind: "blueprint", id: 3 }, { blueprint: foundation(1) })).toEqual({ type: "build", blueprintId: 3 });
  });
});

describe("left-clicking a finished work station", () => {
  it("opens its menu, which sends nothing by itself", () => {
    const action = leftClickFor({ kind: "workStation", station: "sawhorse", id: 11 }, readerWith({}));
    expect(action).toMatchObject({ id: "openMenu", command: undefined });
  });
});

describe("left-clicking a finished building piece", () => {
  it("acts on what is under it, so the player can walk onto a foundation or into a lean-to", () => {
    const pick = { kind: "structure", id: 8, structure: "foundation", under: { kind: "ground", spot: { x: 1, z: 2 } } } as const;
    expect(clickSends(pick)).toEqual({ type: "walkTo", x: 1, z: 2 });
    expect(cursorFor(pick, false)).toBe("");
    expect(outlineFor(pick, false)).toBeUndefined();
  });

  it("does nothing with nothing under it", () => {
    expect(leftClickFor({ kind: "structure", id: 8, structure: "foundation", under: undefined }, readerWith({}))).toBeUndefined();
  });
});

describe("left-clicking other things", () => {
  it("does the main action", () => {
    expect(clickSends({ kind: "debarkedLog", id: 5 })).toEqual({ type: "pickUpLog", logId: 5 });
    expect(clickSends({ kind: "bedroll", id: 9 })).toEqual({ type: "sleep", bedrollId: 9 });
    expect(clickSends({ kind: "pile", id: 4 })).toEqual({ type: "pickUpPile", pileId: 4 });
    expect(clickSends({ kind: "chest", id: 6 })).toEqual({ type: "openChest", chestId: 6 });
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

describe("right-clicking", () => {
  const ids = (pick: ScenePick, state: ReaderState = {}) => menuFor(pick, readerWith(state))?.map(({ id }) => id);

  it("opens a lone wall's menu, which offers to take it down", () => {
    const wall = { kind: "structure", id: 8, structure: "logWall", under: { kind: "ground", spot: { x: 1, z: 2 } } } as const;

    expect(ids(wall)).toEqual(["takeDownStructure"]);
  });

  it("opens the menu of a thing with more than its main action", () => {
    expect(ids({ kind: "log", id: 3 })).toEqual(["pickUp", "debark"]);
  });

  it("opens no menu for a thing whose only action is its left-click", () => {
    expect(ids({ kind: "stick", id: 4 })).toBeUndefined();
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

const START_VIEW = createGame({ seed: 42 }).client.getView();

interface ReaderState {
  readonly backpack?: Partial<Record<BackpackContent, number>>;
  readonly carrying?: GameView["carrying"];
  readonly campfire?: Partial<CampfireView>;
  readonly woodpile?: Partial<WoodpileView>;
  readonly blueprint?: BlueprintView;
}

/** A reader whose view has this backpack and shoulder, and which describes campfire 7, woodpile 8, and the blueprint as given. */
function readerWith({ backpack = {}, carrying = null, campfire, woodpile, blueprint }: ReaderState): ActionReader {
  const view: GameView = { ...START_VIEW, backpack, carrying };
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
    describeBlueprint: (id) => (blueprint?.id === id ? blueprint : null),
    describeCampfire: (id) => (id === 7 && campfire !== undefined ? fullCampfire : null),
    describeWoodpile: (id) => (id === 8 && woodpile !== undefined ? fullWoodpile : null),
    describeSled: () => null,
  };
}
