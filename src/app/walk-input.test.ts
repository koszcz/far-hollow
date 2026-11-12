import { describe, expect, it } from "bun:test";
import { createGame } from "../sim/game";
import { strings } from "../strings";
import { blueprintPressFor, cursorFor, mainActionFor, menuActionsFor, outlineFor } from "./walk-input";

describe("pressing on a blueprint", () => {
  const foundation = (has: number) => ({
    id: 3,
    structure: "foundation" as const,
    progress: 0,
    deliveries: [{ material: "debarkedLog" as const, has, needs: 4 }],
  });

  it("adds the debarked log on the player's shoulder while the blueprint still needs one", () => {
    expect(blueprintPressFor(foundation(1), "debarkedLog")).toEqual({ type: "deliverToBlueprint", blueprintId: 3 });
  });

  it("builds it otherwise", () => {
    expect(blueprintPressFor(foundation(4), "debarkedLog")).toEqual({ type: "build", blueprintId: 3 });
    expect(blueprintPressFor(foundation(1), null)).toEqual({ type: "build", blueprintId: 3 });
    expect(blueprintPressFor(foundation(1), "log")).toEqual({ type: "build", blueprintId: 3 });
    expect(blueprintPressFor({ id: 5, structure: "campfire", progress: 0, deliveries: [] }, "debarkedLog")).toEqual({ type: "build", blueprintId: 5 });
  });
});

describe("right-clicking a log", () => {
  it("offers to debark it", () => {
    expect(menuActionsFor({ kind: "log", id: 4 })).toEqual([{ label: strings.debark, command: { type: "debarkLog", logId: 4 } }]);
  });

  it("offers nothing for things with no extra actions", () => {
    expect(menuActionsFor({ kind: "ground", spot: { x: 0, z: 0 } })).toEqual([]);
    expect(menuActionsFor({ kind: "debarkedLog", id: 4 })).toEqual([]);
  });
});

describe("right-clicking a building piece", () => {
  it("offers to take down a blueprint", () => {
    expect(menuActionsFor({ kind: "blueprint", id: 6 })).toEqual([{ label: strings.takeDown, command: { type: "takeDown", pieceId: 6 } }]);
  });

  it("offers to take down a finished piece, such as a lean-to or a wall", () => {
    const pick = { kind: "structure", id: 8, under: { kind: "ground", spot: { x: 1, z: 2 } } } as const;
    expect(menuActionsFor(pick)).toEqual([{ label: strings.takeDown, command: { type: "takeDown", pieceId: 8 } }]);
  });
});

describe("right-clicking a chest or woodpile", () => {
  it("offers to take it down", () => {
    expect(menuActionsFor({ kind: "chest", id: 9 })).toEqual([{ label: strings.takeDown, command: { type: "takeDown", pieceId: 9 } }]);
    expect(menuActionsFor({ kind: "woodpile", id: 10 })).toEqual([{ label: strings.takeDown, command: { type: "takeDown", pieceId: 10 } }]);
  });
});

describe("clicking a finished work station", () => {
  const sawhorse = { kind: "workStation", station: "sawhorse", id: 11 } as const;

  it("offers the recipes crafted at a sawhorse, or taking it down, on a right-click, and does nothing on a left-click yet", () => {
    const recipes = createGame({ seed: 42 }).client.getView().craftMenu;
    expect(menuActionsFor(sawhorse, recipes)).toEqual([
      { label: strings.craftMenu.recipes.planks, command: { type: "craft", recipe: "planks", stationId: 11 } },
      { label: strings.takeDown, command: { type: "takeDown", pieceId: 11 } },
    ]);
    expect(mainActionFor(sawhorse)).toBeUndefined();
  });

  it("offers only the recipes crafted at that kind of station, in the craft menu's order", () => {
    const recipes = [{ kind: "saw" }, { kind: "planks", station: "sawhorse" }, { kind: "saw", station: "sawhorse" }] as const;
    expect(menuActionsFor(sawhorse, recipes).map(({ command }) => command)).toEqual([
      { type: "craft", recipe: "planks", stationId: 11 },
      { type: "craft", recipe: "saw", stationId: 11 },
      { type: "takeDown", pieceId: 11 },
    ]);
  });
});

describe("left-clicking a finished building piece", () => {
  it("acts on what is under it, so the player can walk onto a foundation or into a lean-to", () => {
    const pick = { kind: "structure", id: 8, under: { kind: "ground", spot: { x: 1, z: 2 } } } as const;
    expect(mainActionFor(pick)).toEqual({ type: "walkTo", x: 1, z: 2 });
    expect(cursorFor(pick, false)).toBe("");
    expect(outlineFor(pick, false)).toBeUndefined();
  });
});

describe("clicking a debarked log", () => {
  it("walks the player to it and shoulders it, like a log", () => {
    expect(mainActionFor({ kind: "debarkedLog", id: 5 })).toEqual({ type: "pickUpLog", logId: 5 });
    expect(cursorFor({ kind: "debarkedLog", id: 5 }, false)).toBe("pointer");
  });
});

describe("clicking a campfire", () => {
  it("walks the player over to tend it", () => {
    expect(mainActionFor({ kind: "campfire", id: 7 })).toEqual({ type: "tendCampfire", campfireId: 7 });
    expect(mainActionFor({ kind: "bedroll", id: 9 })).toEqual({ type: "sleep", bedrollId: 9 });
  });
});

describe("clicking a pile", () => {
  it("walks the player to it to pick it up, with a hand and an outline", () => {
    expect(mainActionFor({ kind: "pile", id: 4 })).toEqual({ type: "pickUpPile", pileId: 4 });
    expect(cursorFor({ kind: "pile", id: 4 }, false)).toBe("pointer");
    expect(outlineFor({ kind: "pile", id: 4 }, false)).toEqual({ kind: "pile", id: 4 });
  });
});

describe("clicking a woodpile", () => {
  it("walks the player over to use it", () => {
    expect(mainActionFor({ kind: "woodpile", id: 4 })).toEqual({ type: "tendWoodpile", woodpileId: 4 });
  });
});

describe("clicking a chest", () => {
  it("walks the player to it and opens it", () => {
    expect(mainActionFor({ kind: "chest", id: 6 })).toEqual({ type: "openChest", chestId: 6 });
  });
});

describe("clicking the river", () => {
  it("walks the player to the bank to drink", () => {
    expect(mainActionFor({ kind: "river", spot: { x: 3, z: -4 } })).toEqual({ type: "drinkFromRiver", x: 3, z: -4 });
  });

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
