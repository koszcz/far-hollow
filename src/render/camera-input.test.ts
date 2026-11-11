import { describe, expect, it } from "vitest";
import { edgePanDirection } from "./camera-input";

const screen = { width: 1000, height: 800 };

describe("edgePanDirection", () => {
  it("does not pan when the pointer is away from the edges", () => {
    expect(edgePanDirection({ x: 500, y: 400 }, screen)).toEqual({ right: 0, forward: 0 });
  });

  it("pans left and forward when the pointer is in the top-left corner", () => {
    expect(edgePanDirection({ x: 2, y: 3 }, screen)).toEqual({ right: -1, forward: 1 });
  });

  it("pans right and back when the pointer is in the bottom-right corner", () => {
    expect(edgePanDirection({ x: 998, y: 797 }, screen)).toEqual({ right: 1, forward: -1 });
  });

  it("does not pan when the pointer is outside the screen", () => {
    expect(edgePanDirection(null, screen)).toEqual({ right: 0, forward: 0 });
  });
});
