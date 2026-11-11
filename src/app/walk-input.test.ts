import { describe, expect, it } from "vitest";
import { cursorFor, mainActionFor, outlineFor } from "./walk-input";

describe("clicking a campfire", () => {
  it("walks the player over to tend it", () => {
    expect(mainActionFor({ kind: "campfire", id: 7 })).toEqual({ type: "tendCampfire", campfireId: 7 });
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
