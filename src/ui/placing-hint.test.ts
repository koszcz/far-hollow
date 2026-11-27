import { describe, expect, it } from "bun:test";
import type { BuildMenuEntry } from "../sim/api-build-menu";
import { placingHint, plantingHint } from "./placing-hint";

const MENU: readonly BuildMenuEntry[] = [
  { structure: "campfire", cost: [{ material: "stick", count: 5 }], placement: "onGround" },
  { structure: "floor", cost: [{ material: "plank", count: 2 }], placement: "underfoot", fixedFacing: true, inRows: true },
];

describe("the placing hint", () => {
  it("says what to click, then names the rotate and cancel keys", () => {
    expect(placingHint(MENU, "campfire")).toEqual({
      what: "Placing: Campfire. Click the ground to place it.",
      keys: "R to rotate · Esc to cancel",
    });
  });

  it("tells the player a Shift-drag lays a floor on each square, and names only the cancel key", () => {
    expect(placingHint(MENU, "floor")).toEqual({
      what: "Placing: Floor. Point at a finished foundation and click to place it. Hold Shift and drag to place one on each square.",
      keys: "Esc to stop",
    });
  });
});

describe("the placing hint where the game refuses the spot", () => {
  it("says why the spot under the mouse is not allowed, and still names the keys", () => {
    expect(placingHint(MENU, "campfire", { kind: "mushroomLogInTheWay" })).toEqual({
      what: "Cannot place a Campfire here: a mushroom log is in the way.",
      keys: "R to rotate · Esc to cancel",
    });
  });

  it("says a berry bush is in the way", () => {
    expect(placingHint(MENU, "campfire", { kind: "berryBushInTheWay" }).what).toBe("Cannot place a Campfire here: a berry bush is in the way.");
  });
});

describe("the planting hint", () => {
  it("says what to click, and names the cancel key", () => {
    expect(plantingHint("sapling", null)).toEqual({ what: "Planting: Sapling. Click the ground to plant it.", keys: "Esc to cancel" });
  });

  it("names the berry bush while planting one", () => {
    expect(plantingHint("berryBush", null).what).toBe("Planting: Berry bush. Click the ground to plant it.");
  });

  it("says why the spot under the mouse is not allowed", () => {
    expect(plantingHint("sapling", { kind: "tooCloseToTree" }).what).toBe("Cannot plant here: too close to a tree, stump, or sapling.");
  });
});
